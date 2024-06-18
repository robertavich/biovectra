const express = require("express");
const _ = require('lodash');
const app = express();
const multer = require("multer");
var upload = multer({ storage: multer.memoryStorage() });
const helper = require("./functions/tables");
const excel = require("./functions/excel");
app.use(express.urlencoded({ extended: true }));
var port = 3000;

app.use('/public', express.static('./public'));
//views are files you render in the web browser
app.set("views", "views");

app.set('view engine', 'html');
app.engine('html', require('hbs').__express);


app.get('/', function (req, res) {
  res.render("index");
})

app.post("/files/upload", upload.array("files"), async function (req, res) {
  try {

    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "At least 1 docx file required" });
    }

    console.log("Proceeding with file processing...");
    let results = [];

    let documentIds = [];

    for (let i = 0; i < files.length; i++) {
      let documentId = extractDocumentId(files[i].originalname);
      let result = await helper.extractTableDataFromDocs(files[i], documentId, res);
      results.push(result);
      documentIds.push(documentId);
    }

    results = results.flat();
    console.dir(results, { depth: null });
    console.log("------------------------------------------");
    results = _.values(_.groupBy(results, (item) => JSON.stringify(item.preferred)));
    console.dir(results, { depth: null });

    let computed = results.map(group => {
      let quantity = 0;
      group.map(obj => quantity += parseFloat(obj.quantity))
      let substitutes = _.union(..._.map(group, 'substitutes'));
      let descriptions = _.union(..._.map(group, 'description'));
      // console.log(descriptions)
      let document_ids = group.map(obj => {
        return { doc_id: obj.documentId, "quantity": parseFloat(obj.quantity) }
      })
      return { preferred: group[0].preferred, substitutes: substitutes, description: descriptions, quantity: quantity, unit: group[0].unit, doc_ids: document_ids }
    })
    console.log("------------------------------------------");
    console.dir(computed, { depth: null });

    //convert data to excel document
    const wb = await excel.convertToExcel(computed, documentIds);
    wb.write('ExcelFile.xlsx', res);
    // res.send(buffer);
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ error: "Internal server error" });
  }




});

function isSubset(arr1, arr2) {
  return arr1.every(item => arr2.includes(item));
}


// function extractDocumentId(text) {
//   // Regular expression to match BPR, MNWI, or TWI followed by 4 digits, case insensitive
//   const regex = /\b(?:BPR|MNWI|TWI)\d{4}\b/gi;
//   const matches = text.match(regex);
//   return matches ? matches[0] : null;
// }


function extractDocumentId(text) {
  //if text has with or w/ ,split at that point and use left side.
  let matches = [];
  // Regular expression pattern to match 'cs' or 'rm' followed by 4 digits, case-insensitive
  const pattern = /(BPR|MNWI|TWI)\d{4}/gi;
  matches = text.match(pattern);
  matches = matches ? matches.map(match => match.toLowerCase()) : [];
  //throw an error if empty
  if (matches.length == 0) return "file name issue";
  return matches[0].toLowerCase();
}

app.listen(port, () => {
  console.log("server started :" + port);
});


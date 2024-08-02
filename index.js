const express = require("express");
const app = express();
const multer = require("multer");
var upload = multer({ storage: multer.memoryStorage() });

const { bom } = require("./functions/bom/bom");
const { cb } = require("./functions/cb/cb");
const { qtcm } = require("./functions/qtcm");

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

    let task = req.body.task;
    console.log('Task:', task);

    const validTasks = ["Assembly Consumable Builder", "Bill Of Material", "QTCM"];

    if (!validTasks.includes(task)) {
      throw new Error("Invalid task provided");
    }

    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "At least 1 docx file required" });
    }

    console.log("Proceeding with file processing...");

    if (task == "Assembly Consumable Builder") {
      cb(files, res);
    }

    if (task == "Bill Of Material") {
      bom(files, res);
    }

    if (task == "QTCM") {
      qtcm(files, res);
    }

    // res.send(buffer);
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ error: "Internal server error" });
  }




});

app.listen(port, () => {
  console.log("server started :" + port);
});


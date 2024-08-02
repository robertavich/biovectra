const xpath = require("xpath");
const fs = require('fs');
const docx = require("docx");
var AdmZip = require("adm-zip");
var dom = require('xmldom').DOMParser;
const _ = require('lodash');

module.exports = {
    extractTableDataFromDocs: async function (file, errors) {

        let zip = new AdmZip(file.buffer);
        let zipEntry = zip.getEntry('word/document.xml');
        let documentData = zipEntry.getData().toString("utf8");
        let mainDoc = new dom().parseFromString(documentData, "application/xml");

        const select = xpath.useNamespaces({
            w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        });

        const tables = select(`//w:tbl`, mainDoc);
        console.log(tables.length)
        let extractedData = [];

        tables.forEach(table => {
            let rows = select('w:tr', table);
            rows = sanitizeRows(rows, select);
        })
    }
}

function sanitizeRows(trNodes, select) {
    let rows = [];
    let FirstColumnMergeRestart = "";

    let headersFound = false;
    let columnLength;

    // Define the XPath expression for selecting w:vMerge nodes without w:val attribute
    const vMergeExpression = './/w:vMerge[not(@w:val)]';
    let rowCount = 0;

    trNodes.forEach((tr, index) => {
        // Check if the first column exists
        let columns = select('w:tc', tr);
        let secondColumn = columns[1];
        let thirdColumn = columns[2];
        let fourthColumn = columns[3];

        let secondColumnText = secondColumn ? secondColumn.textContent : "";
        let thirdColumnText = thirdColumn ? thirdColumn.textContent : "";
        let fourthColumnText = fourthColumn ? fourthColumn.textContent : "";
        // console.log(JSON.stringify(secondColumnText))
        // console.log(JSON.stringify(thirdColumnText))
        // console.log(JSON.stringify(fourthColumnText))
        if (headersFound && columnLength == columns.length) {
            console.log(JSON.stringify(secondColumnText))
            console.log(JSON.stringify(thirdColumnText))
            console.log(JSON.stringify(fourthColumnText))
            console.log("---------------------------------------")
        } else {
            headersFound = false;
        }

        if (secondColumnText == "Part" && thirdColumnText == "Quantity" && fourthColumnText == "Lot Number") {
            headersFound = true;
            columnLength = columns.length;
            console.log(JSON.stringify(secondColumnText))
            console.log(JSON.stringify(thirdColumnText))
            console.log(JSON.stringify(fourthColumnText))
            console.log("---------------------------------------")
        }



        // let firstColumnText = firstColumn ? firstColumn.textContent : "";

        // // Check if the second column exists
        // let secondColumn = index === 0 ? null : select('w:tc', tr)[1];
        // let secondColumnText = secondColumn ? secondColumn.textContent : "";

        // // Check if the current row contains w:vMerge nodes without w:val attribute
        // const vMergeNodes = select(vMergeExpression, tr);

        // if (vMergeNodes.length === 0) {
        //     rowCount += 1;
        //     FirstColumnMergeRestart = firstColumnText;
        //     rows.push({ rowNumber: rowCount, columns: [FirstColumnMergeRestart, secondColumnText] });
        // } else {
        //     // Check if the second column contains w:vMerge nodes without w:val attribute
        //     let secondColumnMerge = select(vMergeExpression, secondColumn);
        //     if (secondColumnMerge.length === 0) {
        //         rows.push({ rowNumber: rowCount, columns: [FirstColumnMergeRestart, secondColumnText] });
        //     }
        // }
    });

    // console.log(rows);
    return rows;

}



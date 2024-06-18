const xpath = require("xpath");
const fs = require('fs');
const docx = require("docx");
var AdmZip = require("adm-zip");
var dom = require('xmldom').DOMParser;
const _ = require('lodash');

module.exports = {
    extractTableDataFromDocs: async function (file, documentId, res) {
        // console.log(file.originalname)
        // let documentId = extractDocumentId(file.originalname);
        // reading archives
        let zip = new AdmZip(file.buffer);
        let zipEntry = zip.getEntry('word/document.xml');
        let data = zipEntry.getData().toString("utf8");
        let mainDoc = new dom().parseFromString(data, "application/xml")
        const select = xpath.useNamespaces({
            w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        });

        // const tables = select(`//w:tbl[./w:tr[1]/w:tc[1]/descendant::*/text()='CONSUMABLE MATERIALS TABLE']`, mainDoc);
        // const tables = select(`//w:tbl[(./w:tr[1]/w:tc[1]/descendant::*/text()='This is my table header' or ./w:tr[1]/w:tc[1]/descendant::*/text()='Traceable Materials')]`, mainDoc);
        // const tables = select(`//w:tbl[(./w:tr[1]/w:tc[1]/descendant::*/text()='CONSUMABLE MATERIALS TABLE' or ./w:tr[1]/w:tc[1]/descendant::*/text()='TRACEABLE MATERIALS TABLE')]`, mainDoc);
        const tables = select(`//w:tbl[(contains(./w:tr[1]/w:tc[1]/descendant::*/text(), 'CONSUMABLE MATERIALS TABLE') or contains(./w:tr[1]/w:tc[1]/descendant::*/text(), 'TRACEABLE MATERIALS TABLE'))]`, mainDoc);

        let extractedData = [];

        tables.forEach(table => {

            let rows = select('w:tr', table);
            rows = sanitizeRows(rows, select);
            // let rows = select('w:tr', table);
            // let rows = select('w:tr[not(ancestor::w:tc)]', table);



            let firstRowColumn = select('w:tc', rows[0]);
            let tableType = getTableType(firstRowColumn[0].textContent);

            for (let i = 2; i < rows.length; i++) {


                let columns = select('w:tc', rows[i]);
                ////fraction and superscript support
                // let e = withMathEquations(columns[0], select);
                ////

                let consumables = columns[0].textContent;

                if (!consumables.includes("WFI")) {
                    let expectedQuantityPrepared = columns[1].textContent;

                    var traceableQuantityColumn;
                    if (tableType == "traceable") {
                        traceableQuantityColumn = getTraceableQuantityColumn(expectedQuantityPrepared);
                    }


                    let all = extractCS(consumables);
                    let preferred = extractCS(consumables, true);
                    preferred = preferred.length == 0 ? [all[0]] : preferred

                    let substitutes = _.difference(all, preferred);

                    let description = [getDescription(consumables)];

                    let { quantity, unit } = tableType == "consume" ? extractFC(expectedQuantityPrepared) : extractFR(traceableQuantityColumn);

                    console.log(preferred)
                    console.log(substitutes)
                    console.log(description)
                    console.log(quantity)
                    console.log(unit)


                    console.log("--------------------------")
                    if (quantity != null || unit != null) {
                        extractedData.push({
                            preferred: preferred,
                            description: description,
                            substitutes: substitutes,
                            quantity: quantity,
                            unit: unit,
                            documentId: documentId
                            // documentId: { documentId: documentId, quantity: quantity }
                        })
                    }


                }

            }

        })

        return extractedData;

    }
}

function getTableType(columnText) {
    if (columnText.includes("CONSUMABLE MATERIALS TABLE")) {
        return "consume";
    }
    return "traceable";
}


function getTraceableQuantityColumn(quantityColumn) {

    const text = quantityColumn;
    const regex = /^(.*?)\s*\([^)]*\)/; // Regex to match text outside brackets

    const match = text.match(regex);
    const extractedText = match ? match[1].trim() : text.trim();
    let relevant = extractedText.split("=");
    if (relevant.length == 2) {
        return relevant[1].trim();
    } else {
        return "";
    }

}
//preferred is of type bool
// function extractCS(text, preferred) {
//     let matches = [];
//     if (preferred) {
//         // Regular expression pattern to match 'cs' followed by exactly 4 digits
//         // if 'prefer' or any of its variations (like 'preferred' or 'preferring')
//         // is found later in the string. The match is case-insensitive and global.
//         const pattern = /cs\d{4}(?=.*?prefer)/gi;
//         matches = text.match(pattern);
//         matches = matches ? [matches.map(match => match.toLowerCase())[[matches.length - 1]]] : [];
//     } else {
//         // Regular expression pattern to match 'cs' followed by 4 digits, case-insensitive
//         const pattern = /cs\d{4}/gi;
//         matches = text.match(pattern);
//         matches = matches ? matches.map(match => match.toLowerCase()) : [];
//     }
//     return matches;
// }

//preferred is of type bool
function extractCS(text, preferred) {
    //if text has with or w/ ,split at that point and use left side.
    text = getPartText(text)[0];
    let matches = [];
    if (preferred) {
        // Regular expression pattern to match 'cs' or 'rm' followed by exactly 4 digits
        // if 'prefer' or any of its variations (like 'preferred' or 'preferring')
        // is found later in the string. The match is case-insensitive and global.
        const pattern = /(cs|rm)\d{4}(?=.*?prefer)/gi;
        matches = text.match(pattern);
        matches = matches ? [matches.map(match => match.toLowerCase())[matches.length - 1]] : [];
    } else {
        // Regular expression pattern to match 'cs' or 'rm' followed by 4 digits, case-insensitive
        const pattern = /(cs|rm)\d{4}/gi;
        matches = text.match(pattern);
        matches = matches ? matches.map(match => match.toLowerCase()) : [];
    }
    return matches;
}

function getPartText(text) {
    text = text;
    // Define the regular expression to match "with" or "w/"
    const regex = /\swith\s|\sw\/\s/i;

    // Split the text at the first occurrence of "with" or "w/"
    return text.split(regex);
}

function extractFC(input) {
    console.log(input)
    // Regular expression to match all letters and separate them from non-letters
    const pattern = /([a-zA-Z]+)|([^a-zA-Z]+)/g;

    // Use match to extract all parts
    const matches = input.match(pattern);

    let value = "";
    let unit = "";

    matches.forEach(match => {
        if (/[a-zA-Z]/.test(match)) {
            unit += match;
        } else {
            value += match;
        }
    });
    console.log(value)
    console.log(unit)
    console.log("++++++")
    if (unit.toLowerCase() == "asrequired") {
        return {
            quantity: null,
            unit: null
        };
    }

    if (value === "") {
        return {
            quantity: null,
            unit: null
        };
    }

    let range = value.split("-");
    value = range.length == 1 ? range[0] : range[1];

    return {
        quantity: value ? value.trim() : null,
        unit: unit ? unit.trim() : null
    };
}

function extractFR(input) {

    // Regular expression to match all letters and separate them from non-letters
    const pattern = /([a-zA-Z]+)|([^a-zA-Z]+)/g;

    // Use match to extract all parts
    const matches = input.match(pattern);

    let value = "";
    let unit = "";

    matches.forEach(match => {
        if (/[a-zA-Z]/.test(match)) {
            unit += match;
        } else {
            value += match;
        }
    });

    return {
        quantity: value.trim(),
        unit: unit.trim()
    };
}

function getDescription(text) {
    //if text has with or w/ ,split at that point
    //do computation for each loop and join result.
    let parts = getPartText(text);

    let result = parts.map(part => {
        // Define the regular expression pattern
        const pattern = /(.*?)(cs|rm)\d{4}/i;
        let match = pattern.exec(part);
        return match ? match[1].replace(/\([^)]*$/, '').trim() : "";
    })

    return result.join(" with ");
}




// function getDescription(input) {
//     // Define the regular expression pattern
//     const pattern = /(.*?)(cs|rm)\d{4}/i;
//     let match = pattern.exec(input);
//     return match ? match[1].replace(/\(\s*$/, '').trim() : null;
// }

// function extractDocumentId(text) {
//     // Regular expression to match BPR, MNWI, or TWI followed by 4 digits, case insensitive
//     const regex = /\b(?:BPR|MNWI|TWI)\d{4}\b/gi;
//     const matches = text.match(regex);
//     return matches ? matches[0] : null;
// }

function withMathEquations(column, select) {
    select('esxpression here', column)

}


function sanitizeRows(trNodes, select) {

    // if row contains  w:vMerge wihtout w:val="restart" value then exclude it
    let trNodes_of_interest = [];

    trNodes.forEach(tr => {

        // Define the XPath expression for selecting w:vMerge nodes without w:val attribute
        const vMergeExpression = './/w:vMerge[not(@w:val)]';

        // Select the w:vMerge nodes within the current w:tr node
        const vMergeNodes = select(vMergeExpression, tr);

        // Check if any w:vMerge nodes were found
        if (vMergeNodes.length == 0) {
            trNodes_of_interest.push(tr);
        }
    });
    return trNodes_of_interest;

}
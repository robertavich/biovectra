const xpath = require("xpath");
const fs = require('fs');
const docx = require("docx");
var AdmZip = require("adm-zip");
var dom = require('xmldom').DOMParser;
const _ = require('lodash');

module.exports = {
    extractTableDataFromDocs: async function (file, documentId, errors) {
        // console.log(file.originalname)
        // let documentId = extractDocumentId(file.originalname);
        // reading archives
        let zip = new AdmZip(file.buffer);
        let zipEntry = zip.getEntry('word/document.xml');
        let documentData = zipEntry.getData().toString("utf8");
        let mainDoc = new dom().parseFromString(documentData, "application/xml");

        let zipEntry2 = zip.getEntry('word/header2.xml');
        let data = zipEntry2.getData().toString("utf8");
        let header2Doc = new dom().parseFromString(data, "application/xml")


        const select = xpath.useNamespaces({
            w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        });

        const { classification, classificationId } = getDocumentClassification(header2Doc, select, errors);
        // console.log(classification);
        const executions = getNumberOfExecutions(header2Doc, select, errors);
        console.log(executions);

        // const tables = select(`//w:tbl[./w:tr[1]/w:tc[1]/descendant::*/text()='CONSUMABLE MATERIALS TABLE']`, mainDoc);

        // classification: "CAT or IT",
        // classificationId,
        // steps,
        // step,
        // executions

        const tables = select(`//w:tbl[(contains(./w:tr[1]/w:tc[1]/descendant::*/text(), 'CONSUMABLE MATERIALS TABLE') or contains(./w:tr[1]/w:tc[1]/descendant::*/text(), 'TRACEABLE MATERIALS TABLE'))]`, mainDoc);

        let extractedData = [];

        tables.forEach(table => {

            let rows = select('w:tr', table);
            rows = sanitizeRows(rows, select);
            // let rows = select('w:tr', table);
            // let rows = select('w:tr[not(ancestor::w:tc)]', table);



            // let firstRowColumn = select('w:tc', rows[0]);
            let firstRowColumn = rows[0].columns[0];
            // let tableType = getTableType(firstRowColumn[0].textContent);
            let tableType = getTableType(firstRowColumn);

            for (let i = 2; i < rows.length; i++) {

                let rowNumber = rows[i].rowNumber;
                // let columns = select('w:tc', rows[i]);
                let columns = rows[i].columns;

                ////fraction and superscript support
                // let e = withMathEquations(columns[0], select);
                ////

                // let consumables = columns[0].textContent;
                let consumables = columns[0];

                if (!consumables.includes("WFI")) {
                    // let expectedQuantityPrepared = columns[1].textContent;
                    let expectedQuantityPrepared = columns[1];

                    var traceableQuantityColumn;
                    if (tableType == "traceable") {
                        traceableQuantityColumn = getTraceableQuantityColumn(expectedQuantityPrepared);
                    }

                    let all = extractCS(consumables, false, errors, firstRowColumn, rowNumber);
                    let preferred = extractCS(consumables, true);//must not have error handling
                    preferred = preferred.length == 0 ? [all[0]] : preferred

                    let substitutes = _.difference(all, preferred);

                    let description = [getDescription(consumables)];

                    // let { quantity, unit } = tableType == "consume" ? extractFC(expectedQuantityPrepared, errors) : extractFR(traceableQuantityColumn, errors);
                    let { quantity, unit } = tableType == "consume" ? extractQuantityAndUnit(expectedQuantityPrepared, errors, firstRowColumn, rowNumber) : extractQuantityAndUnit(traceableQuantityColumn, errors, firstRowColumn, rowNumber);

                    console.log(all)
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
                            documentId: documentId,
                            classification: "CAT or IT",
                            classificationId: null,
                            steps: null,
                            step: null,
                            executions: null,

                            // documentId: { documentId: documentId, quantity: quantity }
                        })
                    }


                }

            }

        })

        return extractedData;

    }
}
function getDocumentClassification(header2Doc, select, errors) {

    return {
        classification: null,
        classificationId: null
    }
}
function getNumberOfExecutions(header2Doc, select, errors) {
    try {
        // Regex to match "execution" or "executions", followed by a colon, optional whitespace, and one or more digits
        const regex = /executions?\s*:\s*\d+/;

        const nodes = select(`//w:p`, header2Doc)

        let result = nodes.map(node => {
            const textContent = node.textContent.toLowerCase();
            const match = textContent.match(regex);
            return match ? match[0] : null;
        }).filter(match => match !== null);

        if (result.length == 0) {
            throw new Error(`Header missing number of executions `);
        }

        return result[0].match(/\d+/)[0];
    } catch (error) {
        // Collect any errors that occur
        errors.push({ document: "must specify document id", error: error.message });
        return [];
    }

}

function getTableType(columnText) {
    if (columnText.includes("CONSUMABLE MATERIALS TABLE")) {
        return "consume";
    }
    return "traceable";
}


function getTraceableQuantityColumn(quantityColumn) {

    // const text = quantityColumn;
    // const regex = /^(.*?)\s*\([^)]*\)/; // Regex to match text outside brackets

    // const match = text.match(regex);
    // const extractedText = match ? match[1].trim() : text.trim();
    // let relevant = extractedText.split("=");
    // if (relevant.length == 2) {
    //     return relevant[1].trim();
    // } else {
    //     return "";
    // }

    // Regular expression to match the content within brackets
    const regex = /\(([^)]+)\)/;
    const match = quantityColumn.match(regex);
    console.log(match)

    if (match) {
        // Extract the matched group and split it by the dash to get the upper limit
        const limits = match[1].split('–');
        return limits[1].trim();
    }

    return ""; // Return empty string as error handlign will be done in extractFR


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
function extractCS(text, preferred, errors, table, rowNumber) {
    try {
        let matches = [];
        if (preferred) {
            // Regular expression pattern to match 'cs' or 'rm' followed by exactly 4 digits
            // if 'prefer' or any of its variations (like 'preferred' or 'preferring')
            // is found later in the string. The match is case-insensitive and global.
            const pattern = /(cs|rm)\d{4}(?=.*?prefer)/gi;
            matches = text.match(pattern);
            matches = matches ? [matches.map(match => match.toLowerCase())[matches.length - 1]] : [];
            return matches;
        } else {
            // Regular expression pattern to match 'cs' or 'rm' followed by 4 digits, case-insensitive
            const pattern = /(cs|rm)\d{4}/gi;
            matches = text.match(pattern);
            matches = matches ? matches.map(match => match.toLowerCase()) : [];
        }

        if (matches.length == 0) {
            let tableType = getTableType(table);
            let idType = tableType == "consume" ? "CS" : "RM";
            throw new Error(`Must contain at least 1 ${idType} id`);
        }

        return matches;
    } catch (error) {
        // Collect any errors that occur
        errors.push({ table: table, rowNumber: rowNumber, error: error.message });
        return [];
    }

}



function isValidNumber(value) {
    return !isNaN(value) && value.trim() !== "";
}

function extractQuantityAndUnit(input, errors, table, rowNumber) {
    try {
        console.log(input)
        console.log(JSON.stringify(input))
        // Regular expression to match all letters and separate them from non-letters
        const pattern = /([a-zA-Z]+)|([^a-zA-Z]+)/g;

        // Use match to extract all parts
        const matches = input.match(pattern);
        console.log(matches)

        //if null then input is empty string
        if (matches === null) {
            throw new Error("The Expected Quantity column must include both a valid quantity and a unit.");
        }

        let value = "";
        let unit = "";
        const validUnits = ["ea", "ft", "kg", "g"];

        matches.forEach(match => {
            if (/[a-zA-Z]/.test(match)) {
                unit += match;
            } else {
                value += match;
            }
        });

        // Trim both value and unit
        value = value.trim();
        unit = unit.trim();

        console.log(value)
        console.log(unit)
        console.log("++++++")
        if (unit.toLowerCase() == "asrequired") {//skip this
            return {
                quantity: null,
                unit: null
            };
        }

        // Check if unit is one of the valid units (case-insensitive)
        if (!validUnits.includes(unit.toLowerCase())) {
            throw new Error(`Invalid unit: ${unit}. Must be one of: ${validUnits.join(", ")}`);
        }

        let range = value.split("-");
        value = range.length == 1 ? range[0] : range[1];

        // Check if value is a valid number
        if (!isValidNumber(value)) {
            throw new Error("Expected quantity must contain a valid number.");
        }

        if (unit.toLowerCase() === 'g') {
            value = value / 1000; // Convert grams to kilograms
            unit = 'kg'; // Change unit to kilograms
        }

        return {
            quantity: value,
            unit: unit.toUpperCase()
        };

    } catch (error) {
        // Collect any errors that occur
        errors.push({ table: table, rowNumber: rowNumber, error: error.message });
        return { quantity: null, unit: null };
    }
}

/**
 * Extracts the description part of a given input string that precedes a specific pattern
 * and removes any trailing non-alphanumeric characters from the extracted description.
 *
 * The pattern to be matched is any sequence of characters (non-greedy) followed by 
 * either 'cs' or 'rm' (case-insensitive) and exactly four digits. The function extracts
 * the part of the string before this pattern, then removes any trailing characters that
 * are not letters or digits.
 *
 * @param {string} input - The input string containing the description and pattern.
 * @returns {string|null} - The cleaned description part of the input string, or "" if the pattern is not found.
 *
 * Example usage:
 * const input = "DAC, ReadyMate 500 with 1/2” HB (,cs1234";
 * const result = getDescription(input);
 * console.log(result); // Output: "DAC, ReadyMate 500 with 1/2” HB"
 */
function getDescription(input) {
    // Define the regular expression pattern to match the description part
    const pattern = /(.*?)(cs|rm)\d{4}/i;
    let match = pattern.exec(input);
    console.log(match);

    // If the pattern is matched, clean the description part
    return match ? match[1].replace(/[^a-zA-Z0-9]+$/, '').trim() : "";
    //no need to check for error here as it will be caught by consumable ot traceable column
}



function withMathEquations(column, select) {
    select('esxpression here', column)

}


function sanitizeRows(trNodes, select) {
    let rows = [];
    let FirstColumnMergeRestart = "";

    // Define the XPath expression for selecting w:vMerge nodes without w:val attribute
    const vMergeExpression = './/w:vMerge[not(@w:val)]';
    let rowCount = 0;
    trNodes.forEach((tr, index) => {
        // Check if the first column exists
        let firstColumn = select('w:tc', tr)[0];
        let firstColumnText = firstColumn ? firstColumn.textContent : "";

        // Check if the second column exists
        let secondColumn = index === 0 ? null : select('w:tc', tr)[1];
        let secondColumnText = secondColumn ? secondColumn.textContent : "";

        // Check if the current row contains w:vMerge nodes without w:val attribute
        const vMergeNodes = select(vMergeExpression, tr);

        if (vMergeNodes.length === 0) {
            rowCount += 1;
            FirstColumnMergeRestart = firstColumnText;
            rows.push({ rowNumber: rowCount, columns: [FirstColumnMergeRestart, secondColumnText] });
        } else {
            // Check if the second column contains w:vMerge nodes without w:val attribute
            let secondColumnMerge = select(vMergeExpression, secondColumn);
            if (secondColumnMerge.length === 0) {
                rows.push({ rowNumber: rowCount, columns: [FirstColumnMergeRestart, secondColumnText] });
            }
        }
    });

    console.log(rows);
    return rows;

}





















// function sanitizeRows(trNodes, select) {

//     // if row contains  w:vMerge wihtout w:val="restart" value then exclude it
//     let trNodes_of_interest = [];

//     trNodes.forEach(tr => {

//         // Define the XPath expression for selecting w:vMerge nodes without w:val attribute
//         const vMergeExpression = './/w:vMerge[not(@w:val)]';

//         // Select the w:vMerge nodes within the current w:tr node
//         const vMergeNodes = select(vMergeExpression, tr);

//         // Check if any w:vMerge nodes were found
//         if (vMergeNodes.length == 0) {
//             trNodes_of_interest.push(tr);
//         }
//     });
//     return trNodes_of_interest;

// }
const xl = require('excel4node');

function backgroundColor(bgc, wb) {
    // Define style with background color
    return wb.createStyle({
        fill: {
            type: 'pattern',
            patternType: 'solid',
            fgColor: bgc,
            bgColor: bgc,
        },
    });
}

module.exports = {
    convertToExcel: async function (data, documentIds) {
        console.log(documentIds);

        // Create a new instance of a Workbook class
        const wb = new xl.Workbook({
            defaultFont: {
                name: 'Aptos Narrow',
                size: 12,
            }
        });

        const options = {
            sheetView: {
                showGridLines: false // Hide gridlines on the entire workbook
            },
        }
        // Add Worksheets to the workbook
        const ws = wb.addWorksheet('Sheet 1', options);

        // Define a bold style
        const summaryStyle = wb.createStyle({
            font: {
                bold: true,
            },
            alignment: {
                horizontal: 'center', // Align text to the left horizontally
                vertical: 'center', // Center text vertically
            },
        });
        // Create a custom style larger bold text
        const customStyle = wb.createStyle({
            font: {
                size: 20,
            },
            alignment: {
                horizontal: 'left', // Align text to the left horizontally
                vertical: 'center', // Center text vertically
            },
        });

        ws.column(2).setWidth(32);

        let counts = {
            "BPR": 0,
            "MNWI": 0,
            "TWI": 0
        };

        for (let i = 0; i < documentIds.length; i++) {
            if (documentIds[i].startsWith("bpr")) {
                counts["BPR"]++;
            } else if (documentIds[i].startsWith("mnwi")) {
                counts["MNWI"]++;
            } else if (documentIds[i].startsWith("twi")) {
                counts["TWI"]++;
            }
        }

        // Merge cells A1 to C1 (3 columns, 1 row) with custom style
        ws.cell(2, 2, 2, 12, true) // (startRow, startCol, endRow, endCol, merge)
            .string('TechOps Slime file Summary')
            .style(customStyle);

        ws.cell(4, 2).string('BPR Document(s) Read            =').style(backgroundColor('#D86DCD', wb));
        ws.cell(4, 3)
            .number(counts["BPR"]).style(summaryStyle);

        ws.cell(6, 2).string('MNWI Document(s) Read           =').style(backgroundColor("#8ED973", wb));
        ws.cell(6, 3)
            .number(counts["MNWI"]).style(summaryStyle);

        ws.cell(8, 2).string('TWI Document(s) Read            =').style(backgroundColor("#F1A983", wb));
        ws.cell(8, 3)
            .number(counts["TWI"]).style(summaryStyle);

        ws.cell(10, 2).string('Total Number of Documents Read =').style(backgroundColor("#43AEE2", wb));
        ws.cell(10, 3)
            .number(documentIds.length).style(summaryStyle);


        let labels = ["CS# Number", "Consumable  Description", "Total Quantity", "Unit", "Document ID"]
        // let documentIds = ["BPR0001", "BPR0002", "MNWI0001", "TWI0001"]

        // Define a style with borders
        const tableCellStyles = wb.createStyle({
            border: {
                left: {
                    style: 'thin',
                    color: 'black'
                },
                right: {
                    style: 'thin',
                    color: 'black'
                },
                top: {
                    style: 'thin',
                    color: 'black'
                },
                bottom: {
                    style: 'thin',
                    color: 'black'
                }
            },
            alignment: {
                horizontal: 'center',
                vertical: 'center'
            }
        });
        //---------------table data----------------
        //table header
        ws.column(3).setWidth(32);
        ws.column(4).setWidth(20);
        ws.column(5).setWidth(15);
        // ws.column(6).setWidth(32 * documentIds.length);

        labels.forEach((label, i) => {
            const isLastIteration = i === labels.length - 1;
            if (isLastIteration) {
                //merge to match documentIds length
                ws.cell(12, 2 + i, 12, 2 + i + (documentIds.length - 1), true) // (startRow, startCol, endRow, endCol, merge)
                    .string(label).style(tableCellStyles);

                documentIds.forEach((docId, j) => {
                    ws.cell(13, 2 + i + j)
                        .string(docId).style(tableCellStyles);
                    ws.column(2 + i + j).setWidth(15);
                })

            } else {
                ws.cell(12, 2 + i, 13, 2 + i, true) // Merge cell from row 12 to row 13
                    .string(label).style(tableCellStyles);
            }

        })

        //table body
        data.forEach((entry, i) => {
            let csids = [...entry.preferred, ...entry.substitutes];
            let csidsString = csids.join(', ').toUpperCase();

            ws.cell(14 + i, 2)
                .string(csidsString).style(tableCellStyles);

            let description = entry.description.join(', ');
            ws.cell(14 + i, 3)
                .string(description).style(tableCellStyles);

            let quantity = entry.quantity;
            ws.cell(14 + i, 4)
                .number(quantity).style(tableCellStyles);

            let unit = entry.unit;
            ws.cell(14 + i, 5)
                .string(unit).style(tableCellStyles);

            //loop documentIds
            //if entry.doc_ids matches a documentId on iteration,put number in cell else blank

            documentIds.forEach((documentId, k) => {
                // Check if entry.doc_ids contains the documentId
                let doc = entry.doc_ids.find(doc => doc.doc_id === documentId);
                if (doc) {
                    ws.cell(14 + i, 6 + k)
                        .number(doc.quantity).style(tableCellStyles);
                } else {
                    ws.cell(14 + i, 6 + k)
                        .string("").style(tableCellStyles).style(backgroundColor("#ADADAD", wb));
                }

            });

        })

        // Write to file
        // wb.write('ExcelFile.xlsx');
        // return  wb.writeToBuffer(); // Return Excel buffer
        return wb; // Return Excel buffer


    }
}
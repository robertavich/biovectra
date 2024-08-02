const _ = require('lodash');
const helper = require("./tables");
const excel = require("./excel");

module.exports = {
    bom: async function (files, res) {

        let results = [];
        let documentIds = [];

        let errors = [];

        for (let i = 0; i < files.length; i++) {
            let documentId = extractDocumentId(files[i].originalname);
            let result = await helper.extractTableDataFromDocs(files[i], documentId, errors);
            results.push(result);
            documentIds.push(documentId);
        }

        if (errors.length > 0) {
            errors = _.uniqWith(errors, _.isEqual);
            console.log(errors);
            res.status(422).json({ errors: errors });
            return;
        }

        results = results.flat();
        console.dir(results, { depth: null });
        console.log("------------------------------------------");
        results = sumLikeIdsWithSameDocId(results);

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
        console.log("-----------------COMPUTED----------------");
        console.dir(computed, { depth: null });

        //convert data to excel document
        const wb = await excel.convertToExcel(computed, documentIds);
        wb.write('ExcelFile.xlsx', res);
    }
}

function sumLikeIdsWithSameDocId(data) {
    const grouped = _.groupBy(data, item => `${item.preferred}-${item.documentId}`);
    return _.map(grouped, (items) => {
        return {
            ...items[0],
            quantity: _.sumBy(items, item => parseFloat(item.quantity))
        };
    });
}

function isSubset(arr1, arr2) {
    return arr1.every(item => arr2.includes(item));
}

function extractDocumentId(text) {

    //if text has with or w/ ,split at that point and use left side.
    let matches = [];
    // Regular expression pattern to match 'cs' or 'rm' followed by 4 digits, case-insensitive
    const pattern = /(BPR|MNWI|TWI)\d{4}/gi;
    matches = text.match(pattern);
    matches = matches ? matches.map(match => match.toLowerCase()) : [];
    //throw an error if empty
    if (matches.length == 0) return "missing document ids";//missing document ids

    return matches[0].toLowerCase();
}


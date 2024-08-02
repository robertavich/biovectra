const _ = require('lodash');
const helper = require("./tables");

module.exports = {
    cb: async function (files, res) {

        let results = [];

        let errors = [];

        for (let i = 0; i < files.length; i++) {
            let result = await helper.extractTableDataFromDocs(files[i], errors);
            results.push(result);
        }
        results = results.flat();

        // if (errors.length > 0) {
        //     errors = _.uniqWith(errors, _.isEqual);
        //     console.log(errors);
        //     res.status(422).json({ errors: errors });
        //     return;
        // }

        // results = results.flat();
        // console.dir(results, { depth: null });
    }
}
const record = {
    _id: "65df187f5139a25769bbe054",
    content: {
        "nom": "anas",
        "adresse": "107 avenue des F.A.R fes",
        "âge": "23",
        "Code Postal": "30000",
        "e-mail": "anaselbtioui73@gmail.com"
    },
    metadata: {
        tableId: "65df16a2c6c49c3309f3faac"
    }
}

const table = {
    _id: "65df16a2c6c49c3309f3faac",
    content: {
        title: "<INPUT HERE>"
    },
    metadata: {
        smartTables: [
            "65df2952cf2f408e88b4e4ec",
            "65df296267f6b47a08ae9719",
            "65df296b28814ff3345a940e"
        ],
        labels: [
            "65e6eade20f6218f2133b69a",
            "65e6eaeccabde2b2e0ddd65d",
            "65e6eaf3b31a86c6896d10d0"
        ]
    }
}

const label = {
    _id: "65e6eaf3b31a86c6896d10d0",
    content: {
        title: "name",
    },
    metadata: {
        type: "string",
        keyId: "65e6eb199e5470792abf0ade",
    }
}

const key = {
    _id: "65e6eb199e5470792abf0ade",
    content: {
        title: "a",
    },
    metadata: {
        type: "all"
    }
}

const smartTable = {
    _id: "65df296b28814ff3345a940e",
    content: {
        title: "<INPUT HERE>"
    },
    metadata: {
        skeletonTableId: "65df16a2c6c49c3309f3faac",
        collections: [
            "65df29f5d71145a2ab5fb334",
            "65df29fab95a4538923755fa"
        ]
    }
}

const collection = {
    _id: "65df29f5d71145a2ab5fb334",
    content: {
        title: "<INPUT HERE>"
    },
    metadata: {}
}

// linking
const req = {
    "tableId": "65df16a2c6c49c3309f3faac",
    "labelId": "65e6eaf3b31a86c6896d10d0",
}



// linking flow
// select a table
// (input validation) check whether the selected label belong to the selected table (selected table metadata)
// is it necessary to check the labels against the db?
// if we select the table; we automatically extract the labels, and keep them in memory?
// or we select the table; and we display the labels based on the selected table metadata, then select the label.
// so it is not necessary to check the labels whether they belong to the table or not?

// check: does the table has a key? (selected label metadata)
const { EOL, END_OF_FILE } = require('os');
const fs = require("fs");
const path = require("path");
const DATA_PATH = "data";
const OUTPUT_PATH = "out";
const directoryPath = path.join(__dirname, DATA_PATH);
const outputPath = path.join(__dirname, OUTPUT_PATH);
const EOF_MESSAGE = "End of file";
const PARSER_STATE_ENUM = {
    START_FILE: "START_FILE",
    END_OF_LINE: "END_OF_LINE",
    END_OF_FILE: "END_OF_FILE",
    HEADER_ROW_START: "HEADER_ROW_START",
    HEADER_ROW_READ: "HEADER_ROW_READ",
    HEADER_ROW_END: "HEADER_ROW_END",
    DATA_ROW_START: "DATA_ROW_START",
    DATA_ROW_READ: "DATA_ROW_READ",
    DATA_ROW_END: "DATA_ROW_END",
    DELIMETER: "DELIMETER",
    NON_DELIMETER: "NON_DELIMETER"
}

const nullvalue = null;

const TCODE_CASH_ACCOUNTING_VAT = 1;
const TCODE_BANK_CHARGES = 2;
const TCODE_ACCOUNTANCY = 3;
const TCODE_OTHER = 4;
const TCODE_CORPORATION_TAX = 5;
const TCODE_VAT_PAYMENT = 6;
const TCODE_PAYE_OR_NIC = 7;
const TCODE_LOAN_PAYMENTS = 8;
const TCODE_FIXED_ASSET_PURCHASES = 9;
const TCODE_RULE_COMMENT = -1;

const EXCLUDE_IF_ROW = [{
    column: 3,
    comparator: "gt",
    value: 0 
}];

const COLUMNS = {
    DATE: 0,
    DETAILS:  1,
    TRANSACTION_TYPE: 2,
    IN: 3,
    OUT: 4,
    BALANCE: 5
}

const OUTPUT_COLUMNS = {
    DATE:                       { outputColumn: 0, inputColumn: 0 },
    DETAILS:                    { outputColumn: 1, inputColumn: 1 },
    BANK_1:                     { outputColumn: 2, inputColumn: 4},
    BANK_2:                     { outputColumn: 3, nullvalue },
    BANK_3:                     { outputColumn: 4, nullvalue },
    ER:                         { outputColumn: 5, nullvalue },
    CASH_ACCOUNTING_VAT:        { outputColumn: 6, tcode: TCODE_CASH_ACCOUNTING_VAT, inputColumn: 4 },
    BANK_CHARGES:               { outputColumn: 7, tcode: TCODE_BANK_CHARGES, inputColumn: 4 },
    EXPENSE_10:                 { outputColumn: 8, nullvalue },
    ACCOUNTANCY:                { outputColumn: 9, tcode: TCODE_ACCOUNTANCY, inputColumn: 4 },
    OTHER_USE:                  { outputColumn: 10, tcode: TCODE_OTHER, inputColumn: 4 },
    CORPORATION_TAX:            { outputColumn: 11, tcode: TCODE_CORPORATION_TAX, inputColumn: 4 },
    VAT_PAYMENT:                { outputColumn: 12, tcode: TCODE_VAT_PAYMENT, inputColumn: 4 },
    UNUSED:                     { outputColumn: 13, nullvalue },
    PAYE_OR_NIC:                { outputColumn: 14, tcode: TCODE_PAYE_OR_NIC, inputColumn: 4 },
    LOAN_PAYMENTS:              { outputColumn: 15, tcode: TCODE_LOAN_PAYMENTS, inputColumn: 4 },
    FIXED_ASSET_PURCHASES:      { outputColumn: 16, tcode: TCODE_FIXED_ASSET_PURCHASES, inputColumn: 4 },
    COMMENTS:                   { outputColumn: 17, tcode: TCODE_OTHER, ruleValue: 'comment'  },
    TCODE:                      { outputColumn: 18, contextValue: 'tcode' }
}

const TCODE_OUT_RULES = [
    { 
        ruleName: "amazon",
        column: COLUMNS.DETAILS,
        rule: /(AMZNMKTPLACE|amazon)/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "laptopcity",
        column: COLUMNS.DETAILS,
        rule: /LAPTOP CITY/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "budgetoffices",
        column: COLUMNS.DETAILS,
        rule: /Budget Offices/gmi,
        tCode: TCODE_OTHER,
        comment: 'office rental'
    },
    { 
        ruleName: "mcafee",
        column: COLUMNS.DETAILS,
        rule: /MCAFEE/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "dropbox",
        column: COLUMNS.DETAILS,
        rule: /Dropbox/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "redber",
        column: COLUMNS.DETAILS,
        rule: /REDBER COFFEE ROASTERS/gmi,
        tCode: TCODE_OTHER,
        comment: 'coffee'
    },
    { 
        ruleName: "argos",
        column: COLUMNS.DETAILS,
        rule: /ARGOS/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "aws",
        column: COLUMNS.DETAILS,
        rule: /AWS EMEA/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "ebay",
        column: COLUMNS.DETAILS,
        rule: /ebay/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    {
        ruleName: "microsoft",
        column: COLUMNS.DETAILS,
        rule: /Microsoft/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    {
        ruleName: "xmind",
        column: COLUMNS.DETAILS,
        rule: /XMIND LTD/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    {
        ruleName: "screwfix",
        column: COLUMNS.DETAILS,
        rule: /SCREWFIX/gmi,
        tCode: TCODE_OTHER,
        comment: 'computer equipment'
    },
    { 
        ruleName: "corporation_tax",
        column: COLUMNS.DETAILS,
        rule: /HMRC Shipley/gmi,
        tCode: TCODE_CORPORATION_TAX
    },
    {
        ruleName: "directors_loan",
        column: COLUMNS.DETAILS,
        rule: /Emma Benger-Stevenson BPMGROUPLTD/gmi,
        tCode: TCODE_PAYE_OR_NIC
    },
    {
        ruleName: "directors_loan",
        column: COLUMNS.DETAILS,
        rule: /CHARLES BENGER-STEVENSON The BPM Group/gmi,
        tCode: TCODE_PAYE_OR_NIC
    }
]

const DELIMETER = ",";

const analyzeTCode = (row) => {
    for(let i=0; i<TCODE_OUT_RULES.length; i++){
        const rule = TCODE_OUT_RULES[i];
        if(row.values[rule.column].match(rule.rule)){
            row['tcode'] = rule.tCode;
            row['rule'] = rule.ruleName;
            break;
        }
    }
}

const getTCodeOutRuleByName = (name) => TCODE_OUT_RULES.filter(rule => rule.ruleName === name)[0];

const getFullFilePath = (file) => path.join(directoryPath, file);

const readByte = (context) => {
    const BUFFER_LENGTH = 1;
    const BUFFER_OFFSET = 0;
    const FILE_POSITION = -1;
    const buffer = Buffer.alloc(BUFFER_LENGTH);
    let result = fs.readSync(context.fd, buffer, BUFFER_OFFSET, BUFFER_LENGTH, FILE_POSITION);
    if(result === 0) throw new Error("End of file");
    return (buffer.toString('utf8', 0, BUFFER_LENGTH));
};

const startFile = (context) => {
    filePath = getFullFilePath(context.file);
    context.fd = fs.openSync(filePath, "r");
    context.state = PARSER_STATE_ENUM.HEADER_ROW_START;
}

const headerRowStart = (context) => {
    const firstByte = readByte(context);
    if (firstByte === DELIMETER) {
        context.headers.push({
            header: ""
        });
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.DELIMETER;
    } else {
        context.readBuffer.push(firstByte);
        context.state = PARSER_STATE_ENUM.HEADER_ROW_READ;
    }
}

const headerRowRead = (context) => {
    const nextByte = readByte(context);
    if (nextByte === DELIMETER) {
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.DELIMETER;
    } else if (nextByte === EOL) {
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.END_OF_LINE;
    } 
    else {
        context.readBuffer.push(nextByte);
        context.state = PARSER_STATE_ENUM.HEADER_ROW_READ;
    }
}

const headerRowEnd = (context) => {
    context.state = PARSER_STATE_ENUM.DATA_ROW_START;
}

const dataRowStart = (context) => {
    let firstByte;
    try {
        firstByte = readByte(context);
    } catch (e) {
        context.state = PARSER_STATE_ENUM.END_OF_FILE;
        return;
    }
    context.rows.push({ values: [] });
    if (firstByte === DELIMETER) {
        context.headers.push({
            header: ""
        });
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.DELIMETER;
    } else if (firstByte === END_OF_FILE) {
        context.state = PARSER_STATE_ENUM.END_OF_FILE;
    } else {
        context.readBuffer.push(firstByte);
        context.state = PARSER_STATE_ENUM.DATA_ROW_READ;
    }
}

const dataRowEnd = (context) => {
    context.state = PARSER_STATE_ENUM.DATA_ROW_START;
}

const dataRowRead = (context) => {
    let nextByte;
    try {
        nextByte = readByte(context);
    } catch (e) {
        console.log(e);
        context.state = PARSER_STATE_ENUM.END_OF_FILE;
        return;
    }
    if (nextByte === DELIMETER) {
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.DELIMETER;
    } else if (nextByte === EOL) {
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.END_OF_LINE;
    } 
    else {
        context.readBuffer.push(nextByte);
        context.state = PARSER_STATE_ENUM.DATA_ROW_READ;
    }
}

const delimeter = (context) => {
    if(context.previousState === PARSER_STATE_ENUM.HEADER_ROW_READ){
        context.headers.push({
            header: context.readBuffer.join("")
        });
        context.readBuffer = [];
    } else if (context.previousState === PARSER_STATE_ENUM.DATA_ROW_READ) {
        context.rows[context.rows.length -1].values.push(context.readBuffer.join(""));
        context.readBuffer = [];
    }
    context.state = context.previousState;
}

const endOfLine = (context) => {
    if(context.previousState === PARSER_STATE_ENUM.HEADER_ROW_READ){
        context.headers.push({
            header: context.readBuffer.join("")
        });
        context.readBuffer = [];
        context.previousState = context.state;
        context.state = PARSER_STATE_ENUM.HEADER_ROW_END;
    } else if (context.previousState === PARSER_STATE_ENUM.DATA_ROW_READ){
        context.state = PARSER_STATE_ENUM.DATA_ROW_END;
        context.rows[context.rows.length -1].values.push(context.readBuffer.join(""));
        context.readBuffer = [];
        analyzeTCode(context.rows[context.rows.length-1]);
    }
}

const getNumberOfOutputColumns = () => {
    return Object.values(OUTPUT_COLUMNS).reduce((a,b) => b > a ? b : a,0);
}

const deleteOutputFileIfExists = (path) => {
    if(fs.existsSync(path)) fs.unlinkSync(path);
}

const createOutputFile = (context) => {
    const outputFilePath = `${outputPath}/${context.month}${context.year}`;
    deleteOutputFileIfExists(outputFilePath);
    const outputFile = fs.openSync(outputFilePath, 'a');
    context.outputFileHandle = outputFile;
}

const writeOutputHeaderRow = (context) => {

    const outputColumnCount = getNumberOfOutputColumns();
    context.outputColumnCount = outputColumnCount;
    let outputColumns = Array.from({ length: outputColumnCount }, (x, i) => '');
    for (const [key, value] of Object.entries(OUTPUT_COLUMNS)) {
        outputColumns[value.outputColumn] = key;
    };
    fs.writeFileSync(context.outputFileHandle, `${outputColumns.join(",")}\n`);

}

const writeOutputDataRow = (context, row) => {
    
    let outputColumns = Array.from({ length: context.outputColumnCount }, (x, i) => '');
    Object.values(OUTPUT_COLUMNS).forEach(value => {
        if(value.contextValue){
            outputColumns[value.outputColumn] = row[value.contextValue];    
        } else if (value.nullvalue) {
            outputColumns[value.outputColumn] = nullvalue;
        } else if (value.tcode){
            if(row.tcode === value.tcode){
                if(value.inputColumn){
                    outputColumns[value.outputColumn] = row.values[value.inputColumn];
                } else if (value.ruleValue) {
                    const rule = getTCodeOutRuleByName(row.rule);
                    console.log(row);
                    outputColumns[value.outputColumn] = rule[value.ruleValue];
                }
            }
        }
        else {
            outputColumns[value.outputColumn] = row.values[value.inputColumn];
        }
    });
    
    fs.writeFileSync(context.outputFileHandle, `${outputColumns.join(",")}\n`);

}

const excludeRow = (row) => {
    let exclude = false;
    EXCLUDE_IF_ROW.forEach(rule => {
        switch(rule.comparator){
            case "gt":
                exclude = row.values[rule.column] > rule.value;
                break;
            default:
                throw new Error("Unknown comparator");
        }
    });
    return exclude;
}

const writeOutputDataRows = (context) => {

    context.rows.forEach(row => {
        if(!excludeRow(row)){
            writeOutputDataRow(context, row);
        }
    });

}

const writeOutputFile = (context) => {
    
    createOutputFile(context);
    writeOutputHeaderRow(context);
    writeOutputDataRows(context);

}

function ParserState (initialState = PARSER_STATE_ENUM.START_FILE) {
    
    const dispatchTable = {
        START_FILE: startFile,
        HEADER_ROW_START: headerRowStart,
        HEADER_ROW_READ: headerRowRead,
        HEADER_ROW_END: headerRowEnd,
        DATA_ROW_START: dataRowStart,
        DATA_ROW_READ: dataRowRead,
        DATA_ROW_END: dataRowEnd,
        DELIMETER: delimeter,
        END_OF_LINE: endOfLine
    }

    this.context =  {
        file: "",
        month: "",
        year: "",
        fd: 0,
        position: 0,
        state: initialState,
        previousState: "",
        readBuffer: [],
        headers: [],
        rows: []
    }

    this.execute = () => {
        dispatchTable[this.context.state](this.context);
    }

}

const getMonthFromFileName = (fileName) => fileName.split("_")[2];
const getYearFromFileName = (fileName) => fileName.split("_")[3];

const parseCSVFile = (fileName) => {

    const parserState = new ParserState();
    parserState.context.file = fileName;
    parserState.context.month = getMonthFromFileName(fileName);
    parserState.context.year = getYearFromFileName(fileName);
    while(parserState.context.state!=PARSER_STATE_ENUM.END_OF_FILE){
        if(!parserState.context.state) process.exit(0);
        parserState.execute();
    }
    writeOutputFile(parserState.context);
}

const enumerateDataFiles = (path = "data") => {
    fs.readdir(directoryPath, function (err, files) {
        
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        
        files.forEach(function (file) {
            console.log(file);
            parseCSVFile(file);

        });

    });
}

console.log("Starting");
enumerateDataFiles();
//parseCSVFile("Transactions_Export_Aug_2022_37511919.csv");
console.log("Finished");
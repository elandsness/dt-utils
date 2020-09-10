/*
********************************************************
*                                                      *
*  This script requires Google Apps Script associated  *
*  with a Google Sheet in order to function.           *
*                                                      *
********************************************************
*/

// build menu and add to ui
function onOpen(e) {
  var ui = SpreadsheetApp.getUi(); // Reference to the SpreadsheetApp UI
  var menu = ui.createMenu('Dynatrace');
  menu.addItem('Setup', 'setupSheets');
  menu.addItem('USQL API (Supply Query)', 'fetchUSQL');
  menu.addItem('Simple API (Supply Path)', 'fetchSimple');
  menu.addToUi();
}

function setupSheets() {
  // get all the sheets in the spreadsheet
  // spreadsheet object
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = spreadsheet.getSheets();
  // rename the existing sheets
  for (var x = 0; x < sheets.length; x++) {
    sheets[x].setName('delete' + x);
  }
  // insert two new sheets, oone for data and one for config
  spreadsheet.insertSheet('Data', 0);
  spreadsheet.insertSheet('Config', 1);
  // delete the old sheets
  for (var x = 0; x < sheets.length; x++) {
    spreadsheet.deleteSheet(sheets[x]);
  }
  // set up the config sheet
  var config_sheet = spreadsheet.getSheetByName('Config');
  config_sheet.getRange(1, 1, 1, 3).setValues([['tenant id', 'api key', 'query/path']]);
}

function fetchUSQL(){
  // Store some config in variables
  // spreadsheet object
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // data sheet
  var data_sheet = spreadsheet.getSheetByName('Data');
  // config sheet
  var config_sheet = spreadsheet.getSheetByName('Config');
  // tenant
  var tenant = config_sheet.getRange(2, 1).getValue();
  // api key
  var api_key = config_sheet.getRange(2, 2).getValue();
  // query
  var usql_query = config_sheet.getRange(2, 3).getValue();
  
  // fetch the data
  var headers = { 'Authorization': 'Api-Token ' + api_key }
  var url = 'https://' + tenant + '.sprint.dynatracelabs.com/api/v1/userSessionQueryLanguage/table?query=' + usql_query;
  var result = UrlFetchApp.fetch(encodeURI(url), {'headers': headers});
  result = JSON.parse(result);
  
  // build the output
  // multi-dimentional array to write data to sheet. Each array in the array represents a row, and each element a column
  // EXAMPLE: The array [[a,b,c][1,2,3][4,5,6]] would produce the following sheet
  // a | b | c
  // 1 | 2 | 3
  // 4 | 5 | 6
  var data = [];
  // add the headers
  data.push(result.columnNames);
  // loop through the data and add to the array
  for (var x = 0; x < result.values.length; x++) {
    data.push(result.values[x]);
  }
  
  // clear any existing data
  if (data_sheet.getLastRow() > 0 && data_sheet.getLastColumn() > 0){
    data_sheet.getRange(1, 1, data_sheet.getLastRow(), data_sheet.getLastColumn()).clear();
  }
  
  // write the data to the sheet
  data_sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

function fetchSimple() {
  // Store some config in variables
  // spreadsheet object
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // data sheet
  var data_sheet = spreadsheet.getSheetByName('Data');
  // config sheet
  var config_sheet = spreadsheet.getSheetByName('Config');
  // tenant
  var tenant = config_sheet.getRange(2, 1).getValue();
  // api key
  var api_key = config_sheet.getRange(2, 2).getValue();
  // path
  var path = config_sheet.getRange(2, 3).getValue();
  
  // fetch the data
  var headers = { 'Authorization': 'Api-Token ' + api_key }
  var url = 'https://' + tenant + '.sprint.dynatracelabs.com' + path;
  var result = UrlFetchApp.fetch(encodeURI(url), {'headers': headers});
  result = JSON.parse(result);
  // build the output
  var data = [];
  
  // determine if the results are tucked away in a property or just at the root of the response
  var r = result;
  if (!Array.isArray(result)){
    // find the array. just snagging the first instance of an array. can certainly be improved upon
    var k = Object.keys(result);
    // some APIs return the data in a result object. see if that's the case and move down a level if it is
    if (k.indexOf('result') > -1){
      r = result.result;
      k = Object.keys(result);
    }
    for (var x = 0; x < k.length; x++) {
      if (Array.isArray(result[k[x]])){
        r = result[k[x]];
        break;
      }
    }
  }
  Logger.log(r)
  // add the headers
  var keys = Object.keys(r[0]);
  data.push(keys);
  // loop through the results and build the rows
  for (var x = 0; x < r.length; x++) {
    var tmp = [];
    for (var y = 0; y < keys.length; y++){
      // make objects prettier
      var tmp_value = r[x][keys[y]] instanceof Object ? JSON.stringify(r[x][keys[y]]).substring(0, 50000) : r[x][keys[y]];
      tmp.push(tmp_value);
    }
    data.push(tmp);
  }
  
  // clear any existing data
  if (data_sheet.getLastRow() > 0 && data_sheet.getLastColumn() > 0){
    data_sheet.getRange(1, 1, data_sheet.getLastRow(), data_sheet.getLastColumn()).clear();
  }
  
  // write the data to the sheet
  data_sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

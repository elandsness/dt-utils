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
  menu.addItem('Synthetic usage report', 'synthetic_usage_report');
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
  config_sheet.getRange(1, 1, 1, 3).setValues([['Tenant ID', 'API Key', 'Cost per Action']])
    .setBackground('#0d7aba').setFontColor('#ffffff');
  config_sheet.getRange(2, 1, 1, 3).setValues([['abc1234', 'SuP3rSecr3tKey!', '1.99']])
    .setBackground('#ffffff').setFontColor('#0d7aba');
  config_sheet.deleteColumns(4, config_sheet.getMaxColumns() - 3);
  config_sheet.deleteRows(3, config_sheet.getMaxRows() - 2);
  config_sheet.setColumnWidth(1, 100).setColumnWidth(2, 250).setColumnWidth(3, 100);
  config_sheet.getRange(2, 3).setNumberFormat("$0.00000");
}


// synthetic usage report
function synthetic_usage_report() {
  // reference to the current spreadsheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // get the tenant and api key
  var config_sheet = spreadsheet.getSheetByName('Config');
  var dt_tenant = config_sheet.getRange(2, 1).getValue();
  var dt_api_key = config_sheet.getRange(2, 2).getValue();
  
  // used to store data before writing to sheet
  var data = [];
  
  // fetch the mem used timeseries
  var url = 'https://' + dt_tenant + '.live.dynatrace.com/api/v1/synthetic/monitors?Api-Token=' + dt_api_key;
  var result_monitors = UrlFetchApp.fetch(url, {'headers': {'accept': 'application/json'}});
  result_monitors = JSON.parse(result_monitors);
 
  // loop through the results and write them to an array
  var tests = []; // to store the test ids
  for (var x in result_monitors.monitors) {
    tests.push(result_monitors.monitors[x].entityId);
  }
  
  // loop through the tests and get the details
  var monitors = []; // to store active monitor details
  var d_monitors = []; // to store disabled monitor details
  for (var x in tests){
    url = 'https://' + dt_tenant + '.live.dynatrace.com/api/v1/synthetic/monitors/' + tests[x] + '?Api-Token=' + dt_api_key;
    var result_monitor = UrlFetchApp.fetch(url, {'headers': {'accept': 'application/json'}});
    result_monitor = JSON.parse(result_monitor);
    var monitor = {};
    monitor.name = result_monitor.name;
    monitor.enabled = result_monitor.enabled;
    monitor.frequencyMin = result_monitor.frequencyMin;
    if (result_monitor.tags.length < 1) {
      monitor.tags = '';
    } else {
      var tags = [];
      for (var y in result_monitor.tags){
        tags.push(result_monitor.tags[y].key);
      }
      monitor.tags = tags.join(', ');
    }
    try{
      monitor.steps = result_monitor.events.length;
    } catch(e) {
      monitor.steps = 1;
    }
    monitor.type = result_monitor.type == 'HTTP' ? 'HTTP' : monitor.steps > 1 ? 'Browser Clickpath' : 'Browser';
    
    monitor.locations = result_monitor.locations.length;
    monitor.steps_per_year = (((365*24*60)/result_monitor.frequencyMin) * monitor.steps) * result_monitor.locations.length;
    var dt_url; // link to test in Dynatrace
    if (result_monitor.type == 'HTTP'){
      dt_url = 'https://' + dt_tenant + '.live.dynatrace.com/#httpcheckdetails;id=' + result_monitor.entityId;
    } else {
      dt_url = 'https://' + dt_tenant + '.live.dynatrace.com/#monitordetailkpm;webcheckId=' + result_monitor.entityId;
    }
      
    if (monitor.enabled){
      monitors.push(['=HYPERLINK("' + dt_url + '", "' + monitor.name + '")', monitor.tags, monitor.steps_per_year, monitor.frequencyMin, monitor.steps, monitor.locations, monitor.type, monitor.enabled]);
    } else {
      d_monitors.push(['=HYPERLINK("' + dt_url + '", "' + monitor.name + '")', monitor.tags, monitor.steps_per_year, monitor.frequencyMin, monitor.steps, monitor.locations, monitor.type, monitor.enabled, 'n/a']);
    }
  }
  
  // write to the sheet
  var sheet = spreadsheet.getSheetByName('Data');
  sheet.clear();
  try{
    sheet.getFilter().remove();
  } catch(e) {
    Logger.log('No . existing filter in place');
  }
  sheet.getRange(1, 1, 1, 9).setValues([['Test Name', 'Tags', 'Actions per Year', 'Frequency(Min)', 'Actions', 'Locations', 'Type', 'Active', 'Cost per Year']]).setFontColor('#ffffff').setBackground('#0b5394').setFontWeight('bold');
  sheet.getRange(2,1,monitors.length,8).setValues(monitors);
  sheet.getRange(2, sheet.getLastColumn()).setFormula("=C2*Config!$C$2").copyTo(sheet.getRange(2, sheet.getLastColumn(), monitors.length, 1));
  sheet.getRange(2, sheet.getLastColumn(), monitors.length, 1).setNumberFormat("$0.00");
  sheet.getRange(1, 1, monitors.length + 1, sheet.getLastColumn()).createFilter();
  var inactive_fg = '#5e5e5e', inactive_bg = '#d3d3d3';
  if (d_monitors.length > 0){
    sheet.getRange(monitors.length + 3, 1).setValue('INACTIVE').setFontColor(inactive_fg).setBackground(inactive_bg);
    sheet.getRange(monitors.length + 4, 1, d_monitors.length, 9).setFontColor(inactive_fg).setBackground(inactive_bg).setValues(d_monitors);
  }
  sheet.autoResizeColumn(1).setColumnWidths(2, 8, 135);
}

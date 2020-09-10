/*
********************************************************
*                                                      *
*  This script requires Google Apps Script associated  *
*  with a Google Sheet in order to function.           *
*                                                      *
********************************************************
*/

function onOpen() {
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
      .createMenu('Dynatrace')
      .addItem('Store Credentials', 'storeCredentials')
      .addItem('Run Report', 'run_report')
      .addItem('Email Selected Report', 'spreadsheet2pdf')
      .addToUi();
}

function storeCredentials() {
  const UI = SpreadsheetApp.getUi(); // reference to the Spreadsheet's ui
  const TENANT = UI.prompt("Tenant","Please supply the FULL tenant URL for your Dynatrace tenant and hit OK. Hit CANCEL to skip.", UI.ButtonSet.OK_CANCEL);
  if (TENANT.getResponseText() != null && TENANT.getSelectedButton() == UI.Button.OK){
    // Tenant supplied and ok button clicked
    let tenant = TENANT.getResponseText().slice(-1) == '/' ? TENANT.getResponseText().slice(0,-1) : TENANT.getResponseText();
    PropertiesService.getScriptProperties().setProperty('tenant', tenant);
  }
  const KEY = UI.prompt("API Token","Please supply an API Token with topology read permissions and hit OK. Hit CANCEL to skip.", UI.ButtonSet.OK_CANCEL);
  if (KEY.getResponseText() != null && KEY.getSelectedButton() == UI.Button.OK){
    // Key supplied and ok button clicked
    PropertiesService.getScriptProperties().setProperty('key', KEY.getResponseText());
  }
}

function spreadsheet2pdf(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("To?","Please supply an email address or comma delimited list of email addresses and hit OK", ui.ButtonSet.OK_CANCEL);
  if (r.getResponseText() != '' && r.getSelectedButton() == ui.Button.OK){
    // got an email address, so good to continue
    const sheet = SpreadsheetApp.getActiveSheet();
    const url = 'https://docs.google.com/spreadsheets/d/SS_ID/export?'.replace('SS_ID', ss.getId());
    const exportOptions =
        'exportFormat=pdf&format=pdf' + // export as pdf
          '&size=letter' + // paper size letter
            '&portrait=true' + // orientation, portrait
              '&fitw=true&source=labnol' + // fit to page width
                '&sheetnames=false&printtitle=false' + // hide optional headers and footers
                  '&pagenumbers=false&gridlines=false' + // hide page numbers and gridlines
                    '&fzr=true' + // do not repeat row headers (frozen rows) on each page
                      '&gid='; // the sheet's Id
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url + exportOptions + sheet.getSheetId(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const blob = response.getBlob().setName(`Dynatrace Licence Report - ${sheet.getName()}.pdf`);

    // send the email
    const subject = "Dynatrace Host Utilization Report";
    let body = "Attached is the Host Utilization report that you requested. Thanks!<br /><br />-Dynatrace";
    GmailApp.sendEmail(r.getResponseText(), subject, body, {
      htmlBody: body,
      attachments: [blob]
    });
    ui.alert("Email Sent!");
  }
}

function fetch_data() {
  const UI = SpreadsheetApp.getUi(); // Spreadsheet UI
  const PROPS = PropertiesService.getScriptProperties(); // Script properties
  let data = {}; // for storing data to be written to the sheet
  const TENANT = PROPS.getProperty('tenant'); // Tenant URL
  const KEY = PROPS.getProperty('key'); // API Key

  // if the tenant or url are empty, terminate execution and alert the user
  if (!TENANT || !KEY){
    UI.alert("Please be sure to configure your tenant and api key before running this report!");
    return 'fail';
  }
  
  // fetch the metrics for the last
  const TS_URL = `${TENANT}/api/v2/metrics/query?`;
  const MET_SEL = [
    'metricSelector=builtin:host.cpu.usage:names',
    'metricSelector=builtin:host.mem.usage',
    'metricSelector=builtin:host.disk.usedPct:merge(1)',
    'metricSelector=builtin:host.cpu.usage:fold,builtin:host.mem.usage:fold,builtin:host.disk.usedPct:fold:merge(1)'
  ];
  for (var x = 0; x < MET_SEL.length; x++){
    let response = UrlFetchApp.fetch(TS_URL + MET_SEL[x] + '&pageSize=300&from=now-2w&resolution=1d', {'headers':{'Authorization': 'Api-Token ' + KEY},'muteHttpExceptions': true});
Logger.log(response);
    response = JSON.parse(response);
    data = processResponse(response, data);
    let more_metrics = response.nextPageKey;
    while(more_metrics != null){
      response = UrlFetchApp.fetch(TS_URL + 'nextPageKey=' + more_metrics, {'headers':{'Authorization': 'Api-Token ' + KEY},'muteHttpExceptions': true});
      Logger.log(response);
      response = JSON.parse(response);
      data = processResponse(response, data);
      more_metrics = response.nextPageKey;
    }
  }
  return data;
}

function processResponse(response, data) {
  // loop through and grab the hostnames and add entries for all the hosts
  for (const I of response.result){
    if (I.metricId.slice(-6) == ':names'){
      // grab the hostnames
      for (const X of I.data){
        data[X.dimensions[1]] = {};
        data[X.dimensions[1]].hostname = X.dimensions[0];
        // remove the host name after grabbing it to make things consistent
        X.dimensions.splice(0,1);
      }
      // get rid of the ':names' decoration to make life easier later
      I.metricId = I.metricId.slice(0,-6);
    }
  }
  // loop throught the response and build out the data array
  for (const I of response.result){
    for (const X of I.data){
      if (!data.hasOwnProperty(X.dimensions[0])){
        // create an entry if one doesn't exist
        data[X.dimensions[0]] = {};
      }
      data[X.dimensions[0]][I.metricId.replace(':merge(1)', '')] = X.values;
    }
  }
  return data;
}

function run_report() {
  const SS = SpreadsheetApp.getActiveSpreadsheet(); // reference to active spreadsheet
  const UI = SpreadsheetApp.getUi(); // reference to UI
  const PROPS = PropertiesService.getScriptProperties(); // Script properties
  const TENANT = PROPS.getProperty('tenant'); // Tenant URL
  const LOGO_URL = 'https://turtleti.me/dt_logo.png'; // URL to logo image
  // Create a fresh new sheet to store the report
  const SHEET_NAME = Utilities.getUuid();
  SS.insertSheet(0).setName(SHEET_NAME);
  const DATA = fetch_data();
  if (DATA == 'fail'){
    // don't have tenant and api key set, so terminate silently, since user already got alert
    return;
  }
  if (typeof DATA != 'object'){
    // no data, so alert and fail
    UI.alert("Something Happened! There's no data available! Please verify that your tenant and key are correct and that there are monitored hosts.");
    return;
  }
  // build the report
  const SHEET = SS.getSheetByName(SHEET_NAME); // reference to our report sheet
  SHEET.insertImage(LOGO_URL, 1, 1); // add a logo up top
  const DATA_HEADERS = [['Host ID/Link','Hostname','CPU Usage','CPU Trend','Mem Usage','Mem Trend','Disk Usage','Disk Trend']];
  SHEET.getRange(4, 1, 1, DATA_HEADERS[0].length)
    .setValues(DATA_HEADERS)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontSize(11);
  let d = []; // build an array to write to the sheet
  let row = 5; // for tracking the current row of data
  for (const I in DATA){
     try {
      let tmp = [
        '=HYPERLINK("'+TENANT+'/#newhosts/hostdetails;id='+I+'","'+I+'")',
        DATA[I].hostname,
          parseFloat(DATA[I]['builtin:host.cpu.usage:fold']).toFixed(2) / 100,
            '=SPARKLINE(OFFSET(D'+row+',0,5,1,' + DATA[I]['builtin:host.cpu.usage'].length + '), {"charttype","line";"linewidth",2;"color","#6f2da8";"empty","ignore";"ymin",0;"ymax",100})',
              parseFloat(DATA[I]['builtin:host.mem.usage:fold']).toFixed(2) / 100,
                '=SPARKLINE(OFFSET(F'+row+',0,' + (3 + DATA[I]['builtin:host.cpu.usage'].length) + ',1,' + DATA[I]['builtin:host.mem.usage'].length + '), {"charttype","line";"linewidth",2;"color","#6f2da8";"empty","ignore";"ymin",0;"ymax",100})',
                  parseFloat(DATA[I]['builtin:host.disk.usedPct:fold']).toFixed(2) / 100,
                    '=SPARKLINE(OFFSET(H'+row+',0,' + (1 + DATA[I]['builtin:host.cpu.usage'].length + DATA[I]['builtin:host.cpu.usage'].length) + ',1,' + DATA[I]['builtin:host.disk.usedPct'].length + '), {"charttype","line";"linewidth",2;"color","#6f2da8";"empty","ignore";"ymin",0;"ymax",100})'
                    ];
      for (const X of DATA[I]['builtin:host.cpu.usage']){
        tmp.push(X);
      }
      for (const X of DATA[I]['builtin:host.mem.usage']){
        tmp.push(X);
      }
      for (const X of DATA[I]['builtin:host.disk.usedPct']){
        tmp.push(X);
      }
      d.push(tmp);
      row++;
    } catch (e) { Logger.log(e) }
  }
  // write the data to the sheet
  SHEET.getRange(5, 1, d.length, d[0].length).setValues(d);
  
  // make it look nice
  SHEET.hideColumns(9, SHEET.getMaxColumns() - 8);
  SHEET.setColumnWidths(1, 2, 180);
  SHEET.setColumnWidths(3, 6, 100);
  SHEET.getRange(5, 3, SHEET.getLastRow() - 4, 5).setNumberFormat("0.00 %");
  SHEET.setFrozenRows(4);
  SHEET.getRange(4, 1, SHEET.getLastRow() - 3, 8).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  SHEET.getRange(1, 4, 2, 5).merge().setHorizontalAlignment("center").setVerticalAlignment("top").setFontSize(24).setValue('Host Utilization Report');
  try {
    // if there's extra rows, ditch them
    SHEET.deleteRows(SHEET.getLastRow() + 1, SHEET.getMaxRows() - SHEET.getLastRow());
  } catch(e) {
    // there's not, so it's all good
  }
  
  // add conditional formatting
  let ranges = [SHEET.getRange(5, 3, d.length, 1),
                SHEET.getRange(5, 5, d.length, 1),
                SHEET.getRange(5, 7, d.length, 1)]
  let r1 = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0, .0399)
    .setBackground("#93c47d")
    .setRanges(ranges)
    .build();
  let r2 = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(.04, .07)
    .setBackground("#d9ead3")
    .setRanges(ranges)
    .build();
  let r3 = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(.96, 1)
    .setBackground("#ea9999")
    .setRanges(ranges)
    .build();
  let rules = SHEET.getConditionalFormatRules();
  rules.push(r1);
  rules.push(r2);
  rules.push(r3);
  SHEET.setConditionalFormatRules(rules);
  UI.alert("All Set!");
}


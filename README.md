# dt-utils
This is a collection of handy scripts that I've assembled that pull data from Dynatrace via API calls for specific use cases. The examples in this repo are written in JavaScript using the [Google Apps Script](https://developers.google.com/apps-script) platform. These utilities are not meant to function as production software, but are a great way to demonstrate the value of the Dynatrace APIs or as a means to learn how to utilize the Dynatrace APIs.

## How to Use
All of these scripts utilize Google Apps Script. You can read the documentation for Google Apps Script at [https://developers.google.com/apps-script](https://developers.google.com/apps-script). Specifically all of these examples are meant to be run within a [Google Sheet](https://sheets.google.com), as they utilize the spreadsheet as both a UI and a data storage layer.

### Steps to Use
1. Create a new Google Sheet by navigating to [Google Sheets](https://sheets.google.com) and clicking on the "New Blank Spreadsheet" button.
2. Once in the new sheet, access the "Extensions" menu and select "<> Script editor". This will launch the Google Apps Script built-in IDE.
3. Copy and paste the code example that you want to run into the script editor and save.
4. From the drop down in the editor, select the "on_open" function that every example contains, and hit the. play button. You will be prompted to provide permissions for the script to perform certain functions as you. Navigate through the prompts accepting the permissions. You'll now have a "Dynatrace" menu that can be used for each example's functions.
5. Finally, run the "Setup" function from the "Dynatrace" menu in the Spreadsheet to configure the proper tabs and labels to use the script example.

## The Scripts
### [basic_api_fetch_google.js](https://github.com/elandsness/dt-utils/blob/master/basic_api_fetch_google.js)
This script is helpful for pulling data out of most Dynatrace APIs and converting into column and row data in a spreadsheet. The code attempts to guess the format of the return data and parse it into structured columns. All of the setup is done on the config sheet where you'll enter tenant id, api key, etc. There's also a section on the config to pass either the api path (/api/v1/entity/infrastructure/hosts for example) if doing a basic API fetch or a [USQL Query](https://www.dynatrace.com/support/help/how-to-use-dynatrace/real-user-monitoring/how-to-use-real-user-monitoring/cross-application-user-session-analytics/custom-queries-segmentation-and-aggregation-of-session-data/) if using the USQL query function.

### [external_events_google.js](https://github.com/elandsness/dt-utils/blob/master/external_events_google.js)
Simple example for testing integration of external events into Dynatrace. The script presents a form that allows you to test both fictitious deployment events and simulated outages triggered via api. This is really helpful for understanding how to. consume the events API and to see what an integration might look like without having to write any code.

### [host_utilization_google.js](https://github.com/elandsness/dt-utils/blob/master/host_utilization_google.js)
Using this report, you can pull in all of the hosts in an environment into a spreadsheet along with current metrics for CPU, Memory and Disk consumption along with trend lines to visualize the recent consumption for each host. The script will also highlight areas in shades of green and red to identify areas of extreme under or over utilization. One other great feature is the ability to take the generated report and generate a PDF from the sheet and send it via email.

### [metric_report_google.js](https://github.com/elandsness/dt-utils/blob/master/metric_report_google.js)
This [Metrics v2 API](https://www.dynatrace.com/support/help/dynatrace-api/environment-api/metric-v2/) playground utility is a great way to test out the [Selector Transformations](https://www.dynatrace.com/support/help/dynatrace-api/environment-api/metric-v2/selector-transformations/) available via the metrics API. This script has two main functions. The first is to fetch a complete list of the available metrics to query. The second is to highlight the metric you want to pull in or copy the selector to the config sheet, set up your options for resolution and timeframe, and then fetch the metric data points, complete with entirely code generated chart. You can add selector transformations onto the metric selector and see how the data is affected.

### [synth_usage_google.js](https://github.com/elandsness/dt-utils/blob/master/synth_usage_google.js)
Rationalizing spend or getting a handle on where licenses are being consumed is a common ask from customers. In this example, you can see how a basic Synthetic Test Cost Report can be generated using the Dynatrace Synthetics API.  This example takes a tenant id, an API key, and the cost of a synthetic action for the customer. From there, you get the estimated cost of each test that is currently active in the environment along with ready to use filters and tags that can be used to look at tests from a specific team. While this doesn't track actual usage, that information is available via API and could easily be added.

/**
 * Google Sheets Trigger for CRM Timeline Sync
 * 
 * ⚠️ IMPORTANT:
 * Because this script makes external network requests (UrlFetchApp.fetch),
 * you CANNOT use the default simple trigger name "onEdit(e)".
 * You must name this function something else (e.g., "handleSheetEdit")
 * and set up an INSTALLABLE TRIGGER in Apps Script:
 * 
 * HOW TO INSTALL:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" -> "Apps Script".
 * 3. Copy this entire script and paste it at the bottom of your Code.gs (or in a new file).
 * 4. Update the `NETLIFY_WEBHOOK_URL` constant below with your actual deployed Netlify URL.
 * 5. On the left sidebar of the Apps Script editor, click the clock icon (Triggers).
 * 6. Click "+ Add Trigger" in the bottom right.
 * 7. Configure:
 *    - Choose which function to run: "handleSheetEdit"
 *    - Choose which deployment should run: "Head"
 *    - Select event source: "From spreadsheet"
 *    - Select event type: "On edit"
 * 8. Click "Save" and authorize the script when prompted.
 */

// CONFIGURATION
const NETLIFY_WEBHOOK_URL = 'https://YOUR_NETLIFY_APP_NAME.netlify.app/.netlify/functions/google-sheet-timeline-receiver';
const WEBHOOK_SECRET = 'SALES_OPS_2026_SECURE';

function handleSheetEdit(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();
    var row = range.getRow();
    var col = range.getColumn();
    
    // 1. Identify which sheet was edited.
    // For example, we want to watch the "Quotations" sheet (the first sheet)
    var sheetName = sheet.getName();
    
    // Skip header row
    if (row === 1) return;
    
    // We only process if it's the main sheet (usually the first sheet)
    // Feel free to change "Quotations" to your sheet's actual name if different
    if (sheetName !== "Quotations" && sheetName !== Sheet1) {
      // If your sheet is named something else, adjust this guard
      // For now, let's assume getSheets()[0] is the sheet we are watching
      var firstSheetName = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName();
      if (sheetName !== firstSheetName) return;
    }
    
    // Get all cell values for this edited row to match with the CRM
    var lastCol = sheet.getLastColumn();
    var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    
    // COLUMN MAPPINGS (Adjust index to match your Google Sheet columns exactly)
    // Indexes are 0-based (e.g. Col A is 0, Col B is 1, etc.)
    var quotationId = rowValues[0] ? rowValues[0].toString().trim() : '';  // Col A (index 0)
    var status = rowValues[20] ? rowValues[20].toString().trim() : '';       // Col U (index 20)
    var serialNo2 = rowValues[26] ? rowValues[26].toString().trim() : '';   // Col AA (index 26)
    var phone = rowValues[21] ? rowValues[21].toString().trim() : '';       // Col V (index 21)
    var email = rowValues[22] ? rowValues[22].toString().trim() : '';       // Col W (index 22)
    
    // Document URL columns (e.g., if you write Proforma, Invoice, or Receipt links)
    // Adjust these column indexes to match your sheet columns:
    var proformaUrl = rowValues[28] ? rowValues[28].toString().trim() : ''; // Col AC (index 28)
    var invoiceUrl = rowValues[29] ? rowValues[29].toString().trim() : '';  // Col AD (index 29)
    var receiptUrl = rowValues[30] ? rowValues[30].toString().trim() : '';  // Col AE (index 30)

    var actionName = "";
    var detailsText = "";
    var fileUrl = null;
    var fileName = "";
    
    // A. Detect Status Change (Status column edited)
    if (col === 21) {
      if (status === "Approved") {
        actionName = "Quotation Approved";
        detailsText = "Quotation " + quotationId + " was marked as Approved in Google Sheet.";
      } else if (status === "Rejected") {
        actionName = "Quotation Rejected";
        detailsText = "Quotation " + quotationId + " was marked as Rejected in Google Sheet.";
      } else if (status !== "") {
        actionName = "Quotation Status Update";
        detailsText = "Quotation status updated to '" + status + "' in Google Sheet.";
      }
    }
    
    // B. Detect Proforma Invoice Link added/updated
    else if (col === 29 && proformaUrl) {
      actionName = "Proforma Invoice Generated";
      detailsText = "Proforma Invoice document added to sheet.";
      fileUrl = proformaUrl;
      fileName = "Proforma_" + (quotationId || serialNo2) + ".pdf";
    }
    
    // C. Detect Tax Invoice / Invoice Link added/updated
    else if (col === 30 && invoiceUrl) {
      actionName = "Tax Invoice Generated";
      detailsText = "Tax Invoice document added to sheet.";
      fileUrl = invoiceUrl;
      fileName = "Invoice_" + (quotationId || serialNo2) + ".pdf";
    }
    
    // D. Detect Receipt Link added/updated
    else if (col === 31 && receiptUrl) {
      actionName = "Receipt Generated";
      detailsText = "Receipt document added to sheet.";
      fileUrl = receiptUrl;
      fileName = "Receipt_" + (quotationId || serialNo2) + ".pdf";
    }
    
    // If we matched an action, send it to the CRM
    if (actionName !== "") {
      sendTimelineEventToNetlify({
        serial_no_2: serialNo2,
        quotation_id: quotationId,
        phone: phone,
        email: email,
        action: actionName,
        details: detailsText,
        file_url: fileUrl,
        file_name: fileName,
        performed_by: "Google Sheets Automation"
      });
    }
  } catch(err) {
    Logger.log("Error in handleSheetEdit: " + err.toString());
  }
}

/**
 * Sends a HTTP POST request to the Netlify serverless function
 */
function sendTimelineEventToNetlify(payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-webhook-secret': WEBHOOK_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(NETLIFY_WEBHOOK_URL, options);
    Logger.log("Netlify Response: " + response.getContentText());
  } catch(e) {
    Logger.log("Webhook sync error: " + e.toString());
  }
}

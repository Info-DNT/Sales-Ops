// ========================================
// SALES OPS - GOOGLE APPS SCRIPT BACKEND
// ========================================
// 
// DEPLOYMENT INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Click Extensions → Apps Script
// 3. Delete default code
// 4. Paste this entire file
// 5. Click Deploy → New deployment → Web app
// 6. Set "Execute as: Me" and "Who has access: Anyone"
// 7. Click Deploy and copy the Web App URL
// 8. Update SHEETS_API_URL in sheets-api.js with that URL
//
// ========================================

// ========================================
// CONFIGURATION
// ========================================

const TEMPLATE_SHEET_ID = '1oIfq6xAtWVpitfZ080gfLRCRZXPDQrenp1xdYzwOHwE';

// Simple API Key for security (Handshake)
const API_TOKEN = 'SALES_OPS_2026_SECURE';

// Helper to get persistent users + hardcoded defaults
function getUsersDB() {
  const props = PropertiesService.getScriptProperties();
  const savedUsers = props.getProperty('USER_DATABASE');
  const db = savedUsers ? JSON.parse(savedUsers) : {};
  
  // Ensure defaults exist
  if (!db['user@demo.com']) {
    db['user@demo.com'] = { password: 'user123', userId: 'user_001', role: 'user', name: 'Demo User', sheetId: TEMPLATE_SHEET_ID };
  }
  if (!db['admin@demo.com']) {
    db['admin@demo.com'] = { password: 'admin123', userId: 'admin_001', role: 'admin', name: 'Admin User', sheetId: '' };
  }
  return db;
}

function saveUserToDB(email, userData) {
  const db = getUsersDB();
  db[email] = userData;
  PropertiesService.getScriptProperties().setProperty('USER_DATABASE', JSON.stringify(db));
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get sheet by user ID
 */
function getUserSheet(userId) {
  const db = getUsersDB();
  let sheetId = null;
  for (const email in db) {
    if (db[email].userId === userId) {
      sheetId = db[email].sheetId;
      break;
    }
  }
  
  if (!sheetId) throw new Error('User sheet not found for: ' + userId);
  return SpreadsheetApp.openById(sheetId).getSheets()[0];
}

/**
 * Verify that a column actually contains the expected lead
 */
function verifyLead(sheet, col, expectedName) {
  const actualName = sheet.getRange(21, col).getValue();
  if (actualName !== expectedName) {
    throw new Error('Sheet sort mismatch: Lead name in column ' + col + ' (' + actualName + ') does not match ' + expectedName);
  }
  return true;
}

// ========================================
// CORE FEATURES
// ========================================

function login(email, password) {
  try {
    const db = getUsersDB();
    const user = db[email];
    if (!user || user.password !== password) return {success: false, error: 'Invalid email or password'};
    return {
      success: true,
      data: { userId: user.userId, email: email, role: user.role, name: user.name }
    };
  } catch (error) { return {success: false, error: error.message}; }
}

function getUserDetails(userId) {
  try {
    const sheet = getUserSheet(userId);
    return {
      success: true,
      data: {
        name: sheet.getRange('B2').getValue() || '',
        contact: sheet.getRange('B3').getValue() || '',
        designation: sheet.getRange('B4').getValue() || '',
        email: sheet.getRange('B5').getValue() || ''
      }
    };
  } catch (error) { return {success: false, error: error.message}; }
}

function updateUserDetails(userId, details) {
  try {
    const sheet = getUserSheet(userId);
    if (details.name) sheet.getRange('B2').setValue(details.name);
    if (details.contact) sheet.getRange('B3').setValue(details.contact);
    if (details.designation) sheet.getRange('B4').setValue(details.designation);
    if (details.email) sheet.getRange('B5').setValue(details.email);
    return {success: true, message: 'User details updated'};
  } catch (error) { return {success: false, error: error.message}; }
}

function getWorkReports(userId) {
  try {
    const sheet = getUserSheet(userId);
    const lastCol = sheet.getLastColumn();
    const reports = [];
    for (let col = 2; col <= lastCol; col++) {
      const date = sheet.getRange(9, col).getValue();
      if (!date) continue;
      reports.push({
        date: date.toString(),
        checkIn: sheet.getRange(10, col).getValue() || '',
        checkOut: sheet.getRange(11, col).getValue() || '',
        totalCalls: parseInt(sheet.getRange(12, col).getValue()) || 0,
        totalMeetings: parseInt(sheet.getRange(13, col).getValue()) || 0,
        totalLeads: parseInt(sheet.getRange(14, col).getValue()) || 0,
        newLeadsGenerated: parseInt(sheet.getRange(15, col).getValue()) || 0,
        leadsInPipeline: parseInt(sheet.getRange(16, col).getValue()) || 0
      });
    }
    return {success: true, data: reports};
  } catch (error) { return {success: false, error: error.message}; }
}

function saveWorkReport(userId, reportData) {
  try {
    const sheet = getUserSheet(userId);
    let col = findWorkReportColumn(sheet, reportData.date);
    if (col === -1) col = sheet.getLastColumn() + 1;
    sheet.getRange(9, col).setValue(reportData.date);
    sheet.getRange(10, col).setValue(reportData.checkIn || '');
    sheet.getRange(11, col).setValue(reportData.checkOut || '');
    sheet.getRange(12, col).setValue(reportData.totalCalls || 0);
    sheet.getRange(13, col).setValue(reportData.totalMeetings || 0);
    sheet.getRange(14, col).setValue(reportData.totalLeads || 0);
    sheet.getRange(15, col).setValue(reportData.newLeadsGenerated || 0);
    sheet.getRange(16, col).setValue(reportData.leadsInPipeline || 0);
    return {success: true, message: 'Work report saved successfully'};
  } catch (error) { return {success: false, error: error.message}; }
}

function clockIn(userId, date, time) {
  try {
    const sheet = getUserSheet(userId);
    let col = findWorkReportColumn(sheet, date);
    if (col === -1) {
      col = sheet.getLastColumn() + 1;
      sheet.getRange(9, col).setValue(date);
    }
    sheet.getRange(10, col).setValue(time);
    return {success: true, message: 'Clocked in at ' + time};
  } catch (error) { return {success: false, error: error.message}; }
}

function clockOut(userId, date, time) {
  try {
    const sheet = getUserSheet(userId);
    const col = findWorkReportColumn(sheet, date);
    if (col === -1) return {success: false, error: 'No check-in found for today.'};
    sheet.getRange(11, col).setValue(time);
    return {success: true, message: 'Clocked out at ' + time};
  } catch (error) { return {success: false, error: error.message}; }
}

function getLeads(userId) {
  try {
    const sheet = getUserSheet(userId);
    const lastCol = sheet.getLastColumn();
    const leads = [];
    for (let col = 2; col <= lastCol; col++) {
      const date = sheet.getRange(20, col).getValue();
      if (!date) continue;
      const leadName = sheet.getRange(21, col).getValue();
      if (!leadName) continue;
      leads.push({
        id: col,
        date: date.toString(),
        name: leadName,
        contact: sheet.getRange(22, col).getValue() || '',
        email: sheet.getRange(23, col).getValue() || '',
        owner: sheet.getRange(24, col).getValue() || '',
        status: sheet.getRange(25, col).getValue() || '',
        accountName: sheet.getRange(26, col).getValue() || '',
        followUpDate: sheet.getRange(27, col).getValue() || '',
        nextAction: sheet.getRange(28, col).getValue() || '',
        expectedClose: sheet.getRange(29, col).getValue() || '',
        createdDate: date.toString()
      });
    }
    return {success: true, data: leads};
  } catch (error) { return {success: false, error: error.message}; }
}

function saveLead(userId, leadData) {
  try {
    const sheet = getUserSheet(userId);
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(20, col).setValue(leadData.date);
    sheet.getRange(21, col).setValue(leadData.name);
    sheet.getRange(22, col).setValue(leadData.contact || '');
    sheet.getRange(23, col).setValue(leadData.email || '');
    sheet.getRange(24, col).setValue(leadData.owner || '');
    sheet.getRange(25, col).setValue(leadData.status);
    sheet.getRange(26, col).setValue(leadData.accountName || '');
    sheet.getRange(27, col).setValue(leadData.followUpDate);
    sheet.getRange(28, col).setValue(leadData.nextAction || '');
    sheet.getRange(29, col).setValue(leadData.expectedClose || '');
    return {success: true, message: 'Lead saved successfully'};
  } catch (error) { return {success: false, error: error.message}; }
}

function deleteLead(userId, leadId) {
  try {
    const sheet = getUserSheet(userId);
    const col = parseInt(leadId);
    sheet.getRange(20, col, 10, 1).clearContent();
    return {success: true, message: 'Lead deleted successfully'};
  } catch (error) { return {success: false, error: error.message}; }
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

/**
 * Get all users' lists (Reports/Leads)
 */
function getAllWorkReports() {
  try {
    const db = getUsersDB();
    const allReports = [];
    for (const email in db) {
      const user = db[email];
      if (user.role === 'admin' || !user.sheetId) continue;
      const result = getWorkReports(user.userId);
      if (result.success) {
        result.data.forEach(report => allReports.push({ ...report, userName: user.name, userId: user.userId }));
      }
    }
    return {success: true, data: allReports};
  } catch (error) { return {success: false, error: error.message}; }
}

function getAllLeads() {
  try {
    const db = getUsersDB();
    const allLeads = [];
    for (const email in db) {
      const user = db[email];
      if (user.role === 'admin' || !user.sheetId) continue;
      const result = getLeads(user.userId);
      if (result.success) {
        result.data.forEach(lead => allLeads.push({ ...lead, userName: user.name, userId: user.userId }));
      }
    }
    return {success: true, data: allLeads};
  } catch (error) { return {success: false, error: error.message}; }
}

function createNewUser(name, email, contact, designation, password) {
  try {
    const userId = 'user_' + new Date().getTime();
    const templateFile = DriveApp.getFileById(TEMPLATE_SHEET_ID);
    const newFile = templateFile.makeCopy('Sales Ops - ' + name);
    const newSheetId = newFile.getId();
    const sheet = SpreadsheetApp.openById(newSheetId).getSheets()[0];
    sheet.getRange('B2').setValue(name);
    sheet.getRange('B3').setValue(contact);
    sheet.getRange('B4').setValue(designation);
    sheet.getRange('B5').setValue(email);
    
    // SAVE TO PERSISTENT STORAGE
    saveUserToDB(email, { 
      password: password || 'user123', 
      userId: userId, 
      role: 'user', 
      name: name, 
      sheetId: newSheetId 
    });
    
    return { success: true, userId: userId, sheetId: newSheetId, message: 'User created' };
  } catch (error) { return {success: false, error: error.message}; }
}

// ========================================
// QUOTATIONS SYNC (Smart Search)
// ========================================

function getQuotationsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheets()[0];
  if (sheet.getRange(1, 27).getValue() === "") {
    sheet.getRange(1, 27).setValue('serial_no_2').setFontWeight('bold');
  }
  return sheet;
}

function saveQuotation(data) {
  try {
    const sheet = getQuotationsSheet();
    const newRow = Math.max(sheet.getLastRow() + 1, 2);
    // Write Serial No to Col AA
    sheet.getRange(newRow, 27).setValue(data.serial_no_2 || '');
    // Write Lead Name to Col AB for precision matching
    sheet.getRange(newRow, 28).setValue(data.name || '');
    return { success: true, message: 'Log saved', row: newRow };
  } catch (error) { return { success: false, error: error.message }; }
}

/**
 * v10.0 - Precision Match & Clean: Maps precisely by Lead Name and deletes duplicate row
 */
function getQuotationBySerial(serialNo2) {
  try {
    if (!serialNo2) return { success: false, error: 'No Serial No provided' };
    const sheet = getQuotationsSheet();
    const data = sheet.getDataRange().getValues();
    const searchVal = serialNo2.toString().trim();
    
    // Pass 1: Find the orphan row created by Web App
    for (let i = data.length - 1; i >= 1; i--) { // Start from bottom
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] && data[i][j].toString().trim() === searchVal) {
                
                // If it already has a Quote ID, we are perfectly fine
                if (data[i][0]) {
                    return { success: true, quo_id: data[i][0], found_at_row: i + 1, mode: 'Exact' };
                }
                
                // We found the separate Web App row. Let's merge it with the correct Zoho row.
                const orphanRowIndex = i;
                const expectedName = data[i][27] ? data[i][27].toString().toLowerCase().trim() : ''; // Column AB (Index 27)
                
                let matchedRowIndex = -1;
                
                // Search for the Zoho row that has a Quote ID, but NO Serial No yet
                for (let k = data.length - 1; k >= 1; k--) {
                    if (k === orphanRowIndex) continue; // Skip our own row
                    
                    if (data[k][0] && !data[k][26]) { // Has Quote ID in Col A, NO Serial in Col AA
                        
                        // PRECISION MATCH: Try to match by Name (Zoho puts first name in Col D / Index 3)
                        const zohoName = data[k][3] ? data[k][3].toString().toLowerCase().trim() : '';
                        
                        if (expectedName && zohoName && (zohoName.includes(expectedName) || expectedName.includes(zohoName))) {
                            matchedRowIndex = k;
                            break; // Perfect match found!
                        }
                    }
                }
                
                // FALLBACK: If Name didn't match perfectly, grab the most recent Zoho row
                if (matchedRowIndex === -1) {
                    for (let k = data.length - 1; k >= 1; k--) {
                        if (k === orphanRowIndex) continue;
                        if (data[k][0] && !data[k][26]) {
                            matchedRowIndex = k;
                            break;
                        }
                    }
                }
                
                if (matchedRowIndex !== -1) {
                     const quoId = data[matchedRowIndex][0];
                     
                     // 1. Move Serial No to the Zoho Row (Col AA)
                     sheet.getRange(matchedRowIndex + 1, 27).setValue(searchVal);
                     
                     // 2. DELETE the separate Web App row to clean up the sheet
                     sheet.deleteRow(orphanRowIndex + 1);
                     
                     return { 
                       success: true, 
                       quo_id: quoId,
                       mode: 'Precision Merged & Cleaned',
                       version: 'v10.0'
                     };
                }
            }
        }
    }
    return { success: false, error: 'Quotation ID not found nearby for Serial: ' + searchVal };
  } catch (error) { return { success: false, error: error.message }; }
}

// ========================================
// HTTP HANDLERS (Web App Endpoints)
// ========================================

function doGet(e) {
  const action = e.parameter.action;
  const token = e.parameter.token;
  let result;
  
  // Security Handshake
  if (action === 'saveQuotation' && token !== API_TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({success:false, error:'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    switch(action) {
      case 'version': result = { success: true, version: 'v10.0 - Precision Match', sheet_name: getQuotationsSheet().getName() }; break;
      case 'getUserDetails': result = getUserDetails(e.parameter.userId); break;
      case 'getWorkReports': result = getWorkReports(e.parameter.userId); break;
      case 'getLeads': result = getLeads(e.parameter.userId); break;
      case 'getAllWorkReports': result = getAllWorkReports(); break;
      case 'getAllLeads': result = getAllLeads(); break;
      case 'getQuotationBySerial': result = getQuotationBySerial(e.parameter.serialNo2); break;
      case 'saveQuotation': result = saveQuotation({ serial_no_2: e.parameter.serialNo2, name: e.parameter.name }); break;
      case 'test': result = {success: true, message: 'Apps Script live'}; break;
      default: result = {success: false, error: 'Invalid action: ' + action};
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) { return ContentService.createTextOutput(JSON.stringify({success: false, error: error.message})).setMimeType(ContentService.MimeType.JSON); }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    switch(action) {
      case 'login': result = login(data.email, data.password); break;
      case 'updateUserDetails': result = updateUserDetails(data.userId, data.details); break;
      case 'saveWorkReport': result = saveWorkReport(data.userId, data.report); break;
      case 'clockIn': result = clockIn(data.userId, data.date, data.time); break;
      case 'clockOut': result = clockOut(data.userId, data.date, data.time); break;
      case 'saveLead': result = saveLead(data.userId, data.lead); break;
      case 'saveQuotation': result = saveQuotation(data.quotation); break;
      case 'deleteLead': result = deleteLead(data.userId, data.leadId); break;
      case 'createUser': result = createNewUser(data.name, data.email, data.contact, data.designation, data.password); break;
      default: result = {success: false, error: 'Invalid action: ' + action};
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) { return ContentService.createTextOutput(JSON.stringify({success: false, error: error.message})).setMimeType(ContentService.MimeType.JSON); }
}

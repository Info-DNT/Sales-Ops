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

// Template sheet ID (your provided template)
const TEMPLATE_SHEET_ID = '1oIfq6xAtWVpitfZ080gfLRCRZXPDQrenp1xdYzwOHwE';

// User credentials for login (username → Sheet ID mapping)
// This stores user login info and their sheet references
const USER_DATABASE = {
  // Demo users
  'user@demo.com': {
    password: 'user123',
    userId: 'user_001',
    role: 'user',
    name: 'Demo User',
    sheetId: TEMPLATE_SHEET_ID // Using template as demo, will be unique per user in production
  },
  'admin@demo.com': {
    password: 'admin123',
    userId: 'admin_001',
    role: 'admin',
    name: 'Admin User',
    sheetId: '' // Admins don't have their own sheet
  }
};

// Get script properties for persistent storage
const SCRIPT_PROPS = PropertiesService.getScriptProperties();

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get sheet by user ID
 */
function getUserSheet(userId) {
  // Find user in database
  let sheetId = null;
  for (const email in USER_DATABASE) {
    if (USER_DATABASE[email].userId === userId) {
      sheetId = USER_DATABASE[email].sheetId;
      break;
    }
  }
  
  if (!sheetId) {
    throw new Error('User sheet not found for: ' + userId);
  }
  
  return SpreadsheetApp.openById(sheetId).getSheets()[0];
}

/**
 * Find column by date in work report section
 */
function findWorkReportColumn(sheet, targetDate) {
  const lastCol = sheet.getLastColumn();
  
  for (let col = 2; col <= lastCol; col++) {
    const cellValue = sheet.getRange(9, col).getValue();
    if (cellValue && cellValue.toString() === targetDate.toString()) {
      return col;
    }
  }
  
  return -1; // Not found
}

/**
 * Find column by lead name and date in leads section
 */
function findLeadColumn(sheet, leadName, date) {
  const lastCol = sheet.getLastColumn();
  
  for (let col = 2; col <= lastCol; col++) {
    const leadDate = sheet.getRange(20, col).getValue();
    const name = sheet.getRange(21, col).getValue();
    
    if (leadDate && name && 
        leadDate.toString() === date.toString() &&
        name === leadName) {
      return col;
    }
  }
  
  return -1;
}

// ========================================
// AUTHENTICATION
// ========================================

/**
 * User login
 */
function login(email, password) {
  try {
    const user = USER_DATABASE[email];
    
    if (!user) {
      return {success: false, error: 'Invalid email or password'};
    }
    
    if (user.password !== password) {
      return {success: false, error: 'Invalid email or password'};
    }
    
    return {
      success: true,
      data: {
        userId: user.userId,
        email: email,
        role: user.role,
        name: user.name
      }
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// ========================================
// USER DETAILS
// ========================================

/**
 * Get user details from their sheet
 */
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
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Update user details
 */
function updateUserDetails(userId, details) {
  try {
    const sheet = getUserSheet(userId);
    
    if (details.name) sheet.getRange('B2').setValue(details.name);
    if (details.contact) sheet.getRange('B3').setValue(details.contact);
    if (details.designation) sheet.getRange('B4').setValue(details.designation);
    if (details.email) sheet.getRange('B5').setValue(details.email);
    
    return {success: true, message: 'User details updated'};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// ========================================
// WORK REPORTS
// ========================================

/**
 * Get all work reports
 */
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
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Save/Update work report
 */
function saveWorkReport(userId, reportData) {
  try {
    const sheet = getUserSheet(userId);
    let col = findWorkReportColumn(sheet, reportData.date);
    
    if (col === -1) {
      col = sheet.getLastColumn() + 1;
    }
    
    sheet.getRange(9, col).setValue(reportData.date);
    sheet.getRange(10, col).setValue(reportData.checkIn || '');
    sheet.getRange(11, col).setValue(reportData.checkOut || '');
    sheet.getRange(12, col).setValue(reportData.totalCalls || 0);
    sheet.getRange(13, col).setValue(reportData.totalMeetings || 0);
    sheet.getRange(14, col).setValue(reportData.totalLeads || 0);
    sheet.getRange(15, col).setValue(reportData.newLeadsGenerated || 0);
    sheet.getRange(16, col).setValue(reportData.leadsInPipeline || 0);
    
    return {success: true, message: 'Work report saved successfully'};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Clock In
 */
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
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Clock Out
 */
function clockOut(userId, date, time) {
  try {
    const sheet = getUserSheet(userId);
    const col = findWorkReportColumn(sheet, date);
    
    if (col === -1) {
      return {success: false, error: 'No check-in found for today. Please clock in first.'};
    }
    
    sheet.getRange(11, col).setValue(time);
    
    return {success: true, message: 'Clocked out at ' + time};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// ========================================
// LEADS MANAGEMENT
// ========================================

/**
 * Get all leads
 */
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
        id: col, // Use column number as ID
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
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Save/Update lead
 */
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
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Delete lead
 */
function deleteLead(userId, leadId) {
  try {
    const sheet = getUserSheet(userId);
    const col = parseInt(leadId);
    
    // Clear the column
    sheet.getRange(20, col, 10, 1).clearContent();
    
    return {success: true, message: 'Lead deleted successfully'};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

/**
 * Get all users' work reports (admin only)
 */
function getAllWorkReports() {
  try {
    const allReports = [];
    
    for (const email in USER_DATABASE) {
      const user = USER_DATABASE[email];
      if (user.role === 'admin' || !user.sheetId) continue;
      
      const result = getWorkReports(user.userId);
      if (result.success) {
        result.data.forEach(report => {
          allReports.push({
            ...report,
            userName: user.name,
            userId: user.userId
          });
        });
      }
    }
    
    return {success: true, data: allReports};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Get all users' leads (admin only)
 */
function getAllLeads() {
  try {
    const allLeads = [];
    
    for (const email in USER_DATABASE) {
      const user = USER_DATABASE[email];
      if (user.role === 'admin' || !user.sheetId) continue;
      
      const result = getLeads(user.userId);
      if (result.success) {
        result.data.forEach(lead => {
          allLeads.push({
            ...lead,
            userName: user.name,
            userId: user.userId
          });
        });
      }
    }
    
    return {success: true, data: allLeads};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

/**
 * Create new user sheet
 */
function createNewUser(name, email, contact, designation, password) {
  try {
    const userId = 'user_' + new Date().getTime();
    
    // Copy template sheet
    const templateFile = DriveApp.getFileById(TEMPLATE_SHEET_ID);
    const newFile = templateFile.makeCopy('Sales Ops - ' + name);
    const newSheetId = newFile.getId();
    
    // Set user details in new sheet
    const sheet = SpreadsheetApp.openById(newSheetId).getSheets()[0];
    sheet.getRange('B2').setValue(name);
    sheet.getRange('B3').setValue(contact);
    sheet.getRange('B4').setValue(designation);
    sheet.getRange('B5').setValue(email);
    
    // Add to user database (in production, this would be in a database sheet)
    USER_DATABASE[email] = {
      password: password || 'user123',
      userId: userId,
      role: 'user',
      name: name,
      sheetId: newSheetId
    };
    
    return {
      success: true,
      userId: userId,
      sheetId: newSheetId,
      message: 'User created successfully'
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// ========================================
// HTTP HANDLERS (Web App Endpoints)
// ========================================

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action;
  const userId = e.parameter.userId;
  
  let result;
  
  try {
    switch(action) {
      case 'getUserDetails':
        result = getUserDetails(userId);
        break;
        
      case 'getWorkReports':
        result = getWorkReports(userId);
        break;
        
      case 'getLeads':
        result = getLeads(userId);
        break;
        
      case 'getAllWorkReports':
        result = getAllWorkReports();
        break;
        
      case 'getAllLeads':
        result = getAllLeads();
        break;
        
      default:
        result = {success: false, error: 'Invalid action: ' + action};
    }
  } catch (error) {
    result = {success: false, error: error.message};
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch(action) {
      case 'login':
        result = login(data.email, data.password);
        break;
        
      case 'updateUserDetails':
        result = updateUserDetails(data.userId, data.details);
        break;
        
      case 'saveWorkReport':
        result = saveWorkReport(data.userId, data.report);
        break;
        
      case 'clockIn':
        result = clockIn(data.userId, data.date, data.time);
        break;
        
      case 'clockOut':
        result = clockOut(data.userId, data.date, data.time);
        break;
        
      case 'saveLead':
        result = saveLead(data.userId, data.lead);
        break;
        
      case 'deleteLead':
        result = deleteLead(data.userId, data.leadId);
        break;
        
      case 'createUser':
        result = createNewUser(data.name, data.email, data.contact, data.designation, data.password);
        break;
        
      default:
        result = {success: false, error: 'Invalid action: ' + action};
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// GOOGLE SHEETS API LAYER
// ========================================
//
// This file handles all communication between
// the frontend and Google Apps Script backend
//
// ========================================

// ========================================
// CONFIGURATION
// ========================================

// !!! IMPORTANT: Replace this URL after deploying your Apps Script !!!
// 
// Steps to get this URL:
// 1. Open your Google Sheet
// 2. Go to Extensions → Apps Script
// 3. Paste Code.gs content
// 4. Click Deploy → New deployment → Web app
// 5. Copy the Web App URL here
//
const SHEETS_API_URL = 'https://script.google.com/a/macros/digitalnextworld.com/s/AKfycbyMn3uNzpwCuG54AeV9MTnGBYR2hkD-3ilgkONMGXgzQGcUBvlEfKPQgNBgy8I5e-vd/exec';
// Example: 'https://script.google.com/macros/s/AKfycbw.../exec'

// ========================================
// AUTHENTICATION
// ========================================

/**
 * Login with email and password
 */
async function loginWithSheets(email, password) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'login',
                email: email,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            // Save session to localStorage
            localStorage.setItem('session', JSON.stringify(result.data));
            return result.data;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// ========================================
// USER DETAILS
// ========================================

/**
 * Fetch user details from Google Sheets
 */
async function fetchUserDetails(userId) {
    try {
        const response = await fetch(
            `${SHEETS_API_URL}?action=getUserDetails&userId=${userId}`
        );

        const result = await response.json();

        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        throw error;
    }
}

/**
 * Update user details
 */
async function updateUserDetailsToSheet(userId, details) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateUserDetails',
                userId: userId,
                details: details
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating user details:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// WORK REPORTS
// ========================================

/**
 * Fetch all work reports for a user
 */
async function fetchWorkReports(userId) {
    try {
        const response = await fetch(
            `${SHEETS_API_URL}?action=getWorkReports&userId=${userId}`
        );

        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching work reports:', error);
        return [];
    }
}

/**
 * Save work report to Google Sheets
 */
async function saveWorkReportToSheet(userId, reportData) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveWorkReport',
                userId: userId,
                report: reportData
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error saving work report:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clock in
 */
async function clockInToSheet(userId) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { hour12: false });

    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'clockIn',
                userId: userId,
                date: date,
                time: time
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error clocking in:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clock out
 */
async function clockOutFromSheet(userId) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { hour12: false });

    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'clockOut',
                userId: userId,
                date: date,
                time: time
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error clocking out:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// LEADS MANAGEMENT
// ========================================

/**
 * Fetch all leads for a user
 */
async function fetchLeadsFromSheet(userId) {
    try {
        const response = await fetch(
            `${SHEETS_API_URL}?action=getLeads&userId=${userId}`
        );

        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching leads:', error);
        return [];
    }
}

/**
 * Save lead to Google Sheets
 */
async function saveLeadToSheet(userId, leadData) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveLead',
                userId: userId,
                lead: leadData
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error saving lead:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete lead from Google Sheets
 */
async function deleteLeadFromSheet(userId, leadId) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'deleteLead',
                userId: userId,
                leadId: leadId
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error deleting lead:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// ADMIN FUNCTIONS
// ========================================

/**
 * Get all users' work reports (admin only)
 */
async function fetchAllWorkReports() {
    try {
        const response = await fetch(
            `${SHEETS_API_URL}?action=getAllWorkReports`
        );

        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching all work reports:', error);
        return [];
    }
}

/**
 * Get all users' leads (admin only)
 */
async function fetchAllLeads() {
    try {
        const response = await fetch(
            `${SHEETS_API_URL}?action=getAllLeads`
        );

        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error fetching all leads:', error);
        return [];
    }
}

/**
 * Create new user (admin only)
 */
async function createNewUserInSheet(name, email, contact, designation, password) {
    try {
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createUser',
                name: name,
                email: email,
                contact: contact,
                designation: designation,
                password: password || 'user123'
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Check if API is configured
 */
function isAPIConfigured() {
    return SHEETS_API_URL &&
        SHEETS_API_URL !== 'REPLACE_WITH_YOUR_DEPLOYED_WEB_APP_URL' &&
        SHEETS_API_URL.includes('script.google.com');
}

/**
 * Get API status
 */
async function checkAPIStatus() {
    if (!isAPIConfigured()) {
        return {
            configured: false,
            message: 'Google Sheets API not configured. Please update SHEETS_API_URL in sheets-api.js'
        };
    }

    try {
        const response = await fetch(SHEETS_API_URL + '?action=test');
        return {
            configured: true,
            online: response.ok,
            message: 'API is configured and responding'
        };
    } catch (error) {
        return {
            configured: true,
            online: false,
            message: 'API configured but not responding: ' + error.message
        };
    }
}

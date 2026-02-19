# Sales Ops Dashboard - Air Medical 24x7

## 🎯 Overview
A high-performance, mission-critical Sales Operations Management System designed for Air Medical 24x7. This platform acts as a bridge between frontline sales operations and centralized CRM systems, facilitating lead management, attendance tracking, and real-time performance analytics.

## 🛠️ Technology Stack
- **Frontend**: Vanilla HTML5, CSS3 (Custom Premium SaaS UI), JavaScript (ES6+).
- **UI Framework**: [Bootstrap 5.3.0](https://getbootstrap.com/) for responsiveness.
- **Iconography/Typography**: Font Awesome 6.4.0, Inter Google Font.
- **Backend/Database**: [Supabase](https://supabase.com/) (Auth, PostgreSQL, RLS).
- **Integrations**: Zoho CRM (API & Flow), Google Sheets (Apps Script).
- **Hosting**: Netlify (Serverless Functions).

## 🔄 Functional Architecture & Integrations

### 🟢 Inbound Flow (Zoho CRM → Web App)
- **Active Connection**: Zoho CRM $\rightarrow$ Zoho Flow (Push Trigger) $\rightarrow$ `crm-receiver.js` (Netlify Function) $\rightarrow$ Supabase Database.
- **Function**: Automatically captures new leads or updates from Zoho CRM and registers them into the application's local database.

### 🔵 Outbound Flow (Web App/Postman → Zoho CRM)
- **Active Connection**: Web App / Postman $\rightarrow$ `crm-updater.js` (Netlify Function) $\rightarrow$ Zoho CRM API.
- **Function**: Pushes lead updates or new lead creation events from the dashboard back to Zoho CRM for synchronization.

### 🟡 Reporting Flow (Web App → Google Sheets)
- **Active Connection**: App State $\rightarrow$ Google Apps Script $\rightarrow$ Central Spreadsheet.
- **Function**: Syncs daily work reports and sales metrics for executive oversight.

## 🛡️ Security Implementation
The application enforces a **Dual-Auth Security Layer** to protect mission-critical operations:
- **Web App Users**: Authenticated via **JWT (Json Web Tokens)** provided by Supabase.
- **Postman/API Access**: Authenticated via a **Pre-shared API Key** (`x-api-key` header).
- **Database**: Secured with **Row Level Security (RLS)**, ensuring staff only see their own data while Admins have full oversight.

## � User Roles & Flows

### Sales Staff (User Panel)
1. **Attendance**: Clock-in/out tracking with calculated working hours.
2. **Activity Management**: Log Calls, Meetings, and Cases in real-time.
3. **Lead Workflow**: Manage assigned leads, update statuses, and sync with Zoho CRM.
4. **Work Reporting**: Submit daily summaries for manager approval.

### Operations (Admin Panel)
1. **Analytics Hub**: Real-time Lead Pipeline charts and Team Activity visualizations.
2. **CRM Management**: Orchestrate lead assignments and trigger manual syncs.
3. **Staff Oversight**: Live monitoring of attendance and daily performance metrics.

## 🚀 Setup & Deployment
1. **Hosting**: Deploy to Netlify. Connect the repository and configure build settings.
2. **Database**: Initialize Supabase tables using scripts in `/backend/`.
3. **Secrets**: Set `CRM_API_KEY`, `ZOHO_CLIENT_ID`, and `SUPABASE_SERVICE_ROLE_KEY` in Netlify Environment Variables.
4. **Zoho Flow**: Configure flows in the Zoho Flow dashboard to point to the `crm-receiver` endpoint.

---
*Built for Sales Operations Excellence v3.0*

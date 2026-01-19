# Sales Ops Application - README

## 🎯 Overview

A comprehensive Sales Operations Management System with separate user and admin dashboards, built with HTML, CSS, JavaScript, and Bootstrap.

## 📋 Demo Credentials

### User Account
- **Email:** user@demo.com
- **Password:** user123

### Admin Account  
- **Email:** admin@demo.com
- **Password:** admin123

## 🏗️ Project Structure

```
sales-team-app/
├── index.html                 # Login Page
├── assets/
│   ├── css/
│   │   └── style.css         # Shared styles
│   └── js/
│       ├── auth.js           # Authentication system
│       ├── common.js         # Shared utilities
│       ├── user.js           # User functionality
│       └── admin.js          # Admin functionality
├── user/                      # User Pages
│   ├── dashboard.html
│   ├── attendance.html
│   ├── user-details.html
│   ├── work-report.html
│   ├── leads.html
│   └── settings.html
└── admin/                     # Admin Pages
    ├── dashboard.html
    ├── users.html
    ├── attendance.html
    ├── leads.html
    ├── quotations.html
    ├── reports.html
    └── settings.html
```

## ✨ Features

### User Features
- ✅ Dashboard with statistics
- ✅ Clock in/out attendance tracking
- ✅ User profile management
- ✅ Daily work reports
- ✅ Lead management
- ✅ Quotation creation
- ✅ Data export/import
- ✅ Settings management

### Admin Features
- ✅ System-wide dashboard
- ✅ Monitor all users
- ✅ View all attendance records
- ✅ View all leads across users
- ✅ View all quotations
- ✅ Team performance analytics
- ✅ Consolidated reports
- ✅ System data export

## 🚀 Quick Start

1. **Open the application:**
   ```
   Right-click on index.html → Open with → Browser
   ```

2. **Login with demo credentials** (see above)

3. **Start using the application!**

## 📱 Tech Stack

- **HTML5** - Structure
- **CSS3** - Styling with modern gradients and animations
- **JavaScript (ES6+)** - Functionality
- **Bootstrap 5.3.0** - UI Framework
- **Font Awesome 6.4.0** - Icons
- **LocalStorage** - Data persistence

## 🎨 Design Features

- Modern gradient UI
- Smooth animations
- Responsive design (mobile-friendly)
- Beautiful card-based layouts
- Toast notifications
- Loading states

## 💾 Data Storage

All data is stored in browser's `localStorage`:
- User sessions
- Attendance records
- Work reports
- Leads
- Quotations
- User details

## 🌐 Deployment

This application can be deployed to:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Any static hosting**

No build step required - just upload the files!

## 📄 License

MIT License - Free to use and modify

## 👨‍💻 Author

Built for Sales Operations Management
Version 2.0

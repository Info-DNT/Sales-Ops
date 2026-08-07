// =============================================
// COMMON UTILITIES AND SHARED FUNCTIONS
// =============================================

// Format date
function formatDate(date) {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format time
function formatTime(date) {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Get current date string (YYYY-MM-DD)
function getCurrentDateString() {
  return new Date().toISOString().split('T')[0]
}

/**
 * PERMISSION HELPERS
 */

// Can the current user delete anything? (super_admin only)
function canDelete() {
  const session = getCurrentSession()
  return session && session.role === 'super_admin'
}

// Can the current user perform an action on a module?
// action: 'view' | 'create' | 'edit' | 'delete'
// Returns true for admin/super_admin always (fixed roles)
// For 'user' role: checks session.permissions
function canPerform(module, action) {
  const session = getCurrentSession()
  if (!session) return false

  // Admin and super_admin always have view/create/edit
  // super_admin also has delete (handled by canDelete())
  const ADMIN_ROLES = ['admin', 'super_admin']
  if (ADMIN_ROLES.includes(session.role)) {
    if (action === 'delete') return session.role === 'super_admin'
    return true
  }

  // For user role: check their stored permissions
  const perms = session.permissions || {}
  const modulePerm = perms[module]

  // If no permission record exists for this module → default allow
  // (backwards compatible — existing users keep full access until explicitly restricted)
  if (!modulePerm) return true
  if (!modulePerm.enabled) return false

  // Map action to permission field name
  const actionMap = {
    'view': 'view',
    'create': 'create',
    'edit': 'edit',
    'delete': 'delete'
  }
  const field = actionMap[action]
  return modulePerm[field] === true
}

// Is a module completely enabled for the current user?
function canAccessModule(module) {
  const session = getCurrentSession()
  if (!session) return false
  const ADMIN_ROLES = ['admin', 'super_admin']
  if (ADMIN_ROLES.includes(session.role)) return true
  const perms = session.permissions || {}
  const modulePerm = perms[module]
  if (!modulePerm) return true // no record = default allow
  return modulePerm.enabled !== false
}

// Storage helpers (kept for backwards compatibility, but now using Supabase)
function getUserData(userId) {
  const key = `userData_${userId}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : {
    attendance: [],
    workReports: [],
    quotations: [],
    leads: [],
    userDetails: {}
  }
}

function saveUserData(userId, data) {
  const key = `userData_${userId}`
  localStorage.setItem(key, JSON.stringify(data))
}

// Generate user sidebar navigation
function generateUserNav(currentPage) {
  const navItems = [
    { page: 'dashboard', icon: 'fa-home', label: 'Home' },
    { page: 'attendance', icon: 'fa-clock', label: 'Attendance' },
    { page: 'user-details', icon: 'fa-user', label: 'User Details' },
    { page: 'work-report', icon: 'fa-chart-bar', label: 'Work Report' },
    {
      page: 'leads',
      icon: 'fa-bullseye',
      label: 'Leads',
      module: 'leads',
      hasDropdown: true,
      dropdownItems: [
        { page: 'medical-assessment', icon: 'fa-stethoscope', label: 'Medical Assessment', module: 'medical_assessment' },
        { page: 'quotation-control', icon: 'fa-file-invoice-dollar', label: 'Quotation Control', module: 'quotation_control' },
        { page: 'equipment-checklist', icon: 'fa-clipboard-check', label: 'Equipment Checklist', module: 'equipment_checklist' },
        { page: 'cases', icon: 'fa-briefcase', label: 'Cases', module: 'cases' },
        { page: 'calls', icon: 'fa-phone', label: 'Calls', module: 'calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings', module: 'meetings' },
        { page: 'expenses', icon: 'fa-receipt', label: 'Expenses', module: 'expenses' },
        { page: 'vendors', icon: 'fa-handshake', label: 'Vendors', module: 'vendors' }
      ]
    },
    { page: 'manual', icon: 'fa-book-open', label: 'User Manual' },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

  // Filter items based on permissions
  const filteredItems = navItems.filter(item => {
    if (item.module) return canPerform(item.module, 'view')
    return true
  })

  // Filter dropdown items
  filteredItems.forEach(item => {
    if (item.hasDropdown && item.dropdownItems) {
      item.dropdownItems = item.dropdownItems.filter(sub => canPerform(sub.module, 'view'))
    }
  })

  return `
    <!-- Mobile hamburger button -->
    <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- Mobile overlay -->
    <div class="mobile-overlay" onclick="closeMobileMenu()"></div>
    
    <nav class="sidebar">
      <div class="sidebar-header">
        <div class="logo-container">
          <img src="../assets/logo.png" alt="Air Medical 24x7" class="sidebar-logo">
        </div>
        <div class="d-flex align-items-center mt-2">
          <p class="text-white-50 small mb-0 user-name"></p>
        </div>

      </div>

      <ul class="nav-menu">
        ${filteredItems.map(item => {
    const hideClass = item.page === 'quotations' ? 'd-none-quotation' : '';
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'medical-assessment' || currentPage === 'quotation-control' || currentPage === 'equipment-checklist' || currentPage === 'cases' || currentPage === 'calls' || currentPage === 'meetings' || currentPage === 'expenses' || currentPage === 'vendors';
      return `
              <li class="nav-item-dropdown ${isLeadsActive ? 'dropdown-active' : ''} ${hideClass}">
                <a href="#" class="nav-link ${isLeadsActive ? 'active' : ''}" onclick="toggleDropdown(event, this)">
                  <i class="fas ${item.icon}"></i> 
                  <span>${item.label}</span>
                  <i class="fas fa-chevron-down ms-auto dropdown-arrow"></i>
                </a>
                <div class="nav-dropdown ${isLeadsActive ? 'show' : ''}">
                  <a href="leads.html" class="nav-dropdown-link ${currentPage === 'leads' ? 'active' : ''}">
                    <i class="fas fa-list"></i> All Leads
                  </a>
                  ${item.dropdownItems.map(subItem => `
                    <a href="${subItem.page}.html" class="nav-dropdown-link ${currentPage === subItem.page ? 'active' : ''}">
                      <i class="fas ${subItem.icon}"></i> ${subItem.label}
                    </a>
                  `).join('')}
                </div>
              </li>
            `;
    } else {
      return `
              <li class="${hideClass}">
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> <span>${item.label}</span>
                </a>
              </li>
            `;
    }
  }).join('')}
        <li>
          <a href="#" onclick="logout(); return false;" class="nav-link">
            <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
          </a>
        </li>
      </ul>
    </nav>
  `
}

// Generate admin sidebar navigation
function generateAdminNav(currentPage) {
  const navItems = [
    { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { page: 'users', icon: 'fa-users', label: 'Users' },
    { page: 'attendance', icon: 'fa-clock', label: 'Attendance' },
    {
      page: 'leads',
      icon: 'fa-bullseye',
      label: 'Leads',
      hasDropdown: true,
      dropdownItems: [
        { page: 'medical-assessment', icon: 'fa-stethoscope', label: 'Medical Assessment' },
        { page: 'quotation-control', icon: 'fa-file-invoice-dollar', label: 'Quotation Control' },
        { page: 'equipment-checklist', icon: 'fa-clipboard-check', label: 'Equipment Checklist' },
        { page: 'cases', icon: 'fa-briefcase', label: 'Cases' },
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' },
        { page: 'expenses', icon: 'fa-receipt', label: 'Expenses' },
        { page: 'vendors', icon: 'fa-handshake', label: 'Vendors' }
      ]
    },
    { page: 'quotations', icon: 'fa-file-invoice-dollar', label: 'Quotations' },
    { page: 'reports', icon: 'fa-chart-line', label: 'Reports' },
    { page: 'manual', icon: 'fa-book-open', label: 'User Manual' },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

  const session = getCurrentSession()
  if (session && session.role === 'super_admin') {
    // Insert Permissions link after Users
    navItems.splice(2, 0, { page: 'permissions', icon: 'fa-shield-alt', label: 'Permissions' })
  }

  return `
    <!-- Mobile hamburger button -->
    <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- Mobile overlay -->
    <div class="mobile-overlay" onclick="closeMobileMenu()"></div>
    
    <nav class="sidebar">
      <div class="sidebar-header">
        <div class="logo-container">
          <img src="../assets/logo.png" alt="Air Medical 24x7" class="sidebar-logo">
        </div>
        <div class="d-flex align-items-center mt-2">
          <p class="text-white-50 small mb-0 user-name"></p>
        </div>

      </div>

      <ul class="nav-menu">
        ${navItems.map(item => {
    const hideClass = item.page === 'quotations' ? 'd-none-quotation' : '';
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'medical-assessment' || currentPage === 'quotation-control' || currentPage === 'equipment-checklist' || currentPage === 'cases' || currentPage === 'calls' || currentPage === 'meetings' || currentPage === 'expenses' || currentPage === 'vendors';
      return `
              <li class="nav-item-dropdown ${isLeadsActive ? 'dropdown-active' : ''} ${hideClass}">
                <a href="#" class="nav-link ${isLeadsActive ? 'active' : ''}" onclick="toggleDropdown(event, this)">
                  <i class="fas ${item.icon}"></i> 
                  <span>${item.label}</span>
                  <i class="fas fa-chevron-down ms-auto dropdown-arrow"></i>
                </a>
                <div class="nav-dropdown ${isLeadsActive ? 'show' : ''}">
                  <a href="leads.html" class="nav-dropdown-link ${currentPage === 'leads' ? 'active' : ''}">
                    <i class="fas fa-list"></i> All Leads
                  </a>
                  ${item.dropdownItems.map(subItem => `
                    <a href="${subItem.page}.html" class="nav-dropdown-link ${currentPage === subItem.page ? 'active' : ''}">
                      <i class="fas ${subItem.icon}"></i> ${subItem.label}
                    </a>
                  `).join('')}
                </div>
              </li>
            `;
    } else {
      return `
              <li class="${hideClass}">
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> <span>${item.label}</span>
                </a>
              </li>
            `;
    }
  }).join('')}
        <li>
          <a href="#" onclick="logout(); return false;" class="nav-link">
            <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
          </a>
        </li>
      </ul>
    </nav>
  `
}

// Insert navigation
function insertNav(role, currentPage) {
  const appDiv = document.getElementById('app')
  if (!appDiv) return

  const nav = role === 'admin'
    ? generateAdminNav(currentPage)
    : generateUserNav(currentPage)

  appDiv.insertAdjacentHTML('afterbegin', nav)
  
  // Apply permission guards to any element with data-module/data-action
  applyUIGuards()
  
  // Inject mobile-only header actions (like logout)
  injectMobileHeaderActions()
}

/**
 * Scans a container for elements with data-module and data-action attributes
 * and removes them if the user doesn't have permission.
 * Optimized to take an optional container to avoid full-page scans.
 */
function applyUIGuards(container = document) {
  // If container is a string, assume it's a selector
  const root = typeof container === 'string' ? document.querySelector(container) : container
  if (!root) return

  root.querySelectorAll('[data-module]').forEach(el => {
    const module = el.dataset.module
    const action = el.dataset.action || 'view'
    
    if (!canPerform(module, action)) {
      el.remove()
    }
  })
  
  // Also check for data-role guards
  root.querySelectorAll('[data-role]').forEach(el => {
    const session = getCurrentSession()
    if (!session || session.role !== el.dataset.role) {
      el.remove()
    }
  })
}

// Re-run guards when offcanvas or modals are shown (optimized for target content)
document.addEventListener('shown.bs.offcanvas', function(e) { applyUIGuards(e.target) })
document.addEventListener('shown.bs.modal', function(e) { applyUIGuards(e.target) })
// Also run on DOMContentLoaded as a safety net
document.addEventListener('DOMContentLoaded', function() { applyUIGuards() })

/**
 * Injects a logout button into the page header on mobile devices.
 */
function injectMobileHeaderActions() {
  if (window.innerWidth > 768) return
  
  const pageHeader = document.querySelector('.page-header')
  if (!pageHeader) return
  
  // Check if settings button already exists
  if (document.getElementById('mobile-header-settings')) return
  
  const isUserPage = window.location.pathname.includes('/user/')
  const settingsLink = isUserPage ? 'user-details.html' : 'settings.html'
  
  const settingsBtn = `
    <a href="${settingsLink}" id="mobile-header-settings" class="d-md-none" 
       aria-label="Settings and Profile">
      <i class="fas fa-cog"></i>
    </a>
  `
  
  // Insert at the start of the header
  pageHeader.insertAdjacentHTML('afterbegin', settingsBtn)
}

// Show loading state
function showLoading() {
  const loader = document.createElement('div')
  loader.id = 'loading-overlay'
  loader.className = 'loading-overlay'
  loader.innerHTML = '<div class="spinner-border text-primary" role="status"></div>'
  document.body.appendChild(loader)
}

function hideLoading() {
  const loader = document.getElementById('loading-overlay')
  if (loader) loader.remove()
}

// Show toast notification
function showToast(message, type = 'success') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification')
  existingToasts.forEach(t => t.remove())

  const toast = document.createElement('div')
  toast.className = `toast-notification toast-${type}`
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
    ${message}
  `
  document.body.appendChild(toast)

  setTimeout(() => toast.classList.add('show'), 100)
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Mobile menu toggle functions
function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.mobile-overlay')
  const toggleBtn = document.querySelector('.mobile-menu-toggle i')

  if (sidebar && overlay) {
    const isActive = sidebar.classList.toggle('mobile-active')
    overlay.classList.toggle('active')
    document.body.classList.toggle('menu-open')

    // Change icon between bars and times
    if (toggleBtn) {
      toggleBtn.className = isActive ? 'fas fa-times' : 'fas fa-bars'
    }
  }
}

function toggleDropdown(event, element) {
  event.preventDefault();
  const parent = element.parentElement;
  const dropdown = parent.querySelector('.nav-dropdown');
  const arrow = element.querySelector('.dropdown-arrow');

  const isOpen = dropdown.classList.contains('show');

  // Toggle classes instead of inline styles
  dropdown.classList.toggle('show');
  parent.classList.toggle('dropdown-active');

  if (arrow) {
    arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.mobile-overlay')
  const toggleBtn = document.querySelector('.mobile-menu-toggle i')

  if (sidebar && overlay) {
    sidebar.classList.remove('mobile-active')
    overlay.classList.remove('active')
    document.body.classList.remove('menu-open')

    if (toggleBtn) {
      toggleBtn.className = 'fas fa-bars'
    }
  }
}

// Close mobile menu when clicking on navigation links (delegated event listener)
// But don't close if it's a dropdown toggle that just opens a submenu
document.addEventListener('click', function (e) {
  const navLink = e.target.closest('.nav-link')
  if (navLink) {
    // Check if this link is a dropdown toggle
    const isDropdownToggle = navLink.parentElement.classList.contains('nav-item-dropdown') || navLink.querySelector('.dropdown-arrow')

    if (isDropdownToggle) {
      // It's a toggle, don't close the menu
      return
    }

    // It's a regular navigation link, close the menu
    closeMobileMenu()
  }

  // Also close for sub-links
  if (e.target.closest('.nav-dropdown-link')) {
    closeMobileMenu()
  }
})

/**
 * Export data to CSV and trigger download
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file (without extension)
 * @param {Array} headers - Optional array of header names
 */
function exportToCSV(data, fileName, headers) {
  if (!data || !data.length) {
    showToast('No data to export', 'error');
    return;
  }

  // If headers not provided, use keys from first object
  const columns = headers || Object.keys(data[0]);

  // Create CSV rows
  const csvRows = [];

  // Add headers
  csvRows.push(columns.join(','));

  // Add data rows
  for (const row of data) {
    const values = columns.map(header => {
      // Find the corresponding key in the data object
      // This handles cases where headers might not match keys exactly
      const key = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase().replace(/\s/g, '_')) || header.toLowerCase().replace(/\s/g, '_');
      let val = row[key] !== undefined ? row[key] : (row[header] !== undefined ? row[header] : '');

      // Handle nulls and commas
      if (val === null || val === undefined) val = '';
      val = val.toString().replace(/"/g, '""'); // Escape double quotes
      if (val.search(/("|,|\n)/g) >= 0) val = `"${val}"`; // Wrap in quotes if needed
      return val;
    });
    csvRows.push(values.join(','));
  }

  // Create blob and download
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${getCurrentDateString()}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Data exported successfully!', 'success');
}

// =============================================
// MOBILE UX OVERHAUL — NEW FUNCTIONS BELOW
// 100% additive. No existing functions modified.
// =============================================

/**
 * Generate the mobile bottom navigation bar for USER pages.
 * @param {string} currentPage - e.g. 'dashboard', 'leads', 'cases'
 */
function generateBottomNav(currentPage) {
  const leadsPages = ['leads', 'medical-assessment', 'quotation-control', 'equipment-checklist', 'cases', 'calls', 'meetings', 'expenses', 'vendors']
  const isLeadsGroup = leadsPages.includes(currentPage)

  // Check if user has access to any module in the Leads group
  const hasAnyLeadsAccess = canPerform('leads', 'view') || canPerform('medical_assessment', 'view') || canPerform('quotation_control', 'view') || canPerform('equipment_checklist', 'view') || canPerform('cases', 'view') || canPerform('calls', 'view') || canPerform('meetings', 'view') || canPerform('expenses', 'view') || canPerform('vendors', 'view')

  const html = `
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Mobile navigation">
      <a href="attendance.html" class="mobile-bottom-nav-item ${currentPage === 'attendance' ? 'active' : ''}">
        <i class="fas fa-clock"></i>
        <span>Attendance</span>
      </a>
      <a href="user-details.html" class="mobile-bottom-nav-item ${currentPage === 'user-details' ? 'active' : ''}">
        <i class="fas fa-id-card"></i>
        <span>Details</span>
      </a>
      <a href="dashboard.html" class="mobile-bottom-nav-item center-floating ${currentPage === 'dashboard' ? 'active' : ''}">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </a>
      <a href="work-report.html" class="mobile-bottom-nav-item ${currentPage === 'work-report' ? 'active' : ''}">
        <i class="fas fa-file-alt"></i>
        <span>Report</span>
      </a>
      ${hasAnyLeadsAccess ? `
      <a href="leads.html" class="mobile-bottom-nav-item ${isLeadsGroup ? 'active' : ''}">
        <i class="fas fa-bullseye"></i>
        <span>Leads</span>
      </a>
      ` : ''}
    </nav>
  `
  document.body.insertAdjacentHTML('beforeend', html)
}

/**
 * Generate the mobile bottom navigation bar for ADMIN pages.
 * @param {string} currentPage - e.g. 'dashboard', 'leads', 'users', 'reports'
 */
function generateAdminBottomNav(currentPage) {
  const leadsPages = ['leads', 'medical-assessment', 'quotation-control', 'equipment-checklist', 'cases', 'calls', 'meetings', 'expenses', 'vendors']
  const isLeadsGroup = leadsPages.includes(currentPage)

  const html = `
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Admin mobile navigation">
      <a href="attendance.html" class="mobile-bottom-nav-item ${currentPage === 'attendance' ? 'active' : ''}">
        <i class="fas fa-clock"></i>
        <span>Attendance</span>
      </a>
      <a href="users.html" class="mobile-bottom-nav-item ${currentPage === 'users' ? 'active' : ''}">
        <i class="fas fa-users"></i>
        <span>Users</span>
      </a>
      <a href="dashboard.html" class="mobile-bottom-nav-item center-floating ${currentPage === 'dashboard' ? 'active' : ''}">
        <i class="fas fa-tachometer-alt"></i>
        <span>Home</span>
      </a>
      <a href="settings.html" class="mobile-bottom-nav-item ${currentPage === 'settings' ? 'active' : ''}">
        <i class="fas fa-sliders-h"></i>
        <span>Settings</span>
      </a>
      <a href="leads.html" class="mobile-bottom-nav-item ${isLeadsGroup ? 'active' : ''}">
        <i class="fas fa-bullseye"></i>
        <span>Leads</span>
      </a>
    </nav>
  `
  document.body.insertAdjacentHTML('beforeend', html)
}

/**
 * Generate the horizontal scrollable Leads sub-tab pill strip.
 * Only visible on mobile (hidden via CSS on desktop).
 * @param {string} currentSubPage - 'leads' | 'cases' | 'calls' | 'meetings' | 'expenses'
 * @param {string} basePath - '../' for user pages, '../' for admin pages (default '')
 */
function generateLeadsSubTabs(currentSubPage, basePath) {
  basePath = basePath || ''

  // Define all tabs with their module identifiers for permission checks
  const allTabs = [
    { id: 'leads',              icon: 'fa-list',                label: 'All Leads',   module: 'leads'              },
    { id: 'medical-assessment', icon: 'fa-stethoscope',         label: 'Medical',     module: 'medical_assessment' },
    { id: 'quotation-control',  icon: 'fa-file-invoice-dollar', label: 'Quotation',   module: 'quotation_control'  },
    { id: 'equipment-checklist', icon: 'fa-clipboard-check',    label: 'Equipment',   module: 'equipment_checklist' },
    { id: 'cases',              icon: 'fa-briefcase',           label: 'Cases',       module: 'cases'              },
    { id: 'calls',              icon: 'fa-phone',               label: 'Calls',       module: 'calls'              },
    { id: 'meetings',           icon: 'fa-video',               label: 'Meetings',    module: 'meetings'           },
    { id: 'expenses',           icon: 'fa-receipt',             label: 'Expenses',    module: 'expenses'           },
    { id: 'vendors',            icon: 'fa-handshake',           label: 'Vendors',     module: 'vendors'            }
  ]

  // Filter tabs based on user permissions (admins/super_admins always pass)
  const tabs = allTabs.filter(tab => canPerform(tab.module, 'view'))

  // If no tabs are accessible, don't render the strip at all
  if (tabs.length === 0) return

  const pills = tabs.map(tab => `
    <a href="${basePath}${tab.id}.html"
       class="mobile-sub-tab-pill ${currentSubPage === tab.id ? 'active' : ''}"
       aria-label="${tab.label}">
      <i class="fas ${tab.icon}"></i>
      ${tab.label}
    </a>
  `).join('')

  const html = `<div class="mobile-sub-tab-strip" id="mobile-sub-tab-strip" role="navigation" aria-label="Leads sub-navigation">${pills}</div>`

  // Improved insertion logic for consistent mobile placement
  const urgent = document.getElementById('urgent-tasks-container')
  const stats = document.querySelector('.dashboard-grid-horizontal')
  const grid = document.querySelector('.dashboard-grid')
  const reportGrid = document.querySelector('.report-cards-grid')
  const rowStats = document.querySelector('.main-content > .row.mb-3') // Common for expenses/other pages
  const contentCard = document.querySelector('.main-content > .content-card') // Fallback for meetings/leads
  
  if (urgent) {
    urgent.insertAdjacentHTML('afterend', html)
  } else if (stats) {
    stats.insertAdjacentHTML('afterend', html)
  } else if (grid) {
    grid.insertAdjacentHTML('afterend', html)
  } else if (reportGrid) {
    reportGrid.insertAdjacentHTML('afterend', html)
  } else if (rowStats) {
    rowStats.insertAdjacentHTML('afterend', html)
  } else if (contentCard) {
    contentCard.insertAdjacentHTML('beforebegin', html)
  } else {
    const mainContent = document.querySelector('.main-content')
    if (mainContent) {
      mainContent.insertAdjacentHTML('afterbegin', html)
    }
  }
}

/**
 * Generate skeleton loader cards shown while data is loading.
 * @param {number} count - Number of skeleton cards to render
 * @returns {string} HTML string
 */
function generateSkeletonCards(count) {
  count = count || 3
  let html = ''
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
          <div class="skeleton-header"></div>
          <div class="skeleton-badge"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:14px;">
          <div><div class="skeleton-line w-40" style="margin-bottom:4px;height:10px;"></div><div class="skeleton-line w-80"></div></div>
          <div><div class="skeleton-line w-40" style="margin-bottom:4px;height:10px;"></div><div class="skeleton-line w-60"></div></div>
          <div><div class="skeleton-line w-40" style="margin-bottom:4px;height:10px;"></div><div class="skeleton-line w-80"></div></div>
          <div><div class="skeleton-line w-40" style="margin-bottom:4px;height:10px;"></div><div class="skeleton-line w-60"></div></div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="skeleton-badge" style="width:100px;height:28px;border-radius:6px;"></div>
          <div class="skeleton-badge" style="width:80px;height:28px;border-radius:6px;"></div>
        </div>
      </div>
    `
  }
  return html
}

/**
 * Activate bottom-sheet behaviour for ALL modals on mobile.
 * On desktop this function exits immediately — zero side effects.
 */
function activateBottomSheetModals() {
  if (window.innerWidth > 768) return
  document.querySelectorAll('.modal').forEach(function (modal) {
    modal.classList.add('modal-bottom-sheet')
  })
}

// Auto-activate bottom sheets after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', activateBottomSheetModals)
} else {
  activateBottomSheetModals()
}
// END OF MOBILE UX OVERHAUL FUNCTIONS

/**
 * Universal History/Timeline Modal
 * Fetches and displays activity logs for a specific record.
 */
async function showHistoryModal(module, recordId, title = 'Record History') {
  // Ensure modal HTML exists in document
  if (!document.getElementById('universalHistoryModal')) {
    const modalHtml = `
      <div class="modal fade" id="universalHistoryModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="historyModalLabel">Timeline: ${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0">
              <div id="history-timeline-content" class="timeline-container p-4">
                <div class="text-center py-4">
                  <div class="spinner-border text-primary" role="status"></div>
                  <p class="mt-2 text-muted">Fetching history...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  const modalEl = document.getElementById('universalHistoryModal');
  const modal = new bootstrap.Modal(modalEl);
  document.getElementById('historyModalLabel').textContent = `Timeline: ${title}`;
  modal.show();

  try {
    const logs = await getActivityLogs(module, recordId);
    const content = document.getElementById('history-timeline-content');

    if (!logs || logs.length === 0) {
      content.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-history fa-2x mb-3 opacity-50"></i><p>No activity recorded yet.</p></div>`;
      return;
    }

    content.innerHTML = logs.map(log => {
      const date = new Date(log.created_at);
      const actionClass = {
        'CREATED': 'bg-success',
        'UPDATED': 'bg-primary',
        'DELETED': 'bg-danger'
      }[log.action] || 'bg-secondary';

      return `
        <div class="timeline-item d-flex gap-3 mb-4">
          <div class="timeline-icon-wrap">
            <div class="timeline-icon ${actionClass}">
              <i class="fas ${log.action === 'CREATED' ? 'fa-plus' : log.action === 'UPDATED' ? 'fa-pen' : 'fa-trash'}"></i>
            </div>
            <div class="timeline-line"></div>
          </div>
          <div class="timeline-content flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <h6 class="mb-1">${log.action}</h6>
              <span class="text-muted small">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <p class="mb-1 text-dark small">Action by <strong>${log.users?.name || log.users?.email || 'Unknown User'}</strong></p>
            ${log.details && Object.keys(log.details).length > 0 ? `
              <div class="bg-light p-2 rounded small mt-2 border-start border-3 border-secondary">
                ${Object.entries(log.details).map(([key, val]) => `<div><span class="text-muted">${key}:</span> ${typeof val === 'object' ? JSON.stringify(val) : val}</div>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error fetching history:', error);
    document.getElementById('history-timeline-content').innerHTML = `<div class="alert alert-danger m-3">Failed to load history.</div>`;
  }
}

// =============================================
// PIPELINE RECORD NAME & INITIALS HELPERS
// =============================================

/**
 * Get uppercase initials from a patient name.
 * e.g. "Rajesh Kumar" -> "R.K.", "Maria" -> "M.", "" -> "N.A."
 */
function getPatientInitials(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return 'N.A.';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'N.A.';
  if (words.length === 1) return `${words[0][0].toUpperCase()}.`;
  return `${words[0][0].toUpperCase()}.${words[1][0].toUpperCase()}.`;
}

/**
 * Build standard record_name format:
 * "{Route} – {Service Type} – {Patient Initials} – {Date} – {Sequence}"
 * Example: "Dubai to Chennai – Air Ambulance – R.K. – 24 Jun 2026 – 14"
 */
function buildRecordName({ currentCity, destCity, serviceType, patientName, travelDate, masterRefId }) {
  const fromCity = (currentCity && currentCity.trim()) ? currentCity.trim() : 'TBD';
  const toCity = (destCity && destCity.trim()) ? destCity.trim() : 'TBD';
  const route = `${fromCity} to ${toCity}`;

  const service = (serviceType && serviceType.trim()) ? serviceType.trim() : 'Service TBD';
  const initials = getPatientInitials(patientName);

  let formattedDate = 'TBD';
  if (travelDate) {
    const d = new Date(travelDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      formattedDate = `${day} ${month} ${year}`;
    }
  }

  let seq = '00';
  if (masterRefId && typeof masterRefId === 'string') {
    const parts = masterRefId.split('-');
    if (parts.length >= 3) {
      seq = parts[parts.length - 1];
    }
  }

  return `${route} – ${service} – ${initials} – ${formattedDate} – ${seq}`;
}

/**
 * Handle lead_source onChange event to dynamically show referral lookup dropdown
 */
async function handleLeadSourceChange(sourceVal, containerId = 'referral-partner-container', selectId = 'referral-partner-select') {
  const container = document.getElementById(containerId);
  const select = document.getElementById(selectId);
  if (!container || !select) return;

  const sourceTableMap = {
    'Hospital Referral': 'hospital_referral',
    'Embassy Referral': 'embassy_referral',
    'Insurance Referral': 'insurance_referral',
    'Assistance Company': 'corporate_referral',
    'Vendor Referral': 'vendor_referral',
    'Doctor Referral': 'doctor_referral',
    'Medical Tourism Partner': 'medical_tourism_partner'
  };

  const targetTable = sourceTableMap[sourceVal];
  if (!targetTable) {
    container.style.display = 'none';
    select.innerHTML = '<option value="">Select Partner...</option>';
    return;
  }

  container.style.display = 'block';
  select.innerHTML = '<option value="">Loading partners...</option>';

  try {
    const list = await getReferralRecords(targetTable);
    if (!list || list.length === 0) {
      select.innerHTML = '<option value="">No partners found in category</option>';
      return;
    }
    select.innerHTML = '<option value="">Select Partner...</option>' +
      list.map(r => `<option value="${r.id}" data-name="${r.name || ''}" data-email="${r.email || ''}" data-phone="${r.phone || ''}" data-wa="${r.whatsapp_number || ''}" data-alt="${r.alternate_contact_number || ''}">${r.name}</option>`).join('');
    select.dataset.targetTable = targetTable;
  } catch (err) {
    console.error('Error fetching referral records:', err);
    select.innerHTML = '<option value="">Error loading partners</option>';
  }
}

/**
 * Handle auto-fill when a referral partner is selected from dropdown
 */
function handleReferralPartnerAutoFill(selectId = 'referral-partner-select', fieldPrefix = 'lead-') {
  const select = document.getElementById(selectId);
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;

  const name = opt.dataset.name;
  const email = opt.dataset.email;
  const phone = opt.dataset.phone;
  const wa = opt.dataset.wa;
  const alt = opt.dataset.alt;

  function setIfVal(fieldId, val) {
    const el = document.getElementById(fieldId);
    if (el && val && val.trim() !== '') {
      el.value = val.trim();
    }
  }

  setIfVal(`${fieldPrefix}name`, name);
  setIfVal('contact-person-name', name);
  setIfVal(`${fieldPrefix}contact`, phone);
  setIfVal(`${fieldPrefix}phone`, phone);
  setIfVal(`${fieldPrefix}email`, email);
  setIfVal('whatsapp-number', wa);
  setIfVal('alternate-contact-number', alt);
}

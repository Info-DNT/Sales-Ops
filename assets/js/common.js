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
      hasDropdown: true,
      dropdownItems: [
        { page: 'cases', icon: 'fa-briefcase', label: 'Cases' },
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' },
        { page: 'expenses', icon: 'fa-receipt', label: 'Expenses' }
      ]
    },
    { page: 'manual', icon: 'fa-book-open', label: 'User Manual' },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

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
        <p class="text-white-50 small mb-0 mt-2 user-name"></p>
      </div>

      <ul class="nav-menu">
        ${navItems.map(item => {
    const hideClass = item.page === 'quotations' ? 'd-none-quotation' : '';
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'cases' || currentPage === 'calls' || currentPage === 'meetings' || currentPage === 'expenses';
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
        { page: 'cases', icon: 'fa-briefcase', label: 'Cases' },
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' },
        { page: 'expenses', icon: 'fa-receipt', label: 'Expenses' }
      ]
    },
    { page: 'quotations', icon: 'fa-file-invoice-dollar', label: 'Quotations' },
    { page: 'reports', icon: 'fa-chart-line', label: 'Reports' },
    { page: 'manual', icon: 'fa-book-open', label: 'User Manual' },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

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
        <p class="text-white-50 small mb-0 mt-2 user-name"></p>
      </div>

      <ul class="nav-menu">
        ${navItems.map(item => {
    const hideClass = item.page === 'quotations' ? 'd-none-quotation' : '';
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'cases' || currentPage === 'calls' || currentPage === 'meetings' || currentPage === 'expenses';
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
  
  // Inject mobile-only header actions (like logout)
  injectMobileHeaderActions()
}

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
  const leadsPages = ['leads', 'cases', 'calls', 'meetings', 'expenses']
  const isLeadsGroup = leadsPages.includes(currentPage)

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
      <a href="leads.html" class="mobile-bottom-nav-item ${isLeadsGroup ? 'active' : ''}">
        <i class="fas fa-bullseye"></i>
        <span>Leads</span>
      </a>
    </nav>
  `
  document.body.insertAdjacentHTML('beforeend', html)
}

/**
 * Generate the mobile bottom navigation bar for ADMIN pages.
 * @param {string} currentPage - e.g. 'dashboard', 'leads', 'users', 'reports'
 */
function generateAdminBottomNav(currentPage) {
  const leadsPages = ['leads', 'cases', 'calls', 'meetings', 'expenses']
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
        <i class="fas fa-cog"></i>
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
  const tabs = [
    { id: 'leads',    icon: 'fa-list',     label: 'All Leads' },
    { id: 'cases',    icon: 'fa-briefcase',label: 'Cases'     },
    { id: 'calls',    icon: 'fa-phone',    label: 'Calls'     },
    { id: 'meetings', icon: 'fa-video',    label: 'Meetings'  },
    { id: 'expenses', icon: 'fa-receipt',  label: 'Expenses'  }
  ]

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

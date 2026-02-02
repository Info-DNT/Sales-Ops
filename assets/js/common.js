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
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' }
      ]
    },
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
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'calls' || currentPage === 'meetings';
      return `
              <li class="nav-item-dropdown ${isLeadsActive ? 'dropdown-active' : ''}">
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
              <li>
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
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' }
      ]
    },
    { page: 'quotations', icon: 'fa-file-invoice-dollar', label: 'Quotations' },
    { page: 'reports', icon: 'fa-chart-line', label: 'Reports' },
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
    if (item.hasDropdown) {
      const isLeadsActive = currentPage === 'leads' || currentPage === 'calls' || currentPage === 'meetings';
      return `
              <li class="nav-item-dropdown ${isLeadsActive ? 'dropdown-active' : ''}">
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
              <li>
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

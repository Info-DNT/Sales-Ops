// Application State Management
const appState = {
  currentUser: {},
  attendance: [],
  workReport: {},
  quotations: [],
  leads: [],
}

// Bootstrap Modal Library
const bootstrap = {
  Modal: {
    getInstance: (element) => ({
      hide: () => {
        element.style.display = "none"
      },
    }),
  },
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  initializeApp()
  setupEventListeners()
  loadDataFromStorage()
  updateDashboard()
  updateCurrentTime()
  setInterval(updateCurrentTime, 1000)
})

// Initialize App
function initializeApp() {
  // console.log("[v0] Initializing application")

  // Set today's date
  const today = new Date()
  const dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  document.getElementById("current-date").textContent = today.toLocaleDateString("en-US", dateOptions)
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault()
      navigateToPage(this.dataset.page)
    })
  })

  // Attendance
  document.getElementById("clock-in-btn").addEventListener("click", clockIn)
  document.getElementById("clock-out-btn").addEventListener("click", clockOut)

  // User Details
  document.getElementById("user-details-form").addEventListener("submit", saveUserDetails)

  // Work Report
  document.getElementById("work-report-form").addEventListener("submit", saveWorkReport)

  // Quotation
  document.getElementById("quotation-form").addEventListener("submit", saveQuotation)

  // Add Lead
  document.getElementById("add-lead-form").addEventListener("submit", addLead)

  // Settings
  document.getElementById("export-btn").addEventListener("click", exportData)
  document.getElementById("clear-btn").addEventListener("click", clearAllData)
}

// Navigation
function navigateToPage(pageName) {
  // console.log("[v0] Navigating to page:", pageName)

  // Hide all pages
  document.querySelectorAll(".page-container").forEach((page) => {
    page.classList.remove("active")
  })

  // Show selected page
  document.getElementById(pageName + "-page").classList.add("active")

  // Update navigation
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active")
    if (link.dataset.page === pageName) {
      link.classList.add("active")
    }
  })

  // Reload page data when navigating
  if (pageName === "user-details") {
    displayUserDetails()
  } else if (pageName === "work-report") {
    displayWorkReport()
  } else if (pageName === "leads") {
    displayLeads()
  } else if (pageName === "attendance") {
    displayAttendanceHistory()
  }
}

// Update Current Time
function updateCurrentTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")

  document.getElementById("current-time").textContent = `${hours}:${minutes}:${seconds}`
}

// ATTENDANCE MODULE
function clockIn() {
  // console.log("[v0] Clock in clicked")

  const now = new Date()
  const today = now.toISOString().split("T")[0]

  // Check if already clocked in today
  const todayRecord = appState.attendance.find((record) => record.date === today && record.clockOut === null)

  if (todayRecord) {
    alert("Already clocked in today. Please clock out first.")
    return
  }

  const clockInTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  const attendanceRecord = {
    id: Date.now(),
    date: today,
    clockIn: clockInTime,
    clockOut: null,
    hours: 0,
  }

  appState.attendance.push(attendanceRecord)
  saveDataToStorage()

  // Update UI
  document.getElementById("clock-in-btn").disabled = true
  document.getElementById("clock-out-btn").disabled = false
  document.getElementById("clock-in-time").textContent = clockInTime
  document.getElementById("attendance-time-status").textContent = "Currently Working"
  document.getElementById("attendance-status").textContent = "Clocked In"

  // console.log("[v0] Clocked in at:", clockInTime)
}

function clockOut() {
  // console.log("[v0] Clock out clicked")

  const now = new Date()
  const today = now.toISOString().split("T")[0]

  const todayRecord = appState.attendance.find((record) => record.date === today && record.clockOut === null)

  if (!todayRecord) {
    alert("No active clock-in found for today.")
    return
  }

  const clockOutTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  todayRecord.clockOut = clockOutTime

  // Calculate hours worked
  const clockInDate = new Date(`2000-01-01 ${todayRecord.clockIn}`)
  const clockOutDate = new Date(`2000-01-01 ${clockOutTime}`)
  const diffMs = clockOutDate - clockInDate
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  todayRecord.hours = diffHours + diffMinutes / 60

  saveDataToStorage()

  // Update UI
  document.getElementById("clock-in-btn").disabled = false
  document.getElementById("clock-out-btn").disabled = true
  document.getElementById("clock-out-time").textContent = clockOutTime
  document.getElementById("hours-worked").textContent = `${diffHours}h ${diffMinutes}m`
  document.getElementById("attendance-time-status").textContent = "Shift Completed"
  document.getElementById("attendance-status").textContent = "Clocked Out"

  // console.log("[v0] Clocked out at:", clockOutTime)
  alert(`Shift completed! Hours worked: ${diffHours}h ${diffMinutes}m`)
}

function displayAttendanceHistory() {
  // console.log("[v0] Displaying attendance history")

  const historyContainer = document.getElementById("attendance-history")

  if (appState.attendance.length === 0) {
    historyContainer.innerHTML = '<p class="text-muted">No records yet.</p>'
    return
  }

  // Sort by date descending
  const sortedAttendance = [...appState.attendance].sort((a, b) => new Date(b.date) - new Date(a.date))

  historyContainer.innerHTML = sortedAttendance
    .map(
      (record) => `
        <div class="history-item">
            <div class="history-item-header">
                <span class="history-item-date">${new Date(record.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span class="history-item-duration">${Math.floor(record.hours)}h ${Math.round((record.hours % 1) * 60)}m</span>
            </div>
            <div class="history-times">
                <span><strong>In:</strong> ${record.clockIn}</span>
                <span><strong>Out:</strong> ${record.clockOut || "Pending"}</span>
            </div>
        </div>
    `,
    )
    .join("")
}

// USER DETAILS MODULE
function saveUserDetails(e) {
  // console.log("[v0] Saving user details")

  e.preventDefault()

  appState.currentUser = {
    name: document.getElementById("user-name").value,
    designation: document.getElementById("user-designation").value,
    contact: document.getElementById("user-contact").value,
    email: document.getElementById("user-email").value,
  }

  saveDataToStorage()
  displayUserDetails()
  alert("User details saved successfully!")

  // console.log("[v0] User details saved:", appState.currentUser)
}

function displayUserDetails() {
  // console.log("[v0] Displaying user details")

  const displayContainer = document.getElementById("user-details-display")

  if (!appState.currentUser.name) {
    displayContainer.innerHTML = '<p class="text-muted">No details saved yet.</p>'
    return
  }

  displayContainer.innerHTML = `
        <div class="user-info-card">
            <p><strong>Name:</strong> ${appState.currentUser.name}</p>
            <p><strong>Designation:</strong> ${appState.currentUser.designation || "Not specified"}</p>
            <p><strong>Contact Number:</strong> ${appState.currentUser.contact || "Not specified"}</p>
            <p><strong>Email:</strong> ${appState.currentUser.email || "Not specified"}</p>
        </div>
    `
}

// WORK REPORT MODULE
function saveWorkReport(e) {
  // console.log("[v0] Saving work report")

  e.preventDefault()

  appState.workReport = {
    totalCalls: Number.parseInt(document.getElementById("total-calls-input").value) || 0,
    totalMeetings: Number.parseInt(document.getElementById("total-meetings-input").value) || 0,
    totalLeads: Number.parseInt(document.getElementById("total-leads-input").value) || 0,
    newLeadsGenerated: Number.parseInt(document.getElementById("new-leads-generated").value) || 0,
    leadsInPipeline: Number.parseInt(document.getElementById("leads-in-pipeline").value) || 0,
    date: new Date().toISOString().split("T")[0],
  }

  saveDataToStorage()
  displayWorkReport()
  alert("Work report saved successfully!")
  updateDashboard()

  // console.log("[v0] Work report saved:", appState.workReport)
}

function displayWorkReport() {
  // console.log("[v0] Displaying work report")

  const displayContainer = document.getElementById("work-report-display")

  if (!appState.workReport.date) {
    displayContainer.innerHTML = '<p class="text-muted">No data entered yet.</p>'
    return
  }

  displayContainer.innerHTML = `
        <div class="report-item">
            <span class="report-item-label">Total Calls</span>
            <span class="report-item-value">${appState.workReport.totalCalls}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">Total Meetings</span>
            <span class="report-item-value">${appState.workReport.totalMeetings}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">Total Leads</span>
            <span class="report-item-value">${appState.workReport.totalLeads}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">New Leads Generated</span>
            <span class="report-item-value">${appState.workReport.newLeadsGenerated}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">Leads In Pipeline</span>
            <span class="report-item-value">${appState.workReport.leadsInPipeline}</span>
        </div>
    `
}

// QUOTATION MODULE
function saveQuotation(e) {
  // console.log("[v0] Saving quotation")

  e.preventDefault()

  const quotation = {
    id: Date.now(),
    clientName: document.getElementById("quotation-client").value,
    amount: Number.parseFloat(document.getElementById("quotation-amount").value),
    description: document.getElementById("quotation-description").value,
    createdDate: new Date().toLocaleDateString("en-US"),
  }

  appState.quotations.push(quotation)
  saveDataToStorage()
  updateDashboard()

  // Reset form and close modal
  document.getElementById("quotation-form").reset()
  const modal = bootstrap.Modal.getInstance(document.getElementById("quotationModal"))
  modal.hide()

  alert("Quotation created successfully!")
  // console.log("[v0] Quotation saved:", quotation)
}

function displayRecentQuotations() {
  // console.log("[v0] Displaying recent quotations")

  const quotationContainer = document.getElementById("recent-quotations")

  if (appState.quotations.length === 0) {
    quotationContainer.innerHTML = '<p class="text-muted">No quotations yet. Create one to get started.</p>'
    return
  }

  const recentQuotations = appState.quotations.slice(-5).reverse()

  quotationContainer.innerHTML = recentQuotations
    .map(
      (quotation) => `
        <div class="quotation-item">
            <div class="quotation-info">
                <h6>${quotation.clientName}</h6>
                <p>${quotation.description || "No description"}</p>
                <p class="small text-muted">Created: ${quotation.createdDate}</p>
            </div>
            <div class="quotation-amount">₹${quotation.amount.toLocaleString("en-IN")}</div>
        </div>
    `,
    )
    .join("")
}

// LEADS MODULE
function addLead(e) {
  // console.log("[v0] Adding new lead")

  e.preventDefault()

  const lead = {
    id: Date.now(),
    name: document.getElementById("lead-name").value,
    contact: document.getElementById("lead-contact").value,
    email: document.getElementById("lead-email").value,
    owner: document.getElementById("lead-owner").value,
    status: document.getElementById("lead-status").value,
    accountName: document.getElementById("lead-account").value,
    followUpDate: document.getElementById("follow-up-date").value,
    nextAction: document.getElementById("next-action").value,
    expectedClose: document.getElementById("expected-close").value,
    createdDate: new Date().toISOString().split("T")[0],
  }

  appState.leads.push(lead)
  saveDataToStorage()
  displayLeads()
  updateDashboard()

  // Reset form and close modal
  document.getElementById("add-lead-form").reset()
  const modal = bootstrap.Modal.getInstance(document.getElementById("addLeadModal"))
  modal.hide()

  alert("Lead added successfully!")
  // console.log("[v0] Lead added:", lead)
}

function displayLeads() {
  // console.log("[v0] Displaying leads")

  const leadsContainer = document.getElementById("leads-list")

  if (appState.leads.length === 0) {
    leadsContainer.innerHTML = '<p class="text-muted">No leads added yet. Create one to get started.</p>'
    return
  }

  leadsContainer.innerHTML = appState.leads
    .map(
      (lead) => `
        <div class="lead-card">
            <div class="lead-header">
                <div class="lead-title">
                    <h6>${lead.name}</h6>
                    <p class="text-muted small">${lead.accountName || "No account specified"}</p>
                </div>
                <span class="lead-status-badge ${lead.status.toLowerCase().replace(" ", "-")}">${lead.status}</span>
            </div>

            <div class="lead-details">
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Contact Number</span>
                    <span class="lead-detail-value">${lead.contact}</span>
                </div>
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Email</span>
                    <span class="lead-detail-value">${lead.email}</span>
                </div>
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Lead Owner</span>
                    <span class="lead-detail-value">${lead.owner || "Not assigned"}</span>
                </div>
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Follow-up Date</span>
                    <span class="lead-detail-value">${lead.followUpDate}</span>
                </div>
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Expected Close</span>
                    <span class="lead-detail-value">${lead.expectedClose || "Not specified"}</span>
                </div>
                <div class="lead-detail-item">
                    <span class="lead-detail-label">Created</span>
                    <span class="lead-detail-value">${lead.createdDate}</span>
                </div>
            </div>

            <div class="mt-3 p-2 bg-light rounded">
                <p class="mb-0 text-muted small"><strong>Next Action:</strong> ${lead.nextAction || "No action specified"}</p>
            </div>

            <div class="lead-actions mt-3">
                <button class="btn btn-sm btn-outline-primary" onclick="editLead(${lead.id})">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteLead(${lead.id})">Delete</button>
            </div>
        </div>
    `,
    )
    .join("")
}

function editLead(leadId) {
  // console.log("[v0] Editing lead:", leadId)
  alert("Edit functionality can be implemented. Lead ID: " + leadId)
}

function deleteLead(leadId) {
  // console.log("[v0] Deleting lead:", leadId)

  if (confirm("Are you sure you want to delete this lead?")) {
    appState.leads = appState.leads.filter((lead) => lead.id !== leadId)
    saveDataToStorage()
    displayLeads()
    updateDashboard()
  }
}

// DASHBOARD UPDATE
function updateDashboard() {
  // console.log("[v0] Updating dashboard")

  // Update attendance status
  const today = new Date().toISOString().split("T")[0]
  const todayRecord = appState.attendance.find((record) => record.date === today)

  if (todayRecord && !todayRecord.clockOut) {
    document.getElementById("attendance-status").textContent = "Clocked In"
  } else {
    document.getElementById("attendance-status").textContent = "Not Clocked In"
  }

  // Update stats
  document.getElementById("total-leads").textContent = appState.leads.length
  document.getElementById("total-calls").textContent = appState.workReport.totalCalls || 0
  document.getElementById("total-meetings").textContent = appState.workReport.totalMeetings || 0

  // Update recent quotations
  displayRecentQuotations()
}

// STORAGE MANAGEMENT
function saveDataToStorage() {
  // console.log("[v0] Saving data to localStorage")
  localStorage.setItem("salesAppData", JSON.stringify(appState))
}

function loadDataFromStorage() {
  // console.log("[v0] Loading data from localStorage")

  const storedData = localStorage.getItem("salesAppData")
  if (storedData) {
    try {
      const data = JSON.parse(storedData)
      appState.currentUser = data.currentUser || {}
      appState.attendance = data.attendance || []
      appState.workReport = data.workReport || {}
      appState.quotations = data.quotations || []
      appState.leads = data.leads || []
      // console.log("[v0] Data loaded successfully")
    } catch (error) {
      console.error("[v0] Error loading data:", error)
    }
  }
}

// SETTINGS
function exportData() {
  // console.log("[v0] Exporting data")

  const dataStr = JSON.stringify(appState, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement("a")
  link.href = url
  link.download = `sales-app-data-${new Date().toISOString().split("T")[0]}.json`
  link.click()

  alert("Data exported successfully!")
}

function clearAllData() {
  // console.log("[v0] Clearing all data")

  appState.currentUser = {}
  appState.attendance = []
  appState.workReport = {}
  appState.quotations = []
  appState.leads = []

  localStorage.removeItem("salesAppData")

  // Reset all form fields
  document.querySelectorAll("form").forEach((form) => form.reset())

  // Update displays
  document.getElementById("user-details-display").innerHTML = '<p class="text-muted">No details saved yet.</p>'
  document.getElementById("work-report-display").innerHTML = '<p class="text-muted">No data entered yet.</p>'
  document.getElementById("leads-list").innerHTML = '<p class="text-muted">No leads added yet.</p>'
  document.getElementById("recent-quotations").innerHTML = '<p class="text-muted">No quotations yet.</p>'

  // Reset clock state
  document.getElementById("clock-in-btn").disabled = false
  document.getElementById("clock-out-btn").disabled = true
  document.getElementById("clock-in-time").textContent = "--"
  document.getElementById("clock-out-time").textContent = "--"
  document.getElementById("hours-worked").textContent = "0h 0m"
  document.getElementById("attendance-time-status").textContent = "Not Started"

  updateDashboard()
  alert("All data has been cleared!")
}

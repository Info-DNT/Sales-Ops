// =============================================
// ADMIN-SPECIFIC FUNCTIONALITY
// =============================================

// These functions are now handled by supabase-client.js
// This file is kept for backwards compatibility and any admin-specific UI logic

// Export all data (admin function)
async function exportAllData() {
    try {
        showLoading()

        const [users, leads, quotations, attendance, workReports] = await Promise.all([
            getAllUsers(),
            getAllLeadsAdmin(),
            getAllQuotationsAdmin(),
            getAllAttendanceAdmin(),
            getAllWorkReportsAdmin()
        ])

        const allData = {
            users: users,
            leads: leads,
            quotations: quotations,
            attendance: attendance,
            workReports: workReports,
            exportDate: new Date().toISOString(),
            exportedBy: getCurrentSession()?.email || 'Admin'
        }

        const dataStr = JSON.stringify(allData, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `sales-ops-admin-export-${getCurrentDateString()}.json`
        link.click()

        hideLoading()
        showToast('All data exported successfully!', 'success')
    } catch (error) {
        hideLoading()
        console.error('Export error:', error)
        showToast('Failed to export data', 'error')
    }
}

// Auto-populate date fields with today's date when modals open

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];

    const callDate = document.getElementById('call-date');
    const meetingDate = document.getElementById('meeting-date');
    const leadDate = document.getElementById('lead-date');

    if (callDate) callDate.value = today;
    if (meetingDate) meetingDate.value = today;
    if (leadDate) leadDate.value = today;
}

// Set date when modals open
document.addEventListener('DOMContentLoaded', function () {
    const callModal = document.getElementById('callModal');
    const meetingModal = document.getElementById('meetingModal');
    const leadModal = document.getElementById('leadModal');

    if (callModal) {
        callModal.addEventListener('shown.bs.modal', setTodayDate);
    }

    if (meetingModal) {
        meetingModal.addEventListener('shown.bs.modal', setTodayDate);
    }

    if (leadModal) {
        leadModal.addEventListener('shown.bs.modal', setTodayDate);
    }
});

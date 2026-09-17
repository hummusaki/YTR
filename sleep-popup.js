document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('sleepStatus');
    const start = document.getElementById('sleepStart');
    const cancel = document.getElementById('sleepCancel');
    const input = document.getElementById('sleepMinutes');
    let tabID;
    const unavailable = () => {
        start.disabled = cancel.disabled = true;
        status.textContent = 'Open YouTube and reload the tab to use the timer.';
    };
    const send = (action, minutes) => {
        if (tabID === undefined) return;
        chrome.tabs.sendMessage(tabID, { action, minutes }, response => {
            if (chrome.runtime.lastError || !response) return unavailable();
            if (response.error) { status.textContent = response.error; return; }
            start.disabled = false;
            cancel.disabled = !response.deadline;
            start.textContent = response.deadline ? 'Restart timer' : 'Start timer';
            status.textContent = response.deadline ? `Pauses at ${new Date(response.deadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'No timer running.';
        });
    };
    start.disabled = cancel.disabled = true;
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (chrome.runtime.lastError || !tabs[0]) return unavailable();
        tabID = tabs[0].id;
        send('ytr-sleep-status');
    });
    start.addEventListener('click', () => {
        if (!input.reportValidity()) return;
        send('ytr-sleep-start', Number(input.value));
    });
    cancel.addEventListener('click', () => send('ytr-sleep-cancel'));
    setInterval(() => send('ytr-sleep-status'), 1000);
});

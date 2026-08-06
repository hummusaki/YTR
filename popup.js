const defaultSettings = {
  hideAds: true,
  hideShorts: true,
  hidePosts: true,
  hideMixes: true,
  forceQuality: true
};

document.addEventListener('DOMContentLoaded', () => {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  // Load settings
  chrome.storage.sync.get(defaultSettings, (settings) => {
    checkboxes.forEach((cb) => {
      if (settings[cb.id] !== undefined) {
        cb.checked = settings[cb.id];
      }
    });
  });

  // Save settings on change
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const setting = { [e.target.id]: e.target.checked };
      chrome.storage.sync.set(setting, () => {
        // Send message to active tab to update immediately
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "updateSettings", settings: setting});
          }
        });
      });
    });
  });
});

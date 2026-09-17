const defaultSettings = {
  hideAds: true,
  hideShorts: true,
  hidePosts: true,
  hideMixes: true,
  forceQuality: true,
  videoQuality: null,
  pipPlacement: "player",
  sponsorBlock: false
};

document.addEventListener('DOMContentLoaded', () => {
  const controls = document.querySelectorAll('.toggle-group input[type="checkbox"], .toggle-group select');

  // Load settings
  chrome.storage.sync.get(defaultSettings, (settings) => {
    settings.videoQuality ??= settings.forceQuality === false ? "auto" : "highest";
    controls.forEach((cb) => {
      if (settings[cb.id] !== undefined) {
        if (cb.type === "checkbox") cb.checked = settings[cb.id];
        else cb.value = settings[cb.id];
      }
    });
  });

  // Save settings on change
  controls.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const setting = { [e.target.id]: e.target.type === "checkbox" ? e.target.checked : e.target.value };
      chrome.storage.sync.set(setting);
    });
  });

  // Auto-update checker
  const updateBtn = document.getElementById('updateBtn');
  if (updateBtn) {
    const currentVersion = chrome.runtime.getManifest().version;
    updateBtn.textContent = 'Checking for updates...';
    
    fetch('https://api.github.com/repos/hummusaki/YTR/releases/latest')
      .then(response => response.json())
      .then(data => {
        if (data && data.tag_name) {
          const latestVersion = data.tag_name.replace('v', '');
          if (latestVersion !== currentVersion) {
            updateBtn.textContent = `Update to v${latestVersion}`;
            updateBtn.classList.add('update-available');
            
            // Set up direct download link dynamically based on the release asset
            let downloadUrl = `https://github.com/hummusaki/YTR/releases/latest`;
            if (data.assets && data.assets.length > 0) {
              downloadUrl = data.assets[0].browser_download_url;
            }
            
            updateBtn.addEventListener('click', () => {
              chrome.tabs.create({ url: downloadUrl });
            });
          } else {
            updateBtn.textContent = 'Up to Date ✓';
            updateBtn.style.cursor = 'default';
            updateBtn.style.opacity = '0.7';
            updateBtn.addEventListener('click', (e) => e.preventDefault());
          }
        }
      })
      .catch(err => {
        console.error('Update check failed:', err);
        updateBtn.textContent = 'Update check failed';
      });
  }
});

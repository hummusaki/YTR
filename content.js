let currentSettings = {
    hideAds: true,
    hideShorts: true,
    hidePosts: true,
    hideMixes: true,
    forceQuality: true
};

const applyBodyClasses = () => {
    document.body.classList.toggle('ytr-hide-ads', currentSettings.hideAds);
    document.body.classList.toggle('ytr-hide-shorts', currentSettings.hideShorts);
    document.body.classList.toggle('ytr-hide-posts', currentSettings.hidePosts);
    document.body.classList.toggle('ytr-hide-mixes', currentSettings.hideMixes);
};

// 1. Auto-skip ads
const initObserver = () => {
    const observer = new MutationObserver(() => {
        if (!currentSettings.hideAds) return;
        
        // Find and click skip buttons
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytm-skip-ad-button');
        if (skipButton) {
            skipButton.click();
        }

        // Fast forward video ads that cannot be skipped immediately
        const adVideo = document.querySelector('.ad-showing video, .html5-video-player.ad-showing video');
        if (adVideo && adVideo.playbackRate < 10) {
            adVideo.playbackRate = 16.0;
            adVideo.muted = true;
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

// 2. Inject script for player API access (to force quality)
const injectScript = () => {
    const script = document.createElement('script');
    script.textContent = `
        window.ytrForceQuality = true;
        
        window.addEventListener('message', (e) => {
            if (e.data && e.data.action === 'ytr-update-settings') {
                window.ytrForceQuality = e.data.settings.forceQuality;
            }
        });

        const enforceQuality = () => {
            if (!window.ytrForceQuality) return;
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (player && typeof player.getAvailableQualityLevels === 'function') {
                const levels = player.getAvailableQualityLevels();
                if (levels && levels.length > 0) {
                    const best = levels[0]; 
                    if (player.getPlaybackQuality() !== best) {
                        player.setPlaybackQualityRange(best, best);
                    }
                }
            }
        };

        window.addEventListener('yt-navigate-finish', enforceQuality);
        setInterval(enforceQuality, 2000);
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
};

// 3. PiP Button Injection
const injectPipButton = () => {
    const addBtn = () => {
        // Desktop controls
        let controls = document.querySelector('.ytp-right-controls');
        let isMobile = false;
        
        // Mobile fallback
        if (!controls) {
            // Using a generic approach to find mobile player bottom controls
            controls = document.querySelector('.player-controls-bottom') || document.querySelector('.player-controls-pb');
            isMobile = true;
        }

        // If no primary controls, try next to the like button
        if (!controls) {
            controls = document.querySelector('ytd-menu-renderer, ytm-menu');
        }

        if (controls && !document.getElementById('ytr-pip-btn')) {
            const btn = document.createElement('button');
            btn.id = 'ytr-pip-btn';
            btn.className = isMobile ? 'icon-button' : 'ytp-button';
            btn.title = "Picture-in-Picture";
            // Simple PiP SVG icon
            btn.innerHTML = \`<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%"><path d="M25,17 L17,17 L17,23 L25,23 L25,17 L25,17 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 L29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 L27,25.02 L27,25.02 Z" fill="#fff"></path></svg>\`;
            
            btn.style.width = isMobile ? '40px' : '36px';
            btn.style.height = '100%';
            btn.style.verticalAlign = 'top';
            if (isMobile || controls.tagName === 'YTD-MENU-RENDERER' || controls.tagName === 'YTM-MENU') {
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.padding = '0';
                btn.style.fill = 'currentColor'; // Adapt to dark/light theme
                btn.style.marginRight = '8px';
                btn.style.cursor = 'pointer';
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const video = document.querySelector('video');
                if (video) {
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else {
                        video.requestPictureInPicture();
                    }
                }
            });

            // Insert before fullscreen if on desktop, or prepend
            const fsBtn = document.querySelector('.ytp-fullscreen-button');
            if (fsBtn) {
                controls.insertBefore(btn, fsBtn);
            } else {
                controls.insertBefore(btn, controls.firstChild);
            }
        }
    };

    window.addEventListener('yt-navigate-finish', () => setTimeout(addBtn, 1000));
    setInterval(addBtn, 2000);
    setTimeout(addBtn, 1000);
};

// Initialize
const initialize = () => {
    applyBodyClasses();
    initObserver();
    injectScript();
    injectPipButton();

    // Load initial settings
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(currentSettings, (settings) => {
            currentSettings = { ...currentSettings, ...settings };
            applyBodyClasses();
            window.postMessage({ action: 'ytr-update-settings', settings: currentSettings }, '*');
        });

        // Listen for live updates
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === "updateSettings") {
                currentSettings = { ...currentSettings, ...request.settings };
                applyBodyClasses();
                window.postMessage({ action: 'ytr-update-settings', settings: currentSettings }, '*');
            }
        });
    }
};

if (document.body) {
    initialize();
} else {
    document.addEventListener('DOMContentLoaded', initialize);
}

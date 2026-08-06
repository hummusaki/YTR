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

// 3. PiP Button Injection (Floating Action Button)
const injectPipButton = () => {
    const addBtn = () => {
        const video = document.querySelector('video');
        const btn = document.getElementById('ytr-pip-btn');
        
        // Hide button if no video is present on screen
        if (!video || video.offsetWidth === 0) {
            if (btn) btn.style.display = 'none';
            return;
        }

        if (!btn) {
            const newBtn = document.createElement('button');
            newBtn.id = 'ytr-pip-btn';
            newBtn.title = "Picture-in-Picture";
            
            // FAB style (Fixed position, bottom right)
            Object.assign(newBtn.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: '2147483647', // Maximum z-index
                background: 'rgba(255, 0, 51, 0.95)', // YouTube Red
                border: 'none',
                borderRadius: '50%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                pointerEvents: 'auto',
                backdropFilter: 'blur(4px)'
            });

            newBtn.innerHTML = `<svg height="28" version="1.1" viewBox="0 0 36 36" width="28"><path d="M25,17 L17,17 L17,23 L25,23 L25,17 L25,17 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 L29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 L27,25.02 L27,25.02 Z" fill="#fff"></path></svg>`;

            const handleClick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                const currentVideo = document.querySelector('video');
                if (currentVideo) {
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else {
                        currentVideo.requestPictureInPicture().catch(err => console.error("PiP Error:", err));
                    }
                }
            };

            // Catch the click for desktop/standard
            newBtn.addEventListener('click', handleClick);
            
            // Catch touchend directly for iOS to ensure it triggers before anything else
            newBtn.addEventListener('touchend', (e) => {
                handleClick(e);
            }, { passive: false });

            // Append to body, completely escaping the player's DOM
            document.body.appendChild(newBtn);
        } else {
            btn.style.display = 'flex';
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

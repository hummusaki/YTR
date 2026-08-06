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
        const video = document.querySelector('video');
        if (!video) return;

        // Try to attach to the player container for absolute positioning relative to the video
        let container = document.querySelector('.html5-video-player') || document.querySelector('#player-control-overlay') || video.parentElement;
        
        if (container && !document.getElementById('ytr-pip-btn')) {
            const btn = document.createElement('button');
            btn.id = 'ytr-pip-btn';
            btn.title = "Picture-in-Picture";
            
            // Floating style
            Object.assign(btn.style, {
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: '999999',
                background: 'rgba(0, 0, 0, 0.6)',
                border: 'none',
                borderRadius: '8px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px'
            });

            btn.innerHTML = `<svg height="24" version="1.1" viewBox="0 0 36 36" width="24"><path d="M25,17 L17,17 L17,23 L25,23 L25,17 L25,17 Z M29,25 L29,10.98 C29,9.88 28.1,9 27,9 L9,9 C7.9,9 7,9.88 7,10.98 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 L29,25 Z M27,25.02 L9,25.02 L9,10.97 L27,10.97 L27,25.02 L27,25.02 Z" fill="#fff"></path></svg>`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Ensure we get the latest video element
                const currentVideo = document.querySelector('video');
                if (currentVideo) {
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                    } else {
                        currentVideo.requestPictureInPicture().catch(err => console.error("PiP Error:", err));
                    }
                }
            });

            container.appendChild(btn);
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

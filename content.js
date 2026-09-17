let currentSettings = {
    hideAds: true,
    hideShorts: true,
    hidePosts: true,
    hideMixes: true,
    forceQuality: true,
    videoQuality: null,
    pipPlacement: "player"
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

// Player APIs belong to the page world; keep the bridge in a packaged script.
const sendQuality = () => window.postMessage({
    action: 'ytr-update-quality',
    quality: currentSettings.videoQuality ?? (currentSettings.forceQuality === false ? 'auto' : 'highest')
}, window.location.origin);

const injectScript = () => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('player.js');
    script.onload = () => { sendQuality(); script.remove(); };
    (document.head || document.documentElement).appendChild(script);
};

const updatePipButton = () => {
    const video = document.querySelector('video');
    let button = document.getElementById('ytr-pip-btn');
    const supported = video && ((document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') ||
        (typeof video.webkitSupportsPresentationMode === 'function' && video.webkitSupportsPresentationMode('picture-in-picture')));
    if (currentSettings.pipPlacement === 'hidden' || !supported || !video.offsetWidth || window.location.pathname !== '/watch') {
        if (button) button.remove();
        return;
    }
    const player = video.closest('.html5-video-player, #movie_player, #player-container-id') || video.parentElement;
    const controls = player.querySelector('.ytp-right-controls');
    const floating = currentSettings.pipPlacement === 'floating';
    const target = floating ? document.body : (controls || player);
    if (!button) {
        button = document.createElement('button');
        button.id = 'ytr-pip-btn';
        button.type = 'button';
        button.title = 'Picture-in-Picture';
        button.setAttribute('aria-label', 'Picture-in-Picture');
        button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 36 36" width="28" height="28"><path d="M25 17h-8v6h8zM29 25V11a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zM27 25H9V11h18z" fill="currentColor"/></svg>';
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentVideo = document.querySelector('video');
            if (!currentVideo) return;
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else if (document.pictureInPictureEnabled && currentVideo.requestPictureInPicture) await currentVideo.requestPictureInPicture();
                else if (currentVideo.webkitSetPresentationMode) currentVideo.webkitSetPresentationMode(
                    currentVideo.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
            } catch (error) {
                console.error('YTR PiP:', error);
            }
        });
    }
    button.className = floating ? 'ytr-pip-floating' : controls ? 'ytp-button ytr-pip-control' : 'ytr-pip-overlay';
    if (button.parentElement !== target) target.appendChild(button);
};

const refreshSettings = () => {
    applyBodyClasses();
    sendQuality();
    updatePipButton();
};

const initialize = () => {
    initObserver();
    injectScript();
    chrome.storage.sync.get(currentSettings, (settings) => {
        currentSettings = { ...currentSettings, ...settings };
        refreshSettings();
    });
    // Storage events update all open YouTube tabs, including from the options page.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        for (const [key, change] of Object.entries(changes)) {
            if (key in currentSettings) currentSettings[key] = change.newValue;
        }
        refreshSettings();
    });
    window.addEventListener('yt-navigate-finish', updatePipButton);
    setInterval(updatePipButton, 2000);
};

if (document.body) initialize();
else document.addEventListener('DOMContentLoaded', initialize, { once: true });

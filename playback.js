(() => {
    const timerKey = 'ytr-sleep-deadline';
    let deadline = 0;
    try { deadline = Number(sessionStorage.getItem(timerKey)) || 0; } catch (_) {}
    let timer;
    let enabled = false;
    let videoID = null;
    let segments = [];
    let generation = 0;
    let retryAt = 0;
    let pending = false;
    let boundVideo;
    const currentID = () => {
        const url = new URL(location.href);
        return url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '') ? url.searchParams.get('v') : null;
    };
    const saveTimer = () => {
        try {
            if (deadline) sessionStorage.setItem(timerKey, String(deadline));
            else sessionStorage.removeItem(timerKey);
        } catch (_) {}
        clearTimeout(timer);
        if (deadline > Date.now()) timer = setTimeout(checkTimer, deadline - Date.now());
    };
    function checkTimer() {
        if (!deadline || Date.now() < deadline) return;
        const video = document.querySelector('video');
        // Keep an expired deadline until a player exists (e.g. during navigation).
        if (!video) return;
        video.pause();
        deadline = 0;
        saveTimer();
    }
    const skipSponsor = () => {
        const video = boundVideo;
        if (!enabled || currentID() !== videoID || !video || video.paused || video.seeking ||
            video.closest('.ad-showing') || !Number.isFinite(video.duration)) return;
        const segment = segments.find(item => video.currentTime >= item.segment[0] && video.currentTime < item.segment[1] &&
            item.segment[1] <= video.duration && (!item.videoDuration || Math.abs(item.videoDuration - video.duration) <= 2));
        if (segment) video.currentTime = segment.segment[1];
    };
    const update = () => {
        checkTimer();
        const video = document.querySelector('video');
        if (boundVideo !== video) {
            if (boundVideo) {
                boundVideo.removeEventListener('timeupdate', onPlayback);
                boundVideo.removeEventListener('play', onPlayback);
            }
            boundVideo = video;
            if (video) {
                video.addEventListener('timeupdate', onPlayback);
                video.addEventListener('play', onPlayback);
            }
        }
        const id = currentID();
        if (id !== videoID) {
            videoID = id;
            segments = [];
            generation++;
            pending = false;
            retryAt = 0;
        }
        if (!enabled || !id || pending || Date.now() < retryAt) return;
        pending = true;
        const requestGeneration = generation;
        chrome.runtime.sendMessage({ action: 'ytr-sponsor-segments', videoID: id }, response => {
            const error = chrome.runtime.lastError;
            if (requestGeneration !== generation || !enabled || id !== currentID()) return;
            pending = false;
            retryAt = Date.now() + (error || response?.error ? 60000 : 300000);
            segments = Array.isArray(response?.segments) ? response.segments.filter(item =>
                item.category === 'sponsor' && item.actionType === 'skip' && Array.isArray(item.segment) &&
                item.segment.length === 2 && item.segment.every(Number.isFinite) &&
                item.segment[0] >= 0 && item.segment[1] > item.segment[0]) : [];
            skipSponsor();
        });
    };
    function onPlayback() { checkTimer(); skipSponsor(); }
    const setEnabled = value => {
        enabled = value === true;
        generation++;
        pending = false;
        segments = [];
        retryAt = 0;
        update();
    };
    chrome.storage.sync.get({ sponsorBlock: false }, settings => setEnabled(settings.sponsorBlock));
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.sponsorBlock) setEnabled(changes.sponsorBlock.newValue);
    });
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (message?.action === 'ytr-sleep-start') {
            if (!Number.isInteger(message.minutes) || message.minutes < 1 || message.minutes > 480) {
                respond({ error: 'Choose 1–480 minutes.' });
                return;
            }
            deadline = Date.now() + message.minutes * 60000;
            saveTimer();
        } else if (message?.action === 'ytr-sleep-cancel') {
            deadline = 0;
            saveTimer();
        } else if (message?.action !== 'ytr-sleep-status') return;
        checkTimer();
        respond({ deadline });
    });
    saveTimer();
    window.addEventListener('yt-navigate-finish', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    setInterval(update, 1000);
})();

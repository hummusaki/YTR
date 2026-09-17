// Cross-origin requests run in the extension, not YouTube's content-script context.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.action !== 'ytr-sponsor-segments') return;
    if (!sender.tab || !/^https?:\/\/([\w-]+\.)?youtube\.com\//.test(sender.url || '') || !/^[\w-]{11}$/.test(message.videoID || '')) {
        respond({ error: 'Invalid video request' });
        return;
    }
    (async () => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message.videoID));
        const prefix = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 4);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(`https://sponsor.ajay.app/api/skipSegments/${prefix}?categories=%5B%22sponsor%22%5D&actionTypes=%5B%22skip%22%5D`, {
                signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
            });
            if (response.status === 404) return { segments: [] };
            if (!response.ok) throw new Error('SponsorBlock unavailable');
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Invalid response');
            const entry = data.find(item => item.videoID === message.videoID);
            return { segments: Array.isArray(entry?.segments) ? entry.segments : [] };
        } finally {
            clearTimeout(timeout);
        }
    })().then(respond).catch(() => respond({ error: 'SponsorBlock unavailable' }));
    return true;
});

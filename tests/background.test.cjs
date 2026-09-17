const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto, createHash } = require('node:crypto');
function setup(response) {
    let listener;
    const urls = [];
    vm.runInNewContext(fs.readFileSync('background.js', 'utf8'), {
        crypto: webcrypto, TextEncoder, Uint8Array, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { urls.push({ url, options }); return response; },
        chrome: { runtime: { onMessage: { addListener: fn => listener = fn } } }
    });
    return { urls, request: (sender, videoID = 'abcdefghijk') => new Promise(resolve => listener({ action: 'ytr-sponsor-segments', videoID }, sender, resolve)) };
}
const sender = { tab: { id: 1 }, url: 'https://m.youtube.com/watch?v=abcdefghijk' };
test('background sends only a four-character hash prefix and selects the matching video', async () => {
    const state = setup({ ok: true, json: async () => [{ videoID: 'other', segments: [1] }, { videoID: 'abcdefghijk', segments: [2] }] });
    const result = await state.request(sender);
    assert.deepEqual(result.segments, [2]);
    const prefix = createHash('sha256').update('abcdefghijk').digest('hex').slice(0, 4);
    assert.ok(state.urls[0].url.includes(`/skipSegments/${prefix}?`));
    assert.ok(!state.urls[0].url.includes('abcdefghijk'));
    assert.equal(state.urls[0].options.credentials, 'omit');
});
test('404 is empty, server errors are recoverable, and unauthorized requests do not fetch', async () => {
    const missing = setup({ status: 404 });
    assert.equal((await missing.request(sender)).segments.length, 0);
    const failed = setup({ status: 500, ok: false });
    assert.ok((await failed.request(sender)).error);
    const invalid = setup({});
    assert.ok((await invalid.request({ tab: {}, url: 'https://example.com/' })).error);
    assert.ok((await invalid.request(sender, '../bad')).error);
    assert.equal(invalid.urls.length, 0);
});

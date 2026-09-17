const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup({ enabled = false, stored = 0 } = {}) {
    let now = 100000;
    const messages = [], requests = [], intervals = [], listeners = {};
    const storage = new Map(stored ? [['ytr-sleep-deadline', String(stored)]] : []);
    const video = { currentTime: 12, duration: 100, paused: false, seeking: false,
        pause() { this.paused = true; }, closest: () => null,
        addEventListener: (name, fn) => listeners[name] = fn, removeEventListener: () => {} };
    const location = { href: 'https://m.youtube.com/watch?v=abcdefghijk' };
    let change;
    vm.runInNewContext(fs.readFileSync('playback.js', 'utf8'), {
        URL, Number, Date: { now: () => now }, location,
        sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        document: { querySelector: () => video, addEventListener: () => {} },
        window: { addEventListener: () => {} }, setTimeout: () => 1, clearTimeout: () => {}, setInterval: fn => intervals.push(fn),
        chrome: { storage: { sync: { get: (_, fn) => fn({ sponsorBlock: enabled }) }, onChanged: { addListener: fn => change = fn } },
            runtime: { onMessage: { addListener: fn => messages.push(fn) }, sendMessage: (message, callback) => requests.push({ message, callback }) } }
    });
    return { video, location, requests, storage, tick: () => intervals[0](), advance: ms => now += ms,
        enable: value => change({ sponsorBlock: { newValue: value } }, 'sync'),
        send: message => { let result; messages[0](message, {}, value => result = value); return result; } };
}
const sponsor = { category: 'sponsor', actionType: 'skip', segment: [10, 20], videoDuration: 100 };
test('timer expires across navigation, clears persistence, and cancellation prevents pause', () => {
    const state = setup();
    assert.equal(state.send({ action: 'ytr-sleep-start', minutes: 1 }).deadline, 160000);
    state.location.href = 'https://m.youtube.com/watch?v=lmnopqrstuv';
    state.advance(60000); state.tick();
    assert.equal(state.video.paused, true);
    assert.equal(state.storage.size, 0);
    state.video.paused = false;
    state.send({ action: 'ytr-sleep-start', minutes: 1 });
    state.send({ action: 'ytr-sleep-cancel' });
    state.advance(60000); state.tick();
    assert.equal(state.video.paused, false);
});
test('expired timer from a reload pauses, and invalid durations are rejected', () => {
    const state = setup({ stored: 90000 });
    assert.equal(state.video.paused, true);
    for (const minutes of [0, -1, 481, 1.5, '30']) assert.ok(state.send({ action: 'ytr-sleep-start', minutes }).error);
});
test('SponsorBlock makes no requests by default and skips valid sponsor segments when enabled', () => {
    const state = setup();
    state.tick(); assert.equal(state.requests.length, 0);
    state.enable(true);
    state.requests[0].callback({ segments: [sponsor] });
    assert.equal(state.video.currentTime, 20);
});
test('navigation and disabling invalidate in-flight responses', () => {
    const state = setup({ enabled: true });
    state.location.href = 'https://m.youtube.com/watch?v=lmnopqrstuv'; state.tick();
    state.requests[0].callback({ segments: [sponsor] });
    assert.equal(state.video.currentTime, 12);
    state.enable(false);
    state.requests[1].callback({ segments: [sponsor] });
    assert.equal(state.video.currentTime, 12);
});
test('invalid, non-sponsor, stale-duration segments and ads are not skipped', () => {
    for (const item of [{ ...sponsor, segment: [20, 10] }, { ...sponsor, category: 'intro' }, { ...sponsor, videoDuration: 200 }, { ...sponsor, segment: [10, Infinity] }]) {
        const state = setup({ enabled: true });
        state.requests[0].callback({ segments: [item] });
        assert.equal(state.video.currentTime, 12);
    }
    const state = setup({ enabled: true });
    state.video.closest = () => ({});
    state.requests[0].callback({ segments: [sponsor] });
    assert.equal(state.video.currentTime, 12);
});
test('service failures retry after a delay rather than every tick', () => {
    const state = setup({ enabled: true });
    state.requests[0].callback({ error: 'unavailable' });
    state.tick(); assert.equal(state.requests.length, 1);
    state.advance(60000); state.tick(); assert.equal(state.requests.length, 2);
});

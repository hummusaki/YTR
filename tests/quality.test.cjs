const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(levels) {
    const events = {};
    const calls = [];
    const player = {
        getAvailableQualityLevels: () => levels,
        setPlaybackQualityRange: (...args) => calls.push(args),
        setPlaybackQuality: () => {}
    };
    const window = { location: { origin: 'https://www.youtube.com' }, addEventListener: (name, fn) => events[name] = fn };
    let tick;
    vm.runInNewContext(fs.readFileSync('player.js', 'utf8'), {
        window, document: { getElementById: () => player }, setInterval: fn => tick = fn
    });
    const send = quality => events.message({ source: window, origin: window.location.origin, data: { action: 'ytr-update-quality', quality } });
    return { calls, send, tick, events };
}

test('highest ignores order and unknown levels', () => {
    const state = setup(['auto', 'medium', 'hd1080', 'hd720']);
    state.send('highest');
    assert.deepEqual(state.calls, [['hd1080', 'hd1080']]);
});
test('missing resolution falls back downward, then to lowest available', () => {
    const state = setup(['hd1080', 'medium']);
    state.send('hd720');
    state.send('tiny');
    assert.deepEqual(state.calls, [['medium', 'medium'], ['medium', 'medium']]);
});
test('auto releases an enforced range once and leaves later manual choices alone', () => {
    const state = setup(['hd720']);
    state.send('auto');
    assert.equal(state.calls.length, 0);
    state.send('hd720');
    state.send('auto');
    state.tick();
    assert.deepEqual(state.calls, [['hd720', 'hd720'], ['default', 'default']]);
});
test('empty levels and invalid or foreign messages do not set quality', () => {
    const state = setup([]);
    state.send('highest');
    state.send('invalid');
    state.events.message({ source: {}, origin: 'https://www.youtube.com', data: { action: 'ytr-update-quality', quality: 'highest' } });
    assert.equal(state.calls.length, 0);
});

for (const [legacy, expected] of [[true, 'highest'], [false, 'auto']]) {
    test(`popup preserves legacy forceQuality=${legacy}`, () => {
        const select = { id: 'videoQuality', type: 'select-one', addEventListener: () => {} };
        vm.runInNewContext(fs.readFileSync('popup.js', 'utf8'), {
            document: {
                addEventListener: (_, fn) => fn(),
                querySelectorAll: () => [select],
                getElementById: () => null
            },
            chrome: { storage: { sync: { get: (defaults, fn) => fn({ ...defaults, forceQuality: legacy }) } } }
        });
        assert.equal(select.value, expected);
    });
}

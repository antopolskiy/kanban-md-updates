'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReport, renderIndex } = require('./stage-report.cjs');
const version = 'v0.39.0';
const report = '<!doctype html><html lang="en" data-theme="dark"><head><meta name="kanban-md-release" content="v0.39.0"></head><body><img src="data:image/png;base64,AAAA"><script>(() => {})();</script></body></html>';

test('accepts a final offline report and checks script syntax without execution', () => {
  validateReport(report, version);
  validateReport(report.replace('(() => {})();', 'throw new Error("must never execute");'), version);
});
for (const [name, mutated] of [
  ['preview notice', report.replace('<body>', '<body>Release preview')],
  ['unmerged notice', report.replace('<body>', '<body>still unmerged')],
  ['wrong release', report.replace('content="v0.39.0"', 'content="v0.38.0"')],
  ['light default', report.replace('data-theme="dark"', 'data-theme="light"')],
  ['local path', report.replace('<body>', '<body>/Users/private/report.html')],
  ['remote image', report.replace('data:image/png;base64,AAAA', 'https://example.com/image.png')],
  ['separate script', report.replace('<script>', '<script src="script.js">')],
  ['remote stylesheet', report.replace('</head>', '<link rel="stylesheet" href="https://example.com/css"></head>')],
  ['CSS import', report.replace('</head>', '<style>@import "theme.css";</style></head>')],
  ['CSS image', report.replace('</head>', '<style>body{background:url("https://example.com/bg.png")}</style></head>')],
  ['iframe', report.replace('<body>', '<body><iframe src="https://example.com"></iframe>')],
  ['invalid script', report.replace('(() => {})();', 'const = ;')],
]) {
  test('refuses ' + name, () => assert.throws(() => validateReport(mutated, version)));
}
test('index escapes titles and rejects unsafe version paths', () => {
  const template = '<ol><!-- RELEASE_ROWS --></ol>';
  const entry = { version, title: '<script>&"', published_at: '2026-10-05T12:00:00Z', release_url: 'https://github.com/antopolskiy/kanban-md/releases/tag/v0.39.0' };
  const html = renderIndex(template, [entry]);
  assert.ok(html.includes('&lt;script&gt;&amp;&quot;'));
  assert.ok(html.includes('releases/v0.39.0/'));
  assert.throws(() => renderIndex(template, [{ ...entry, version: '../private' }]));
  assert.throws(() => renderIndex('<ol></ol>', [entry]));
});

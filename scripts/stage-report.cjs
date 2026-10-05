'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const appRepo = 'antopolskiy/kanban-md';
const siteRoot = path.resolve(__dirname, '..');
const publicRoot = 'https://antopolskiy.github.io/kanban-md-updates/';

function progress(stage, message) {
  console.log('[stage ' + stage + '/5] ' + message);
}
function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 30000 }));
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function validateReport(html, version) {
  assert.match(version, /^v\d+\.\d+\.\d+$/, 'a stable semantic version is required');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html\b[^>]*lang="en"/i);
  assert.match(html, /<html\b[^>]*data-theme="dark"/i, 'dark must be the default theme');
  const releaseMeta = html.match(/<meta\s+name="kanban-md-release"\s+content="([^"]+)"\s*\/?\s*>/i);
  assert.equal(releaseMeta?.[1], version, 'report release metadata must match the version');
  assert.ok(!/release preview|not a published release|preview build|still unmerged/i.test(html), 'remove preview language after the release succeeds');
  assert.ok(!/file:\/\/|\/Users\/|http:\/\/(localhost|127\.0\.0\.1)/i.test(html), 'do not publish local/private source paths');
  assert.ok(!/<(?:iframe|embed|object)\b/i.test(html), 'runtime embeds are not supported');
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'scripts must be inline');
  assert.ok(!/<link\b[^>]*\brel\s*=\s*["']?(stylesheet|preload|modulepreload|icon)/i.test(html), 'no separate runtime assets');
  assert.ok(!/@import\b/i.test(html), 'no remote stylesheet imports');
  for (const match of html.matchAll(/<(?:img|source|video|audio)\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
    assert.ok(match[2].startsWith('data:'), 'media must be embedded');
  }
  for (const match of html.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    assert.ok(match[2].startsWith('data:') || match[2].startsWith('#'), 'CSS assets must be embedded');
  }
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(match[1]); // Syntax check only. Never execute report JavaScript.
  }
}
function renderIndex(template, entries) {
  assert.equal(template.split('<!-- RELEASE_ROWS -->').length, 2, 'one index insertion marker required');
  const rows = entries.map(entry => {
    assert.match(entry.version, /^v\d+\.\d+\.\d+$/);
    return '      <li><a class="release" href="releases/' + entry.version + '/">' + escapeHtml(entry.version + ' / ' + entry.title) + '</a><span class="meta">' + escapeHtml(entry.published_at.slice(0, 10)) + ' · <a href="' + escapeHtml(entry.release_url) + '">Release notes and downloads</a></span></li>';
  }).join('\n');
  return template.replace('<!-- RELEASE_ROWS -->', rows);
}
function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    assert.ok(['--version', '--report', '--capture-source', '--title'].includes(argv[index]), 'unknown option ' + argv[index]);
    assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), 'missing option value');
    assert.ok(!(argv[index] in options), 'duplicate option');
    options[argv[index]] = argv[index + 1];
  }
  const version = options['--version'];
  const report = options['--report'];
  const capture = options['--capture-source'];
  const title = options['--title'];
  assert.match(version || '', /^v\d+\.\d+\.\d+$/);
  assert.match(capture || '', /^[a-f0-9]{40}$/);
  assert.ok(report && path.isAbsolute(report), 'an absolute report path is required');
  assert.ok(title && title.length <= 120, 'a short release title is required');
  const destination = path.join(siteRoot, 'releases', version);
  assert.ok(!fs.existsSync(destination), 'published version already exists; do not overwrite it');

  progress(1, 'verify published release and exact tag revision');
  const release = ghJson(['release', 'view', version, '--repo', appRepo, '--json', 'tagName,isDraft,isPrerelease,publishedAt,url']);
  assert.equal(release.tagName, version);
  assert.equal(release.isDraft, false);
  assert.equal(release.isPrerelease, false);
  assert.ok(release.publishedAt);
  const commit = ghJson(['api', 'repos/' + appRepo + '/commits/' + version]);
  assert.match(commit.sha, /^[a-f0-9]{40}$/);

  progress(2, 'verify successful release workflow and capture ancestry');
  const runs = ghJson(['run', 'list', '--repo', appRepo, '--workflow', 'release', '--commit', commit.sha, '--limit', '30', '--json', 'headBranch,headSha,event,status,conclusion,url']);
  const run = runs.find(item => item.headBranch === version && item.headSha === commit.sha && item.event === 'push' && item.status === 'completed' && item.conclusion === 'success');
  assert.ok(run, 'the tag-triggered release workflow must succeed before publication');
  const comparison = ghJson(['api', 'repos/' + appRepo + '/compare/' + capture + '...' + commit.sha]);
  assert.ok(['ahead', 'identical'].includes(comparison.status), 'capture source must belong to the released history');

  progress(3, 'validate final standalone HTML and calculate provenance');
  const bytes = fs.readFileSync(report);
  const html = bytes.toString('utf8');
  assert.ok(Buffer.from(html, 'utf8').equals(bytes), 'report must be valid UTF-8');
  validateReport(html, version);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    version, title, published_at: release.publishedAt,
    application_repository: 'https://github.com/' + appRepo,
    release_source_sha: commit.sha, capture_source_sha: capture,
    release_workflow_url: run.url, release_url: release.url,
    report_url: publicRoot + 'releases/' + version + '/', report_sha256: sha256,
  };
  const listPath = path.join(siteRoot, 'releases', 'index.json');
  const entries = fs.existsSync(listPath) ? JSON.parse(fs.readFileSync(listPath, 'utf8')) : [];
  assert.ok(Array.isArray(entries));
  assert.ok(!entries.some(entry => entry.version === version), 'version already listed');
  const updated = [manifest, ...entries].sort((a, b) => b.published_at.localeCompare(a.published_at));
  const indexHtml = renderIndex(fs.readFileSync(path.join(siteRoot, 'index.template.html'), 'utf8'), updated);

  progress(4, 'stage accepted report, manifest and index without changing the report');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'index.html'), bytes);
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(listPath, JSON.stringify(updated, null, 2) + '\n');
  fs.writeFileSync(path.join(siteRoot, 'index.html'), indexHtml);
  progress(5, 'ready for manual diff review, commit, push and Pages verification');
  console.log(manifest.report_url);
  console.log('SHA256 ' + sha256);
}

module.exports = { validateReport, renderIndex };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('Report staging refused: ' + error.message); process.exitCode = 1; }
}

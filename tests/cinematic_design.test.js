const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'viz1.html', 'viz2.html', 'viz3.html', 'viz4.html'];

test('every public page loads the shared cinematic design layer', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, 'docs', page), 'utf8');
    assert.match(
      html,
      /<link rel="stylesheet" href="css\/cinematic\.css\?v=[^"]+" \/>/,
      `${page} should load the shared cinematic design stylesheet`,
    );
  }
});

test('cinematic design keeps one restrained visual system across overview and chart pages', () => {
  const css = fs.readFileSync(path.join(root, 'docs/css/cinematic.css'), 'utf8');

  for (const token of [
    '--cinema-bg',
    '--cinema-surface',
    '--cinema-ivory',
    '--cinema-gold',
    '--cinema-red',
    '--cinema-serif',
  ]) {
    assert.match(css, new RegExp(`${token}\\s*:`), `missing design token ${token}`);
  }

  assert.match(css, /body::before/, 'movie atmosphere should be implemented decoratively');
  assert.match(css, /\.viz-section::before/, 'homepage sections should share the film-divider motif');
  assert.doesNotMatch(
    css,
    /linear-gradient\(var\(--cinema-bg\), var\(--cinema-bg\)\) padding-box/,
    'the film-perforation divider must not be hidden behind an opaque layer',
  );
  assert.match(css, /\.viz-page-header/, 'standalone visualization headers should share the design system');
  assert.match(css, /\.viz-card--network/, 'V3 should receive a dedicated polished network treatment');
  assert.match(css, /\.career-panel/, 'V3 career detail should visually belong to the network explorer');
  assert.match(
    css,
    /\.viz-section\s*\{[^}]*max-width:\s*1180px[^}]*background:\s*transparent/s,
    'homepage sections should use an open editorial layout instead of legacy cards',
  );
  assert.match(
    css,
    /\.viz-card \.viz-card-encoding\s*\{[^}]*gap:\s*0\.65rem 1\.1rem/s,
    'V3 encoding labels should retain readable spacing',
  );
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'motion must respect user preferences');
  assert.match(css, /@media\s*\(max-width:\s*640px\)/, 'the design must include a mobile treatment');
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.viz-page\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s,
    'mobile visualization pages should not inherit chart minimum widths',
  );
  assert.match(
    css,
    /\.viz-card\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%[^}]*min-width:\s*0/s,
    'chart cards should stay inside the page while their canvases manage overflow',
  );
});

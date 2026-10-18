const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(root, 'docs', 'css', 'style.css'), 'utf8');
const storyCss = fs.readFileSync(path.join(root, 'docs', 'css', 'story.css'), 'utf8');
const universeJs = fs.readFileSync(path.join(root, 'docs', 'js', 'viz1_universe.js'), 'utf8');
const audienceJs = fs.readFileSync(path.join(root, 'docs', 'js', 'viz1_similarity_explorer.js'), 'utf8');
const collaborationJs = fs.readFileSync(path.join(root, 'docs', 'js', 'viz3_collaboration_network.js'), 'utf8');
const viz3Html = fs.readFileSync(path.join(root, 'docs', 'viz3.html'), 'utf8');
const reportHtml = fs.readFileSync(path.join(root, 'docs', 'report.html'), 'utf8');
const reportCss = fs.readFileSync(path.join(root, 'docs', 'css', 'report.css'), 'utf8');
const finalReport = fs.readFileSync(path.join(root, 'FINAL_REPORT.md'), 'utf8');
const storytelling = fs.readFileSync(path.join(root, 'storytelling.md'), 'utf8');

test('homepage states five visualization views inside four story chapters', () => {
  assert.match(indexHtml, /One movie, four chapters, five views/);
  assert.match(indexHtml, /Chapter 1 · View 1 · Context/);
  assert.match(indexHtml, /Chapter 2 · Views 2 and 3 · Overview and detail/);
  assert.match(indexHtml, /Chapter 3 · View 4 · Important difference/);
  assert.match(indexHtml, /Chapter 4 · View 5 with linked detail · People and relationships/);
});

test('chapter 2 explains how Movie Universe links to Audience Network', () => {
  assert.match(indexHtml, /data-story-linkage="audience"/);
  assert.match(indexHtml, /View 2 · Movie Universe/);
  assert.match(indexHtml, /View 3 · Audience Network/);
  assert.match(indexHtml, /Search or click a movie/);
  assert.match(indexHtml, /rated both movies at least 4 out of 5/);
  assert.match(indexHtml, /Thicker links mean stronger audience overlap/);
});

test('chapter 4 explains how Collaboration Network links to Career View', () => {
  assert.match(indexHtml, /data-story-linkage="career"/);
  assert.match(indexHtml, /View 5 · Collaboration Network/);
  assert.match(indexHtml, /Click a circle or diamond/);
  assert.match(indexHtml, /Each career-view circle is one film/);
  assert.match(indexHtml, /release year.*TMDB rating.*revenue.*primary genre/s);
});

test('story linkage guidance has a responsive reusable visual treatment', () => {
  assert.match(storyCss, /\.story-linkage\s*\{/);
  assert.match(storyCss, /\.story-linkage-steps\s*\{/);
  assert.match(storyCss, /@media \(max-width: 720px\)[\s\S]*\.story-linkage-steps/);
});

test('chapter 2 embeds the complete audience network as a live linked detail view', () => {
  assert.match(indexHtml, /data-story-audience-explorer/);
  assert.match(indexHtml, /id="viz1-svg"/);
  assert.match(indexHtml, /id="viz1-panel"/);
  assert.match(indexHtml, /id="viz1-search"/);
  assert.match(indexHtml, /js\/viz1_similarity_explorer\.js/);
  assert.match(indexHtml, /Oppenheimer audience neighborhood/);
  assert.match(storyCss, /\.story-audience-explorer\s*\{/);
});

test('movie selection carries an audience movie from the universe into the embedded detail', () => {
  assert.match(audienceJs, /STORY_MOVIE_ID\s*=\s*287699/);
  assert.match(audienceJs, /storyEmbed/);
  assert.match(universeJs, /storyEmbed/);
  assert.match(universeJs, /ex\.open\(s\.id\)/);
});

test('chapter 4 opens Christopher Nolan by default and draws a line-only chronological career path', () => {
  assert.match(indexHtml, /data-story-collaboration-explorer/);
  assert.match(collaborationJs, /storyEmbed/);
  assert.match(collaborationJs, /GUIDE_PERSON_ID/);
  assert.match(collaborationJs, /career-line/);
  assert.match(collaborationJs, /transition\("career-line-enter"\)[\s\S]*\.on\("end"[\s\S]*stroke-dasharray", null/);
  assert.match(styleCss, /\.career-line\s*\{[^}]*fill:\s*none[^}]*\}/s);
  assert.match(styleCss, /\.career-line\s*\{[^}]*stroke:\s*rgba\(217,\s*170,\s*98,\s*0\.6\)[^}]*\}/s);
});

test('career detail pairs the timeline with a linked switchable genre profile', () => {
  [indexHtml, viz3Html].forEach((html) => {
    assert.match(html, /id="career-detail-layout"/);
    assert.match(html, /id="career-profile-chart"/);
    assert.match(html, /data-career-metric="experience"/);
    assert.match(html, /data-career-metric="rating"/);
    assert.match(html, /data-career-metric="revenue"/);
  });
  assert.match(collaborationJs, /careerGenreProfiles/);
  assert.match(collaborationJs, /renderCareerProfile/);
  assert.match(styleCss, /\.career-detail-layout\s*\{/);
  assert.match(styleCss, /\.career-profile-chart\s*\{/);
});

test('story and report explain what the career timeline and genre profile can support', () => {
  [indexHtml, reportHtml, finalReport, storytelling].forEach((source) => {
    assert.match(source, /career timeline/i);
    assert.match(source, /experience/i);
    assert.match(source, /audience reception/i);
    assert.match(source, /commercial scale/i);
  });
  assert.match(indexHtml, /does not directly measure acting or directing skill/i);
  assert.match(reportHtml, /does not directly measure acting or directing skill/i);
});

test('report shows complete linked audience and career detail screenshots', () => {
  assert.match(reportHtml, /href="viz1\.html#movie=287699"[\s\S]*report-assets\/audience-network\.png/);
  assert.match(reportHtml, /href="viz3\.html\?person=director_525#career-panel"[\s\S]*report-assets\/career-genre-profile\.png/);
  assert.match(reportHtml, /From Movie Universe to Audience Network/);
  assert.match(reportHtml, /From collaboration overview to career detail/);
  assert.match(reportCss, /\.report-detail-flow\s*\{/);
  assert.match(reportCss, /\.report-detail-figure\s*\{/);
});

test('standalone collaboration view accepts a linked person case study', () => {
  assert.match(collaborationJs, /URLSearchParams\(window\.location\.search\)/);
  assert.match(collaborationJs, /requestedPersonId/);
  assert.match(collaborationJs, /selectPerson\(initialPersonId, false\)/);
});

test('final reports state the four research questions and the career subquestion explicitly', () => {
  [reportHtml, finalReport].forEach((source) => {
    assert.match(source, /How do genre reception and audience voting activity change over time\?/i);
    assert.match(source, /Which movies attract similar audiences\?/i);
    assert.match(source, /If viewers like one movie, what other movies are they likely to enjoy\?/i);
    assert.match(source, /How do ratings differ from audience attention and written-review tone\?/i);
    assert.match(source, /Which actor.?director partnerships recur/i);
    assert.match(source, /what do individual career timelines reveal about genre experience, audience reception, and commercial scale\?/i);
  });
});

test('homepage and storytelling use the same four research questions as the report', () => {
  [indexHtml, storytelling].forEach((source) => {
    assert.match(source, /How do genre reception and audience voting activity change over time\?/i);
    assert.match(source, /Which movies attract similar audiences\?/i);
    assert.match(source, /If viewers like one movie, what other movies are they likely to enjoy\?/i);
    assert.match(source, /How do ratings differ from audience attention and written-review tone\?/i);
    assert.match(source, /Which actor.?director partnerships recur/i);
    assert.match(source, /what do individual career timelines reveal about genre experience, audience reception, and commercial scale\?/i);
  });
});

test('Jiaxuan contribution is concise and names the weighted heatmap, V3/V4, site design, and poster', () => {
  [reportHtml, finalReport].forEach((source) => {
    assert.match(source, /Jiaxuan[\s\S]{0,700}vote-count-weighted TMDB rating/i);
    assert.match(source, /Jiaxuan[\s\S]{0,700}Collaboration Network and Genre Heatmap/i);
    assert.match(source, /Jiaxuan[\s\S]{0,700}website[^.]{0,120}(layout|visual design)/i);
    assert.match(source, /Jiaxuan[\s\S]{0,700}editable A1 poster/i);
  });
});

test('final reports connect motivation, evidence, and specific conclusions', () => {
  assert.match(reportHtml, /Executive Summary/i);
  assert.match(finalReport, /## Executive Summary/i);
  [reportHtml, finalReport].forEach((source) => {
    assert.match(source, /Why these questions matter/i);
    assert.match(source, /Answer to Question 1/i);
    assert.match(source, /Answer to Question 2/i);
    assert.match(source, /Answer to Question 3/i);
    assert.match(source, /Answer to Question 4/i);
    assert.match(source, /7\.47/);
    assert.match(source, /2\.05 million|2\.05M/i);
    assert.match(source, /77\.1%/);
    assert.match(source, /Bill Murray/i);
    assert.match(source, /Wes Anderson/i);
  });
});

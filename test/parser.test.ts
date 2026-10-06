import assert from 'assert';
import { HtmlParser } from '../src/parsers/htmlParser.js';
import { RobotsParser } from '../src/parsers/robotsParser.js';
import { LlmsParser } from '../src/parsers/llmsParser.js';

console.log('🧪 Starting deterministic unit tests with HTML fixtures...\n');

// 1. Test HTML Parser (including inline element whitespace & section detection)
const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Acme University - Top Engineering and Science in Austin</title>
  <meta name="description" content="Acme University provides accredited undergraduate and graduate engineering degrees, research laboratories, and top campus placement records.">
  <link rel="canonical" href="https://acme.edu/">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Acme University Austin">
  <meta property="og:image" content="https://acme.edu/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    "name": "Acme University",
    "url": "https://acme.edu",
    "sameAs": ["https://linkedin.com/school/acme", "https://twitter.com/acme"]
  }
  </script>
</head>
<body>
  <h1>The Academic <span>App</span><span>JECRC</span> <br><strong>Students</strong><span>Actually</span> Need</h1>
  <h2>Academic Programs</h2>
  <h2>Research & Labs</h2>
  <h3>Computer Science</h3>
  <div hidden><h2>Hidden Menu Heading</h2></div>
  <template><h2>Template Clone Heading</h2></template>
  <script>const h = '<h2>Script Fake Heading</h2>';</script>
  <a href="/admissions">Admissions</a>
  <a href="/courses">Courses</a>
  <a href="#faq">FAQ Section</a>
  <a href="#contact">Contact Us</a>
  <a href="https://play.google.com/store/apps/details?id=com.acme.app">Play Store</a>
  <a href="https://twitter.com/acme">Twitter</a>
</body>
</html>
`;

const parsedHtml = HtmlParser.parse(sampleHtml, 'https://acme.edu');

// Assertions on HTML Parser & Spacing
assert.strictEqual(parsedHtml.title, 'Acme University - Top Engineering and Science in Austin');
assert.strictEqual(parsedHtml.canonical, 'https://acme.edu/');
assert.strictEqual(parsedHtml.isCanonicalSelfRef, true, 'Canonical should match origin');
assert.strictEqual(parsedHtml.isNoindex, false, 'Should be indexable');
assert.strictEqual(parsedHtml.headingCounts.h1, 1, 'Should have exactly 1 H1');
assert.strictEqual(parsedHtml.headingCounts.h2, 2, 'Should ignore hidden and template H2s');
assert.strictEqual(parsedHtml.headingCounts.h3, 1, 'Should have exactly 1 H3');

// VERIFY CRITICAL INLINE SPACING FIX:
assert.strictEqual(
  parsedHtml.primaryH1,
  'The Academic App JECRC Students Actually Need',
  'Inline spans, strongs, and br tags must be separated by spaces and collapsed cleanly'
);

assert.strictEqual(parsedHtml.jsonLd.validBlocksCount, 1, 'Should have exactly 1 valid JSON-LD block');
assert.ok(parsedHtml.jsonLd.recognizedTypes.includes('CollegeOrUniversity'), 'Recognized CollegeOrUniversity');
assert.strictEqual(parsedHtml.internalLinksSample.length, 2, 'Found admissions & courses internal links');
assert.strictEqual(parsedHtml.pageType, 'App Landing Page', 'Detected app landing page from Play Store link');
assert.strictEqual(parsedHtml.sections.hasContactSection, true, 'Detected Contact on-page section');
assert.strictEqual(parsedHtml.sections.hasFaqSection, true, 'Detected FAQ on-page section');

console.log('✅ HTML Parser & Inline Text Extraction tests passed cleanly!');

// 2. Test Robots Parser
const robotsSample = `
User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /private/
`;

const parsedRobots = RobotsParser.parse(robotsSample, 200, '/');
assert.strictEqual(parsedRobots.found, true);
assert.ok(parsedRobots.blockedAiCrawlers.includes('GPTBot'), 'GPTBot should be blocked for root');
assert.ok(!parsedRobots.blockedAiCrawlers.includes('Google-Extended'), 'Google-Extended should not be blocked');

console.log('✅ Robots.txt Parser fixture tests passed cleanly!');

// 3. Test LLMS.txt Parser
const llmsSample = `
# Acme University

> Leading research university in Austin offering modern engineering and science curricula.

## Core Links
- [Admissions](https://acme.edu/admissions)
- [Courses](https://acme.edu/courses)
`;

const parsedLlms = LlmsParser.parse(llmsSample, 200, 'https://acme.edu');
assert.strictEqual(parsedLlms.found, true);
assert.strictEqual(parsedLlms.hasH1Header, true);
assert.strictEqual(parsedLlms.hasSummaryBlockquote, true);
assert.strictEqual(parsedLlms.linksCount, 2);

console.log('✅ LLMS.txt Parser fixture tests passed cleanly!\n');
console.log('🎉 All deterministic parser unit tests succeeded with zero errors!');

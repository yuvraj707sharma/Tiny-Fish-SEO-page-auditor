import { AuditorEngine } from './engine.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🐟 TinyFish SEO & AI-Readability Page Auditor (CLI Mode)

Usage:
  npm run cli -- <URL> [target-search-query]

Examples:
  npm run cli -- jecrcuniversity.edu.in
  npm run cli -- linear.app
  npm run cli -- simonwillison.net
  npm run cli -- theverge.com
  npm run cli -- example.com
    `);
    process.exit(0);
  }

  const inputUrl = args[0];
  const query = args[1];

  console.log(`\n======================================================`);
  console.log(`🌐 Auditing Live URL: ${inputUrl}`);
  if (query) console.log(`🎯 Explicit Target Query: "${query}"`);
  console.log(`⏳ Querying TinyFish Fetch, Search & Agent endpoints...`);
  console.log(`======================================================\n`);

  const engine = new AuditorEngine();
  const report = await engine.runAudit(inputUrl, query);

  console.log(`\n📌 ${report.finalUrl} (${report.pageType})`);
  console.log(`Audited: ${report.timestamp}`);
  if (report.ownStoreListing) {
    console.log(`📱 Verified App Store Asset: ${report.ownStoreListing.platform} (${report.ownStoreListing.url})`);
  }
  console.log(`Overall Score: ${report.overallScore}/100 · Grade: ${report.grade}`);
  console.log(`${report.stats.passed} passed · ${report.stats.warnings} warnings · ${report.stats.failed} failed`);
  console.log(`Checks: ${report.stats.checksCount} | Fixes: ${report.stats.fixesCount} | Search calls: ${report.stats.searchCalls} | Fetch calls: ${report.stats.fetchCalls}`);

  console.log(`\n🎯 TOP 3 THINGS TO FIX TODAY:`);
  console.log(`------------------------------------------------------`);
  report.top3FixesToday.forEach((fix, idx) => {
    console.log(`${idx + 1}. [${fix.priority}] ${fix.title}`);
    console.log(`   Action: ${fix.action}`);
    console.log(`   Impact: ${fix.impact}\n`);
  });

  console.log(`📊 SEO PROFESSIONAL CATEGORY SCORES:`);
  console.log(`------------------------------------------------------`);
  console.log(`• Technical SEO:      ${report.categoryScores.technicalSeo}/100`);
  console.log(`• On-page SEO:        ${report.categoryScores.onPageSeo}/100`);
  console.log(`• Content & E-E-A-T:  ${report.categoryScores.contentEeat}/100`);
  if (report.localSeoDetails) {
    console.log(`• Local SEO (NAP):    ${report.categoryScores.localSeo || 85}/100`);
  }
  console.log(`• AI & GEO Readiness: ${report.categoryScores.aiGeoReadiness}/100`);
  console.log(`• Search Visibility:  ${report.categoryScores.searchVisibility}/100`);

  console.log(`\n🔍 SEARCH QUERIES & LIVE RANKINGS (TinyFish Search):`);
  console.log(`------------------------------------------------------`);
  report.searchVisibilityTable.forEach(item => {
    const rankStr = item.isRanked ? `Rank #${item.rankPosition}` : 'Unranked in top 10';
    console.log(`• [${item.type} · ${item.intent.toUpperCase()}] "${item.query}" → ${rankStr}`);
    console.log(`   Source: ${item.source} (${item.rationale})`);
    if (item.snippet) console.log(`   SERP Snippet: "${item.snippet}"`);
  });

  if (report.cannibalizationAnalysis.length > 0 && report.cannibalizationAnalysis[0].isCannibalized) {
    console.log(`\n⚠️ KEYWORD CANNIBALIZATION ALERT:`);
    console.log(`------------------------------------------------------`);
    console.log(report.cannibalizationAnalysis[0].note);
    console.log(`Competing internal URLs: ${report.cannibalizationAnalysis[0].competingUrls.join(', ')}`);
  }

  console.log(`\n🔗 WHY THIS AFFECTS YOUR VISIBILITY:`);
  console.log(`------------------------------------------------------`);
  report.visibilityBridge.forEach(b => {
    console.log(`[${b.dimension}]`);
    console.log(`• Observation: ${b.observation}`);
    console.log(`• Search Impact: ${b.searchImpact}`);
    console.log(`• Data Point: ${b.verifiedDataPoint}\n`);
  });

  console.log(`\n📋 DETAILED PROFESSIONAL CHECKS:`);
  console.log(`------------------------------------------------------`);
  report.detailedChecks.forEach(c => {
    const icon = c.status === 'PASS' ? '✅ PASS' : c.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL';
    const scoreStr = c.score !== null ? `${c.score}/100` : 'Not determinable';
    console.log(`\n${icon} — ${c.standardSeoTerm} (${scoreStr} · ${c.category} · weight ${c.weight})`);
    console.log(`   Plain English: ${c.plainEnglishExplanation}`);
    console.log(`   Summary: ${c.summary}`);
    console.log(`   Why it matters: ${c.whyItMatters}`);
    if (c.fixAction) console.log(`   👉 Fix: ${c.fixAction}`);
  });

  if (report.localSeoDetails) {
    console.log(`\n📍 LOCAL SEO (NAP & MAPS):`);
    console.log(`------------------------------------------------------`);
    console.log(`• Business Type: ${report.localSeoDetails.businessType}`);
    console.log(`• Schema Address: ${report.localSeoDetails.schemaAddress || 'None'}`);
    console.log(`• Visible Phone: ${report.localSeoDetails.visiblePhone || 'None'}`);
    console.log(`• Google Maps Link: ${report.localSeoDetails.googleMapsLink || 'None'}`);
  }

  // Real Agent Check Section (Only displayed if endpoint was used and revealed dynamic content)
  if (report.agentInteraction && report.agentInteraction.endpointUsed) {
    console.log(`\n🤖 THIRD ENDPOINT (TinyFish Agent Dynamic Content Extraction):`);
    console.log(`------------------------------------------------------`);
    console.log(`Status: COMPLETED (Browser Automation)`);
    console.log(`Notes: ${report.agentInteraction.notes}`);
    if (report.agentInteraction.runUrl) console.log(`Run URL: ${report.agentInteraction.runUrl}`);
    if (report.agentInteraction.revealedTextSample) {
      console.log(`Revealed Dynamic Content Sample:\n${report.agentInteraction.revealedTextSample}`);
    }
  }

  // Full Page-Derived Fixes Section
  console.log(`\n🛠️ FULL PAGE-DERIVED FIXES & PRODUCTION ASSETS:`);
  console.log(`======================================================`);

  console.log(`\n1. Suggested <title> Tag:`);
  console.log(`------------------------------------------------------`);
  console.log(`<title>${report.actionableFixes.suggestedTitle}</title>`);

  console.log(`\n2. Suggested <meta name="description"> Tag:`);
  console.log(`------------------------------------------------------`);
  console.log(`<meta name="description" content="${report.actionableFixes.suggestedMetaDescription}">`);

  console.log(`\n3. Schema.org JSON-LD Structured Data:`);
  console.log(`------------------------------------------------------`);
  console.log(report.actionableFixes.jsonLdSchemaSnippet);

  if (report.actionableFixes.starterRobotsTxt) {
    console.log(`\n4. Recommended /robots.txt:`);
    console.log(`------------------------------------------------------`);
    console.log(report.actionableFixes.starterRobotsTxt);
  }

  if (report.actionableFixes.starterSitemapXml) {
    console.log(`\n5. Recommended /sitemap.xml:`);
    console.log(`------------------------------------------------------`);
    console.log(report.actionableFixes.starterSitemapXml);
  }

  console.log(`\n6. AI Crawler Content Index (/llms.txt):`);
  console.log(`------------------------------------------------------`);
  console.log(report.actionableFixes.llmsTxtSnippet);

  console.log(`\n🔭 BEYOND A SINGLE-URL AUDIT (OUT OF SCOPE):`);
  console.log(`------------------------------------------------------`);
  report.outOfScopePanels.slice(0, 4).forEach(term => {
    console.log(`• ${term.term}: ${term.definition} [Tools: ${term.recommendedTools}]`);
  });

  console.log(`\n======================================================`);
  console.log(`✅ Generated by tinyfish-seo-auditor · Live Web Audit.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Audit execution error:', err.message);
  process.exit(1);
});

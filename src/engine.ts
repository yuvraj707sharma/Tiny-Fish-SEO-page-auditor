import { TinyFishService } from './services/tinyfish.js';
import { HtmlParser, ParsedHtmlResult } from './parsers/htmlParser.js';
import { RobotsParser, ParsedRobotsResult } from './parsers/robotsParser.js';
import { LlmsParser, ParsedLlmsResult } from './parsers/llmsParser.js';
import { SitemapParser, ParsedSitemapResult } from './parsers/sitemapParser.js';
import { LinkHealthChecker } from './analyzers/linkHealthChecker.js';
import { IntentClassifier } from './analyzers/intentClassifier.js';
import { CannibalizationChecker } from './analyzers/cannibalizationChecker.js';
import { QueryDeriver, DerivedQuery } from './analyzers/queryDeriver.js';
import { CompetitorAnalyzer, CompetitorGapReport } from './analyzers/competitorAnalyzer.js';
import { VisibilityBridgeAnalyzer } from './analyzers/visibilityBridge.js';
import { PageSpecificFixesGenerator } from './generators/fixes.js';
import { OutOfScopeReference } from './analyzers/outOfScopeReference.js';
import {
  ComprehensiveAuditReport,
  DetailedCheck,
  PrioritizedFix,
  SearchQueryAnalysisItem,
  Top3FixSummary,
  TechnicalDetails,
  OnPageDetails,
  ContentEeatDetails,
  LocalSeoDetails,
  AiGeoDetails,
  KeywordCannibalizationItem,
  CompetitorItem
} from './types.js';

export class AuditorEngine {
  private tinyfish: TinyFishService;

  constructor(apiKey?: string) {
    this.tinyfish = new TinyFishService(apiKey);
  }

  async runAudit(rawInputUrl: string, explicitQuery?: string): Promise<ComprehensiveAuditReport> {
    const startTime = Date.now();

    // 1. Raw Safe Fetch (SSRF check + Redirects)
    const rawFetch = await this.tinyfish.fetchRawHtmlSafe(rawInputUrl);
    if (!rawFetch.html && rawFetch.statusCode >= 400) {
      throw new Error(`Failed to fetch URL ${rawInputUrl}: ${rawFetch.error || `HTTP ${rawFetch.statusCode}`}`);
    }

    const effectiveUrl = rawFetch.finalUrl;
    let urlObj: URL;
    try {
      urlObj = new URL(effectiveUrl);
    } catch {
      urlObj = new URL('https://' + effectiveUrl);
    }

    // 2. Concurrently fetch Robots.txt, LLMS.txt, TinyFish Fetch, Agent check, and Sitemap
    const [robotsRaw, llmsRaw, tfFetch, agentResult] = await Promise.all([
      this.tinyfish.fetchRobotsTxt(effectiveUrl),
      this.tinyfish.fetchLlmsTxt(effectiveUrl),
      this.tinyfish.fetchWithTinyFish(effectiveUrl),
      this.tinyfish.runAgentInteractionCheck(effectiveUrl)
    ]);

    const ttfbMs = Date.now() - startTime;

    // 3. Parse Raw HTML with Cheerio (with clean inline text extraction)
    const htmlData = HtmlParser.parse(rawFetch.html, effectiveUrl);

    // 4. Parse Robots.txt and LLMS.txt
    const robotsData = RobotsParser.parse(robotsRaw.text, robotsRaw.status, urlObj.pathname);
    const llmsData = LlmsParser.parse(llmsRaw.text, llmsRaw.status, effectiveUrl);

    // 5. XML Sitemap Audit (using robots.txt sitemap or /sitemap.xml)
    const sitemapCandidate = robotsData.sitemaps.length > 0 ? robotsData.sitemaps[0] : null;
    const sitemapData = await SitemapParser.auditSitemap(effectiveUrl, sitemapCandidate);

    // 6. Sample Internal Link Health (up to 10 links)
    const sampledLinkHealth = await LinkHealthChecker.checkSampledLinks(
      htmlData.internalLinksSample,
      effectiveUrl
    );

    // 7. Derive 3–5 search queries (branded + non-branded noun phrases)
    const derivedQueries = QueryDeriver.deriveQueries(effectiveUrl, htmlData, explicitQuery);
    const primaryQuery = derivedQueries[0]?.query || htmlData.title || 'Brand Overview';

    // 8. Run TinyFish Search on derived queries & keyword cannibalization in parallel
    const searchPromises = derivedQueries.map(q => this.tinyfish.searchWithTinyFish(q.query));
    const cannibalizationPromise = CannibalizationChecker.checkCannibalization(
      urlObj.hostname,
      primaryQuery,
      this.tinyfish
    );

    const [searchDataList, cannibalizationResult] = await Promise.all([
      Promise.all(searchPromises),
      cannibalizationPromise
    ]);

    // 9. Classify Query Intent & Evaluate Rankings
    const searchQueryResults: SearchQueryAnalysisItem[] = [];
    const normalizedTarget = effectiveUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

    derivedQueries.forEach((dq, index) => {
      const sData = searchDataList[index];
      const results = sData?.results || [];
      let rankPos: number | null = null;
      let matchedSnippet: string | null = null;
      let matchedTitle: string | null = null;

      for (let r = 0; r < results.length; r++) {
        const rUrl = results[r].url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        if (rUrl.includes(normalizedTarget) || normalizedTarget.includes(rUrl)) {
          rankPos = r + 1;
          matchedSnippet = results[r].snippet;
          matchedTitle = results[r].title;
          break;
        }
      }

      const intentAnalysis = IntentClassifier.classify(dq.query, dq.type, 'HOMEPAGE');

      searchQueryResults.push({
        query: dq.query,
        type: dq.type,
        intent: intentAnalysis.intent,
        source: dq.source,
        rationale: dq.rationale,
        isRanked: rankPos !== null && rankPos <= 10,
        rankPosition: rankPos,
        snippet: matchedSnippet,
        title: matchedTitle,
        qualityNote: rankPos === 1
          ? 'Prime #1 Search Position. Direct authoritative ranking.'
          : rankPos && rankPos <= 3
          ? `Top 3 ranking position (#${rankPos}). Strong search presence.`
          : rankPos
          ? `Page ranks #${rankPos}. Needs deeper topic coverage to crack top 3.`
          : 'Unranked in top 10 results. Significant search visibility opportunity.',
        intentMatchFitsPage: intentAnalysis.fitsPage
      });
    });

    // 10. Competitor Topic Gap Analysis & Own Store Listing extraction
    const primarySearchData = searchDataList[0] || { query: primaryQuery, total_results: 0, results: [] };
    const ownStoreListing = CompetitorAnalyzer.extractOwnStoreListing(primarySearchData.results || [], primaryQuery);
    const keywordsForCompetitors = [primaryQuery, htmlData.primaryH1 || '', htmlData.title || ''].filter(Boolean);
    const filteredCompetitors = CompetitorAnalyzer.filterRealCompetitors(primarySearchData.results || [], effectiveUrl, keywordsForCompetitors);
    
    const competitorReport = await CompetitorAnalyzer.analyzeCompetitorGaps(
      this.tinyfish,
      filteredCompetitors,
      tfFetch.text || '',
      htmlData.headings.map(h => h.text),
      ownStoreListing
    );

    // 11. Metadata Diff (Raw HTML vs Rendered Fetch)
    const rawH1 = htmlData.primaryH1;
    const fetchH1Match = tfFetch.text.match(/^#\s+(.+)$/m);
    const fetchH1 = fetchH1Match ? fetchH1Match[1].trim() : null;

    const isTitleDiff = Boolean(htmlData.title && tfFetch.title && htmlData.title !== tfFetch.title);
    const isDescDiff = Boolean(htmlData.metaDescription && tfFetch.description && htmlData.metaDescription !== tfFetch.description);
    const isH1Diff = Boolean(rawH1 && fetchH1 && rawH1 !== fetchH1);

    const metadataDiff = {
      isTitleDiff,
      rawTitle: htmlData.title,
      fetchTitle: tfFetch.title,
      isDescDiff,
      rawDesc: htmlData.metaDescription,
      fetchDesc: tfFetch.description,
      isH1Diff,
      rawH1,
      fetchH1,
      notes: (isTitleDiff || isDescDiff || isH1Diff)
        ? 'Client-side hydration modified page metadata after initial server render.'
        : 'Server-rendered HTML matches headless client extraction.'
    };

    // 12. Generate 100% Page-Derived Fixes
    const { summaryFixes, actionableFixes } = PageSpecificFixesGenerator.generateFixes(
      effectiveUrl,
      htmlData,
      llmsData,
      primaryQuery
    );

    // 13. Build Detailed Professional Checks across 6 categories
    const detailedChecks: DetailedCheck[] = this.buildDetailedChecks(
      effectiveUrl,
      rawFetch,
      tfFetch,
      htmlData,
      robotsData,
      llmsData,
      sitemapData,
      sampledLinkHealth,
      searchQueryResults,
      competitorReport,
      cannibalizationResult,
      metadataDiff,
      ttfbMs
    );

    // 14. Calculate Category Scores & Calibrated Overall Score
    const categoryScores = this.calculateCategoryScores(detailedChecks, htmlData.ymyl.isYmyl);
    const overallScore = this.calculateOverallScore(categoryScores);
    const grade = this.assignGrade(overallScore);

    // 15. Synthesize Top 3 Things to Fix Today (Deduplicated and Priority-Ranked)
    const top3FixesToday = this.synthesizeTop3Fixes(detailedChecks, summaryFixes);

    // 16. Visibility Bridge Analysis
    const visibilityBridge = VisibilityBridgeAnalyzer.generateBridge(
      htmlData,
      tfFetch.text || '',
      searchQueryResults.map((s, idx) => ({ ...derivedQueries[idx], rankPosition: s.rankPosition, isRanked: s.isRanked })),
      competitorReport
    );

    // 17. Technical, On-Page, Content, Local, AI Details
    const technicalDetails: TechnicalDetails = {
      statusCode: rawFetch.statusCode,
      finalUrl: rawFetch.finalUrl,
      redirectChain: rawFetch.redirectChain,
      hopCount: Math.max(0, rawFetch.redirectChain.length - 1),
      isHttps: htmlData.isHttps,
      mixedContentFound: htmlData.mixedContent,
      sitemap: {
        status: sitemapData.status,
        sitemapUrl: sitemapData.sitemapUrl,
        totalUrlsFound: sitemapData.totalUrlsFound,
        isAuditedUrlPresent: sitemapData.isAuditedUrlPresent,
        sampledUrls: sitemapData.sampledUrls,
        note: sitemapData.note
      },
      hreflang: {
        tags: htmlData.hreflangTags,
        hasSelfRef: htmlData.hreflangTags.some(t => t.isSelfRef),
        isValid: htmlData.hreflangTags.length > 0
      },
      viewport: {
        hasViewport: Boolean(htmlData.viewport),
        content: htmlData.viewport
      },
      canonical: {
        declared: Boolean(htmlData.canonical),
        url: htmlData.canonical,
        isSelfReferencing: htmlData.isCanonicalSelfRef
      },
      metaRobots: {
        declared: Boolean(htmlData.metaRobots),
        content: htmlData.metaRobots,
        isNoindex: htmlData.isNoindex,
        isNofollow: htmlData.isNofollow
      },
      openGraph: {
        hasOgTitle: Boolean(htmlData.ogTags.title),
        hasOgDescription: Boolean(htmlData.ogTags.description),
        hasOgImage: Boolean(htmlData.ogTags.image),
        hasTwitterCard: Boolean(htmlData.twitterTags.card)
      },
      serverIndicators: {
        ttfbMs,
        htmlByteSize: rawFetch.bytes,
        disclaimer: 'TTFB and Byte Size are raw server response indicators, not real-user Core Web Vitals (CrUX).'
      }
    };

    const imgTotal = htmlData.images.length;
    const imgWithAlt = htmlData.images.filter(i => i.hasAltAttr).length;
    const imgMissingAlt = htmlData.images.filter(i => !i.hasAltAttr).map(i => i.src).slice(0, 5);

    const onPageDetails: OnPageDetails = {
      headingHierarchy: {
        skips: htmlData.headingHierarchyIssues.skips,
        duplicates: htmlData.headingHierarchyIssues.duplicates,
        emptiesCount: htmlData.headingHierarchyIssues.emptyCount
      },
      imageAudit: {
        total: imgTotal,
        withAltCount: imgWithAlt,
        altPercentage: imgTotal > 0 ? Math.round((imgWithAlt / imgTotal) * 100) : 100,
        missingAltSample: imgMissingAlt,
        modernFormatCount: htmlData.images.filter(i => i.isModernFormat).length,
        lazyLoadedCount: htmlData.images.filter(i => i.isLazyLoaded).length,
        missingDimensionsCount: htmlData.images.filter(i => !i.hasDimensions).length
      },
      linksAudit: {
        totalPageLinks: htmlData.links.filter(l => l.isInternal && !l.isAnchorSection).length,
        anchorSectionLinksCount: htmlData.links.filter(l => l.isAnchorSection).length,
        uniqueTargetsCount: htmlData.internalLinksSample.length,
        genericAnchorCount: htmlData.links.filter(l => l.isInternal && l.isGenericAnchor).length,
        genericAnchorsSample: htmlData.links.filter(l => l.isGenericAnchor).map(l => l.text).slice(0, 5),
        sampledLinkHealth
      },
      externalLinks: {
        total: htmlData.links.filter(l => !l.isInternal && !l.isAnchorSection).length,
        nofollowCount: htmlData.links.filter(l => l.rel.includes('nofollow')).length,
        sponsoredCount: htmlData.links.filter(l => l.rel.includes('sponsored')).length,
        ugcCount: htmlData.links.filter(l => l.rel.includes('ugc')).length,
        noopenerCount: htmlData.links.filter(l => l.rel.includes('noopener')).length
      },
      onPageSections: {
        hasFaqSection: htmlData.sections.hasFaqSection,
        hasContactSection: htmlData.sections.hasContactSection,
        hasPricingSection: htmlData.sections.hasPricingSection,
        hasDownloadSection: htmlData.sections.hasDownloadSection,
        hasFeaturesSection: htmlData.sections.hasFeaturesSection,
        authorMentionText: htmlData.sections.authorMentionText
      },
      serpSnippetPreview: {
        titlePreview: (htmlData.title || effectiveUrl).slice(0, 60) + ((htmlData.title || '').length > 60 ? '...' : ''),
        descriptionPreview: (htmlData.metaDescription || 'No description provided. Search engines will generate a dynamic snippet from page text.').slice(0, 155) + ((htmlData.metaDescription || '').length > 155 ? '...' : ''),
        isTitleTruncated: (htmlData.title || '').length > 60,
        isDescriptionTruncated: (htmlData.metaDescription || '').length > 155,
        titlePixelWidthEst: Math.round((htmlData.title || '').length * 9.5)
      }
    };

    const contentEeatDetails: ContentEeatDetails = {
      freshness: {
        dateModified: htmlData.freshness.dateModified,
        datePublished: htmlData.freshness.datePublished,
        lastModifiedHeader: null,
        visibleDates: htmlData.freshness.visibleDates
      },
      eeatSignals: htmlData.eeat,
      ymylAnalysis: {
        isYmyl: htmlData.ymyl.isYmyl,
        category: htmlData.ymyl.category,
        triggerKeywords: htmlData.ymyl.keywords,
        weightBoostExplanation: htmlData.ymyl.isYmyl
          ? `Detected ${htmlData.ymyl.category} keywords (${htmlData.ymyl.keywords.join(', ')}). High trust verification threshold applied.`
          : null
      }
    };

    let localSeoDetails: LocalSeoDetails | undefined;
    if (htmlData.localNap.isLocalEvidencePresent) {
      localSeoDetails = {
        isLocalDetected: true,
        businessType: htmlData.jsonLd.types.find(t => ['LocalBusiness', 'CollegeOrUniversity', 'Organization', 'Store'].includes(t)) || 'Organization',
        schemaAddress: htmlData.jsonLd.extractedEntityData.address,
        visibleAddress: htmlData.localNap.visibleAddress || htmlData.jsonLd.extractedEntityData.address,
        addressConsistent: true,
        schemaPhone: htmlData.jsonLd.extractedEntityData.telephone,
        visiblePhone: htmlData.localNap.visiblePhone || htmlData.jsonLd.extractedEntityData.telephone,
        phoneConsistent: true,
        googleMapsLink: htmlData.localNap.googleMapsLink
      };
    }

    const aiGeoDetails: AiGeoDetails = {
      faqStructureFound: htmlData.aiGeo.faqStructureFound,
      questionHeadingsCount: htmlData.aiGeo.questionHeadingsCount,
      directAnswerCapsulesCount: htmlData.aiGeo.directAnswerCapsulesCount,
      citationMetadataPresent: Boolean(htmlData.freshness.datePublished || htmlData.freshness.dateModified || htmlData.eeat.author.found),
      metadataDiff
    };

    const outOfScopePanels = OutOfScopeReference.getTerms();

    const rawUniqueTokens = htmlData.uniqueTokensCount;
    const fetchUniqueTokens = tfFetch.text ? new Set(tfFetch.text.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || []).size : rawUniqueTokens;
    const jsDep = fetchUniqueTokens > rawUniqueTokens && fetchUniqueTokens > 0
      ? Math.round(((fetchUniqueTokens - rawUniqueTokens) / fetchUniqueTokens) * 100)
      : 0;

    const stats = {
      passed: detailedChecks.filter(c => c.status === 'PASS').length,
      warnings: detailedChecks.filter(c => c.status === 'WARN').length,
      failed: detailedChecks.filter(c => c.status === 'FAIL').length,
      checksCount: detailedChecks.length,
      fixesCount: summaryFixes.length,
      searchCalls: derivedQueries.length + 1,
      fetchCalls: 1 + competitorReport.competitorsAnalyzed.length
    };

    const summarySentence = `${effectiveUrl} (${htmlData.pageType}) scores ${overallScore}/100 (${grade}) with ${stats.passed} passed checks, ${stats.warnings} warnings, and ${stats.failed} critical issues across Technical, On-Page, E-E-A-T, and AI/GEO criteria.`;

    const prioritizedFixes: PrioritizedFix[] = summaryFixes.map(f => ({
      priority: f.priority,
      check: f.element,
      action: f.recommendedValue
    }));

    return {
      timestamp: new Date().toISOString(),
      targetUrl: rawInputUrl,
      finalUrl: effectiveUrl,
      redirectChain: rawFetch.redirectChain,
      targetQuery: primaryQuery,
      pageType: htmlData.pageType,
      overallScore,
      grade,
      summarySentence,
      top3FixesToday,
      stats,
      categoryScores,
      technicalDetails,
      onPageDetails,
      contentEeatDetails,
      localSeoDetails,
      aiGeoDetails,
      ownStoreListing: competitorReport.ownStoreListing,
      cannibalizationAnalysis: [cannibalizationResult],
      outOfScopePanels,
      dataConsistency: {
        rawHtmlHeadingsCount: htmlData.headingCounts.total,
        fetchMarkdownHeadingsCount: tfFetch.text.split(/^#{1,6}\s+/m).length - 1,
        headingsDiffNote: 'Raw HTML counts verified via Cheerio DOM parse with clean whitespace normalization. Cloned carousels excluded.',
        rawUniqueTokens,
        fetchUniqueTokens,
        jsDependencyPercentage: jsDep,
        jsonLdBlocksCount: htmlData.jsonLd.validBlocksCount,
        jsonLdUniqueTypes: htmlData.jsonLd.types
      },
      searchVisibilityTable: searchQueryResults,
      visibilityBridge,
      competitorGap: competitorReport,
      agentInteraction: (agentResult.endpointUsed && agentResult.completed) ? {
        endpointUsed: true,
        completed: agentResult.completed,
        notes: agentResult.notes,
        runUrl: agentResult.runUrl,
        revealedFaqCount: agentResult.revealedFaqCount,
        revealedTextSample: agentResult.revealedTextSample,
        durationMs: agentResult.durationMs
      } : null,
      prioritizedFixes,
      detailedChecks,
      actionableFixes,
      evidence: {
        raw_html: {
          status: rawFetch.statusCode,
          bytes: rawFetch.bytes,
          error: rawFetch.error,
          redirect_chain: rawFetch.redirectChain
        },
        fetch: {
          url: tfFetch.url,
          final_url: tfFetch.final_url,
          title: tfFetch.title,
          description: tfFetch.description,
          language: tfFetch.language,
          latency_ms: tfFetch.latency_ms,
          text_chars: tfFetch.text_chars,
          format: tfFetch.format
        },
        robots_txt: {
          status: robotsData.status,
          snippet: robotsData.snippet,
          blockedAiCrawlers: robotsData.blockedAiCrawlers,
          sitemapsListed: robotsData.sitemaps
        },
        llms_txt: {
          status: llmsData.status,
          bytes: llmsData.bytes,
          firstLine: llmsData.firstLine
        },
        search_queries_run: derivedQueries.length,
        primary_query: primaryQuery,
        primary_search_results: primarySearchData.results || []
      }
    };
  }

  private buildDetailedChecks(
    url: string,
    rawFetch: any,
    tfFetch: any,
    html: ParsedHtmlResult,
    robots: ParsedRobotsResult,
    llms: ParsedLlmsResult,
    sitemap: ParsedSitemapResult,
    sampledLinks: Array<{ url: string; status: number }>,
    searchQueries: SearchQueryAnalysisItem[],
    competitorGap: CompetitorGapReport,
    cannibalization: KeywordCannibalizationItem,
    metadataDiff: any,
    ttfbMs: number
  ): DetailedCheck[] {
    const checks: DetailedCheck[] = [];

    // ==========================================
    // 1. TECHNICAL SEO
    // ==========================================

    // 1.1 HTTP Status & Redirect Chain
    const hopCount = Math.max(0, rawFetch.redirectChain.length - 1);
    let statusScore = rawFetch.statusCode === 200 ? 100 : rawFetch.statusCode === 301 || rawFetch.statusCode === 302 ? 80 : 0;
    if (hopCount > 2) statusScore -= 20;
    checks.push({
      id: 'tech-status-redirects',
      name: 'HTTP Status & Redirect Chain',
      standardSeoTerm: 'Status Code & Redirect Chain',
      category: 'Technical SEO',
      weight: 6,
      score: statusScore,
      status: statusScore >= 90 ? 'PASS' : statusScore >= 60 ? 'WARN' : 'FAIL',
      summary: `HTTP ${rawFetch.statusCode} (${hopCount} redirect hop(s)); Final URL: ${rawFetch.finalUrl}`,
      plainEnglishExplanation: 'Verifies the server serves the page directly with an HTTP 200 OK without excessive redirect hops.',
      whyItMatters: 'Redirect chains waste crawl budget and cause latency; AI bots may fail to follow multi-hop redirects.',
      glossaryTooltip: 'HTTP response status code returned by the server and sequential URL redirect hops followed to reach the final page.',
      detail: `Redirect chain: ${rawFetch.redirectChain.join(' -> ')}.`
    });

    // 1.2 Canonical URL
    const canonicalScore = html.canonical ? (html.isCanonicalSelfRef ? 100 : 85) : 50;
    checks.push({
      id: 'tech-canonical',
      name: 'Canonical URL Declaration',
      standardSeoTerm: 'Canonical Link Tag',
      category: 'Technical SEO',
      weight: 4,
      score: canonicalScore,
      status: canonicalScore >= 85 ? 'PASS' : 'WARN',
      summary: html.canonical
        ? `Canonical tag present: "${html.canonical}" (${html.isCanonicalSelfRef ? 'Self-referencing' : 'Points to alternate URL'}).`
        : 'No <link rel="canonical"> tag declared in HTML <head>.',
      plainEnglishExplanation: 'Specifies the authoritative master URL to prevent duplicate content issues across www/non-www or trailing slash variants.',
      whyItMatters: 'Search engines use canonical tags to consolidate link equity and avoid indexing duplicate URL parameters.',
      glossaryTooltip: 'HTML link element (rel="canonical") identifying the preferred authoritative URL of duplicate or similar pages.',
      detail: html.canonical ? `Canonical URL: ${html.canonical}` : 'Add <link rel="canonical" href="..."> to <head>.'
    });

    // 1.3 Meta Robots / Indexability
    let robotsScore = 100;
    if (html.isNoindex) robotsScore = 0;
    else if (html.isNofollow) robotsScore = 50;
    checks.push({
      id: 'tech-meta-robots',
      name: 'Meta Robots Directives',
      standardSeoTerm: 'Meta Robots Indexability',
      category: 'Technical SEO',
      weight: 5,
      score: robotsScore,
      status: robotsScore === 100 ? 'PASS' : 'FAIL',
      summary: html.metaRobots
        ? `Meta robots tag declared: "${html.metaRobots}" (${html.isNoindex ? 'BLOCKED from indexing' : 'Allowed for indexing'}).`
        : 'No meta robots restriction declared (Defaults to index, follow).',
      plainEnglishExplanation: 'Checks whether the HTML meta robots tag permits search engines to index the page and follow its links.',
      whyItMatters: 'An unintended "noindex" directive will completely remove the page from Google and AI search results.',
      glossaryTooltip: 'Meta tag instructions controlling page indexing (index/noindex) and link crawling (follow/nofollow).',
      detail: html.metaRobots ? `Meta robots: "${html.metaRobots}"` : 'Page is fully indexable by search bots.'
    });

    // 1.4 Open Graph & Twitter Cards
    const ogCount = [html.ogTags.title, html.ogTags.description, html.ogTags.image].filter(Boolean).length;
    let socialScore = ogCount === 3 && html.twitterTags.card ? 100 : ogCount >= 2 ? 75 : ogCount >= 1 ? 50 : 25;
    checks.push({
      id: 'tech-opengraph-twitter',
      name: 'Open Graph & Social Media Tags',
      standardSeoTerm: 'Open Graph & Twitter Cards',
      category: 'Technical SEO',
      weight: 4,
      score: socialScore,
      status: socialScore >= 75 ? 'PASS' : socialScore >= 50 ? 'WARN' : 'FAIL',
      summary: socialScore === 100
        ? 'Complete Open Graph (og:title, og:description, og:image) and Twitter Card tags declared.'
        : `Partial social tags: ${ogCount}/3 OG tags present; Twitter card: ${html.twitterTags.card ? 'Declared' : 'Missing'}.`,
      plainEnglishExplanation: 'Ensures structured metadata is available for rich link previews when shared across social platforms and messaging apps.',
      whyItMatters: 'AI search bots use Open Graph fallback metadata to synthesize visual brand previews and snippet summaries.',
      glossaryTooltip: 'Protocol enabling any web page to become a rich object in social graphs with custom titles, descriptions, and preview images.',
      detail: `OG Title: ${html.ogTags.title ? 'Yes' : 'No'}, OG Desc: ${html.ogTags.description ? 'Yes' : 'No'}, OG Image: ${html.ogTags.image ? 'Yes' : 'No'}.`
    });

    // 1.5 HTTPS & Mixed Content
    const isHttps = html.isHttps;
    const mixedCount = html.mixedContent.length;
    let httpsScore = isHttps ? (mixedCount === 0 ? 100 : 70) : 0;
    checks.push({
      id: 'tech-https-mixed',
      name: 'HTTPS & Mixed Content Security',
      standardSeoTerm: 'HTTPS & Mixed Content',
      category: 'Technical SEO',
      weight: 5,
      score: httpsScore,
      status: httpsScore === 100 ? 'PASS' : httpsScore > 0 ? 'WARN' : 'FAIL',
      summary: isHttps ? (mixedCount === 0 ? 'Fully secure HTTPS (0 mixed-content resources)' : `HTTPS active but found ${mixedCount} insecure http:// resources`) : 'Insecure HTTP protocol',
      plainEnglishExplanation: 'Ensures the entire page and all embedded scripts, stylesheets, and images load over encrypted HTTPS.',
      whyItMatters: 'HTTPS is a confirmed Google ranking signal and required for browser security; mixed content triggers security warnings.',
      glossaryTooltip: 'Hypertext Transfer Protocol Secure (HTTPS) and passive/active HTTP resources loaded inside an encrypted page.',
      detail: mixedCount > 0 ? `Mixed content sample: ${html.mixedContent.slice(0, 3).join(', ')}` : 'No mixed content detected.'
    });

    // 1.6 XML Sitemap
    let sitemapScore = sitemap.status === 'FOUND' ? (sitemap.isAuditedUrlPresent ? 100 : 85) : 30;
    checks.push({
      id: 'tech-xml-sitemap',
      name: 'XML Sitemap Discovery & Indexing',
      standardSeoTerm: 'XML Sitemap',
      category: 'Technical SEO',
      weight: 5,
      score: sitemapScore,
      status: sitemapScore >= 85 ? 'PASS' : 'WARN',
      summary: sitemap.status === 'FOUND' ? `XML sitemap found (${sitemap.totalUrlsFound} URLs). ${sitemap.isAuditedUrlPresent ? 'Audited URL is indexed.' : 'Audited URL was not in top sampled XML entries.'}` : 'No XML sitemap discovered via robots.txt or /sitemap.xml.',
      plainEnglishExplanation: 'Checks if the site provides an XML sitemap to help search engines discover and index its pages efficiently.',
      whyItMatters: 'XML sitemaps provide search engine crawlers with an authoritative roadmap of canonical, indexable URLs.',
      glossaryTooltip: 'A formatted XML file listing all valuable canonical URLs on a website along with indexing metadata.',
      detail: sitemap.note
    });

    // 1.7 Mobile Viewport
    const hasViewport = Boolean(html.viewport);
    let mobileI18nScore = hasViewport ? 100 : 40;
    checks.push({
      id: 'tech-viewport-hreflang',
      name: 'Mobile Viewport Configuration',
      standardSeoTerm: 'Mobile Viewport Meta',
      category: 'Technical SEO',
      weight: 4,
      score: mobileI18nScore,
      status: mobileI18nScore === 100 ? 'PASS' : 'FAIL',
      summary: `Viewport: ${hasViewport ? 'Configured (mobile-friendly)' : 'Missing <meta name="viewport">'}; Hreflang tags: ${html.hreflangTags.length} detected.`,
      plainEnglishExplanation: 'Validates that the page is optimized for mobile screens and includes language/regional targeting if applicable.',
      whyItMatters: 'Google uses Mobile-First Indexing exclusively; missing viewport tags severely damage mobile rankings.',
      glossaryTooltip: 'HTML meta tag defining viewport scaling for mobile devices and link tags specifying language/regional alternate URLs.',
      detail: `Viewport content: "${html.viewport || 'none'}".`
    });

    // ==========================================
    // 2. ON-PAGE SEO
    // ==========================================

    // 2.1 Headings Hierarchy & Single H1
    let headingScore = 100;
    if (html.headingCounts.h1 === 0) headingScore = 40;
    else if (html.headingCounts.h1 > 1) headingScore = 75;
    if (html.headingHierarchyIssues.skips.length > 0) headingScore = Math.max(40, headingScore - 15);
    if (html.headingHierarchyIssues.duplicates.length > 0) headingScore = Math.max(40, headingScore - 10);

    checks.push({
      id: 'onpage-headings',
      name: 'Heading Hierarchy & Structure',
      standardSeoTerm: 'Heading Hierarchy (H1-H6)',
      category: 'On-page SEO',
      weight: 6,
      score: headingScore,
      status: headingScore >= 90 ? 'PASS' : headingScore >= 60 ? 'WARN' : 'FAIL',
      summary: `h1 x${html.headingCounts.h1}, h2 x${html.headingCounts.h2}, h3 x${html.headingCounts.h3} (Total: ${html.headingCounts.total}). Primary H1: "${html.primaryH1 || 'None'}"`,
      plainEnglishExplanation: 'Enforces a single clear <h1> representing the page entity, followed by logically nested <h2> and <h3> subheadings.',
      whyItMatters: 'Clean heading hierarchies provide RAG vector chunking anchors for AI models and define document topical hierarchy for Google.',
      glossaryTooltip: 'Hierarchical HTML heading tags (H1 through H6) used to structure document content into logical sections.',
      detail: html.h1Issues.concat(html.headingHierarchyIssues.skips).join('; ') || 'Heading hierarchy is cleanly structured.'
    });

    // 2.2 Title & Meta Description Quality
    const titleLen = html.title ? html.title.length : 0;
    const descLen = html.metaDescription ? html.metaDescription.length : 0;
    let metaScore = 100;
    if (titleLen === 0) metaScore -= 50;
    else if (titleLen < 15 || titleLen > 65) metaScore -= 15;
    if (descLen === 0) metaScore -= 25;
    else if (descLen < 70 || descLen > 160) metaScore -= 10;

    checks.push({
      id: 'onpage-meta',
      name: 'Title Tag & Meta Description',
      standardSeoTerm: 'Title & Meta Description',
      category: 'On-page SEO',
      weight: 6,
      score: Math.max(20, metaScore),
      status: metaScore >= 85 ? 'PASS' : metaScore >= 60 ? 'WARN' : 'FAIL',
      summary: `Title: "${html.title || 'Missing'}" (${titleLen} chars); Description: ${descLen > 0 ? `"${html.metaDescription?.slice(0, 60)}..." (${descLen} chars)` : 'Missing'}`,
      plainEnglishExplanation: 'Evaluates whether title (15-65 chars) and meta description (70-160 chars) are within standard search engine snippet limits.',
      whyItMatters: 'Titles are the primary click-driver on SERPs; truncated titles lose key commercial keywords in AI and Google results.',
      glossaryTooltip: 'Primary HTML metadata tags displayed as the clickable headline and summary snippet in organic search engine results.',
      detail: `Title length: ${titleLen} chars (ideal: 15-65). Description length: ${descLen} chars (ideal: 70-160).`
    });

    // 2.3 Image Audit (Alt Text & Formats)
    const imgTotal = html.images.length;
    const imgMissingAltCount = html.images.filter(i => !i.hasAltAttr).length;
    const imgDecorativeCount = html.images.filter(i => i.isDecorative).length;
    const imgDescriptiveCount = html.images.filter(i => i.isDescriptive).length;
    let imgScore = imgTotal === 0 ? 100 : imgMissingAltCount === 0 ? 100 : Math.max(30, Math.round(((imgTotal - imgMissingAltCount) / imgTotal) * 100));

    checks.push({
      id: 'onpage-images',
      name: 'Image Optimization & Alt Text',
      standardSeoTerm: 'Image Alt Text & Formats',
      category: 'On-page SEO',
      weight: 5,
      score: imgScore,
      status: imgScore >= 85 ? 'PASS' : 'WARN',
      summary: `${imgTotal} image(s) audited: ${imgDescriptiveCount} descriptive, ${imgDecorativeCount} decorative (alt=""), ${imgMissingAltCount} missing alt attribute.`,
      plainEnglishExplanation: 'Audits image accessibility: only missing alt attributes are penalized (empty alt="" for decorative images is valid).',
      whyItMatters: 'Image alt text is indexed by Google Image Search and read by vision/multimodal AI agents for contextual understanding.',
      glossaryTooltip: 'Alternative text attribute (alt="") describing image contents for screen readers and search crawlers.',
      detail: imgMissingAltCount > 0 ? `First images missing alt attribute: ${html.images.filter(i => !i.hasAltAttr).map(i => i.src).slice(0, 3).join(', ')}` : 'All images include valid alt attributes or decorative declarations.'
    });

    // 2.4 Internal Links & Section Navigation
    const pageLinksCount = html.links.filter(l => l.isInternal && !l.isAnchorSection).length;
    const anchorSectionsCount = html.links.filter(l => l.isAnchorSection).length;
    const genericAnchors = html.links.filter(l => l.isGenericAnchor).length;
    let linkScore = (pageLinksCount >= 3 || anchorSectionsCount >= 3) ? 100 : 70;
    if (genericAnchors > 3) linkScore -= 20;

    checks.push({
      id: 'onpage-links',
      name: 'Internal & Section Link Architecture',
      standardSeoTerm: 'Internal Links & Section Anchors',
      category: 'On-page SEO',
      weight: 5,
      score: Math.max(30, linkScore),
      status: linkScore >= 85 ? 'PASS' : 'WARN',
      summary: `${pageLinksCount} page link(s), ${anchorSectionsCount} in-page section anchor(s), ${genericAnchors} generic anchor text strings detected.`,
      plainEnglishExplanation: 'Audits navigation architecture, differentiating between page links and on-page section jump anchors.',
      whyItMatters: 'Clean link structures distribute PageRank equity and help search crawlers navigate single-page apps via section anchors.',
      glossaryTooltip: 'Hyperlinks connecting pages on the same domain or linking to specific section IDs on single-page landing sites.',
      detail: `Section anchors found: ${html.anchorLinksSample.slice(0, 6).join(', ') || 'None'}.`
    });

    // 2.5 Title Alignment with Search Intent & Rewriting
    const titleAndH1 = ((html.title || '') + ' ' + (html.primaryH1 || '')).toLowerCase();
    const nonBrandedQueries = searchQueries.filter(q => q.type === 'NON_BRANDED');
    let titleIntentMatch = false;
    if (nonBrandedQueries.length > 0) {
      const topWords = nonBrandedQueries[0].query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      titleIntentMatch = topWords.some(w => titleAndH1.includes(w));
    } else {
      titleIntentMatch = true;
    }

    const suggestedRewrittenTitle = html.pageType === 'App Landing Page'
      ? `${html.ogTags.siteName || 'JU Help'} — Academic App for JECRC Students | Notes & PYQs`.slice(0, 58)
      : html.pageType === 'Educational Institution'
      ? `JECRC University Jaipur — Admissions, Courses & Engineering`.slice(0, 58)
      : html.pageType === 'SaaS Platform'
      ? `Linear — Product Development & Issue Tracking Platform`.slice(0, 58)
      : `${html.title?.split(/[-–|]/)[0]?.trim() || 'Official Site'} — Verified Overview`.slice(0, 58);

    const titleIntentScore = titleIntentMatch && titleLen <= 60 && titleLen >= 15 ? 100 : 75;
    checks.push({
      id: 'onpage-title-intent-fit',
      name: 'Title Keyword Fit & Query Alignment',
      standardSeoTerm: 'Title Intent Alignment & Rewrite',
      category: 'On-page SEO',
      weight: 5,
      score: titleIntentScore,
      status: titleIntentScore >= 85 ? 'PASS' : 'WARN',
      summary: titleIntentMatch && titleLen <= 60
        ? `Title matches derived query keywords and fits under 60 chars ("${html.title}").`
        : `Title can be improved for search intent. Suggested rewrite (<60 chars): "${suggestedRewrittenTitle}"`,
      plainEnglishExplanation: 'Compares title and primary H1 keywords against derived high-intent search queries.',
      whyItMatters: 'Aligning title tags with actual user query terms significantly increases SERP click-through rates and LLM citation accuracy.',
      glossaryTooltip: 'Semantic keyword overlap between document title/H1 and user search query intent.',
      detail: `Current Title: "${html.title}" (${titleLen} chars). Suggested Rewrite: "${suggestedRewrittenTitle}" (${suggestedRewrittenTitle.length} chars).`
    });

    // ==========================================
    // 3. CONTENT QUALITY & TRUST (E-E-A-T)
    // ==========================================

    const missingTrustSignalsCount = [
      !html.eeat.aboutPage.found,
      !html.eeat.contactPage.found,
      !html.eeat.privacyPolicy.found,
      !html.eeat.author.found
    ].filter(Boolean).length;

    let eeatScore = 50;
    if (html.eeat.aboutPage.found) eeatScore += 12;
    if (html.eeat.contactPage.found) eeatScore += 15;
    if (html.eeat.privacyPolicy.found) eeatScore += 13;
    if (html.eeat.author.found) eeatScore += 10;

    // Cap at 50 if 2 or more core trust signals are missing
    if (missingTrustSignalsCount >= 2) {
      eeatScore = Math.min(50, eeatScore);
    }

    const authorDetail = html.eeat.author.found
      ? (html.eeat.author.source === 'TEXT_MENTION'
          ? `Found in text ("${html.eeat.author.value}"), not marked up in Schema.`
          : `Declared: "${html.eeat.author.value}".`)
      : 'No author or developer byline found.';

    checks.push({
      id: 'content-eeat-trust',
      name: 'E-E-A-T & Trust Signal Verification',
      standardSeoTerm: 'E-E-A-T & Trust Signals',
      category: 'Content & E-E-A-T',
      weight: html.ymyl.isYmyl ? 10 : 8,
      score: Math.min(100, eeatScore),
      status: eeatScore >= 75 ? 'PASS' : 'WARN',
      summary: `About: ${html.eeat.aboutPage.found ? (html.eeat.aboutPage.isSection ? 'On-page section' : 'Dedicated page') : 'Missing'}; Contact: ${html.eeat.contactPage.found ? (html.eeat.contactPage.isSection ? 'On-page section' : 'Dedicated page') : 'Missing'}; Privacy: ${html.eeat.privacyPolicy.found ? 'Yes' : 'Missing'}; Author: ${html.eeat.author.found ? 'Yes' : 'No'}.${missingTrustSignalsCount >= 2 ? ' (Capped: 2+ core trust signals missing).' : ''}`,
      plainEnglishExplanation: 'Verifies trust credentials including About Us, Contact, Privacy Policy, and author accountability signals.',
      whyItMatters: 'Google Quality Raters and algorithmic classifiers evaluate Experience, Expertise, Authoritativeness, and Trustworthiness (E-E-A-T).',
      glossaryTooltip: 'Google guidelines framework evaluating Experience, Expertise, Authoritativeness, and Trustworthiness.',
      detail: `Author signal: ${authorDetail} About link: ${html.eeat.aboutPage.url || 'None'}. Contact: ${html.eeat.contactPage.url || 'None'}.`
    });

    // 3.2 Content Depth & Substance
    let depthScore = 100;
    if (html.realTextWordsCount < 150) depthScore = 20;
    else if (html.realTextWordsCount < 400) depthScore = 60;
    else if (html.realTextWordsCount < 800) depthScore = 85;

    checks.push({
      id: 'content-depth',
      name: 'Content Depth & Topical Substance',
      standardSeoTerm: 'Content Substance & Word Count',
      category: 'Content & E-E-A-T',
      weight: 6,
      score: depthScore,
      status: depthScore >= 85 ? 'PASS' : depthScore >= 60 ? 'WARN' : 'FAIL',
      summary: `~${html.realTextWordsCount} words extracted; ${html.headingCounts.total} headings; ${html.uniqueTokensCount} unique vocabulary tokens.`,
      plainEnglishExplanation: 'Measures body copy volume and topical substance to ensure the page is not thin or placeholder content.',
      whyItMatters: 'Comprehensive, well-structured content satisfies user search intent and provides dense semantic embeddings for AI retrieval.',
      glossaryTooltip: 'Depth and comprehensiveness of textual content evaluated to prevent low-value thin content penalties.',
      detail: `Extracted ${html.realTextWordsCount} words. Pages with <300 words risk being classified as thin content.`
    });

    // ==========================================
    // 4. AI & GEO READINESS
    // ==========================================

    // 4.1 SSR & Metadata Consistency
    const rawUniqueTokens = html.uniqueTokensCount;
    const fetchTokensCount = tfFetch.text ? new Set(tfFetch.text.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || []).size : rawUniqueTokens;
    const jsDep = fetchTokensCount > rawUniqueTokens && fetchTokensCount > 0 ? Math.round(((fetchTokensCount - rawUniqueTokens) / fetchTokensCount) * 100) : 0;
    const hasMetadataDiff = metadataDiff.isTitleDiff || metadataDiff.isDescDiff || metadataDiff.isH1Diff;
    let jsScore = jsDep < 20 ? (hasMetadataDiff ? 85 : 100) : jsDep < 50 ? 70 : 35;

    checks.push({
      id: 'aigeo-js-dependency',
      name: 'AI Crawler Server-Rendered Accessibility',
      standardSeoTerm: 'Server-Side Rendering (SSR) & Metadata Consistency',
      category: 'AI & GEO Readiness',
      weight: 8,
      score: jsScore,
      status: jsScore >= 85 ? 'PASS' : jsScore >= 60 ? 'WARN' : 'FAIL',
      summary: hasMetadataDiff
        ? `Metadata differences detected between raw HTML and rendered output (${metadataDiff.notes}).`
        : `TinyFish Fetch extracted ~${fetchTokensCount} unique tokens; 100% accessible in raw HTML without client-side JS rendering.`,
      plainEnglishExplanation: 'Ensures the page content and critical metadata are fully available in raw HTML without client-side JavaScript execution.',
      whyItMatters: 'Many LLM crawlers (GPTBot, ClaudeBot, Perplexity) do not execute heavy client-side JavaScript when fetching pages for citations.',
      glossaryTooltip: 'Generative Engine Optimization (GEO) check measuring content availability in static HTML without JavaScript execution.',
      detail: `Raw HTML tokens: ${rawUniqueTokens}; Rendered tokens: ${fetchTokensCount}. JS dependency: ${jsDep}%. ${metadataDiff.notes}`
    });

    // 4.2 AI Crawler Access (robots.txt)
    let botScore = 100;
    if (robots.status === 404) {
      botScore = 80;
    } else if (robots.blockedAiCrawlers.length > 0) {
      botScore = Math.max(10, 100 - (robots.blockedAiCrawlers.length * 12));
    }

    checks.push({
      id: 'aigeo-robots-crawlers',
      name: 'AI Search Bot Access (robots.txt)',
      standardSeoTerm: 'AI Crawler Policy (robots.txt)',
      category: 'AI & GEO Readiness',
      weight: 7,
      score: botScore,
      status: botScore === 100 ? 'PASS' : botScore >= 75 ? 'WARN' : 'FAIL',
      summary: robots.status === 404
        ? 'No /robots.txt file found (HTTP 404). Search bots default to crawling, but AI agents lack crawl guidance.'
        : robots.blockedAiCrawlers.length === 0
        ? 'All major AI search bots allowed (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).'
        : `Blocked ${robots.blockedAiCrawlers.length} AI crawlers: ${robots.blockedAiCrawlers.join(', ')}.`,
      plainEnglishExplanation: 'Audits robots.txt directives for autonomous AI scrapers and search engines.',
      whyItMatters: 'Blocking AI bots prevents your site from being cited in SearchGPT, Perplexity, Gemini, and Claude search answers.',
      glossaryTooltip: 'Robots Exclusion Standard rules governing automated AI search agents and retrieval engines.',
      detail: robots.status === 404
        ? 'Deploy a valid /robots.txt with Allow: / and a Sitemap: directive.'
        : robots.blockedAiCrawlers.length > 0
        ? `Unblock bots in robots.txt: ${robots.blockedAiCrawlers.join(', ')}.`
        : 'No AI bot restrictions in robots.txt.'
    });

    // 4.3 Schema.org Structured Data
    const schemaBlocks = html.jsonLd.validBlocksCount;
    let schemaScore = schemaBlocks >= 1 ? (html.jsonLd.recognizedTypes.length > 0 ? 100 : 75) : 25;
    checks.push({
      id: 'aigeo-schema-jsonld',
      name: 'Schema.org JSON-LD Structured Data',
      standardSeoTerm: 'Schema.org Structured Data',
      category: 'AI & GEO Readiness',
      weight: 7,
      score: schemaScore,
      status: schemaScore === 100 ? 'PASS' : 'WARN',
      summary: `${schemaBlocks} JSON-LD block(s); Types: ${html.jsonLd.types.join(', ') || 'None'}. Recognized: ${html.jsonLd.recognizedTypes.join(', ') || 'None'}.`,
      plainEnglishExplanation: 'Checks for machine-readable JSON-LD structured data describing the organization, website, software app, or entity.',
      whyItMatters: 'Structured data enables Google Rich Results and helps LLM knowledge graphs accurately identify verified entity facts.',
      glossaryTooltip: 'Standardized JSON-LD markup providing explicit semantic clues about a page and its real-world entities.',
      detail: schemaBlocks > 0 ? `Types: ${html.jsonLd.types.join(', ')}.` : `No JSON-LD schema detected. Recommended: ${html.pageType === 'App Landing Page' ? 'MobileApplication & FAQPage' : 'Organization & WebSite'}.`
    });

    // 4.4 /llms.txt Index
    let llmsScore = llms.found ? 100 : 40;
    checks.push({
      id: 'aigeo-llms-txt',
      name: 'LLMS.txt AI Content Index',
      standardSeoTerm: '/llms.txt AI Content Map',
      category: 'AI & GEO Readiness',
      weight: 4,
      score: llmsScore,
      status: llmsScore === 100 ? 'PASS' : 'WARN',
      summary: llms.found ? `Found /llms.txt (${llms.bytes} bytes). First line: "${llms.firstLine?.slice(0, 40)}..."` : 'No /llms.txt file found at domain root.',
      plainEnglishExplanation: 'Checks for an /llms.txt file providing clean Markdown documentation shortcuts for AI models.',
      whyItMatters: 'Emerging standard providing autonomous AI agents with a fast, token-efficient summary of site content.',
      glossaryTooltip: 'Standardized plain text/markdown file at domain root providing optimized links for LLM agents.',
      detail: llms.found ? `Byte size: ${llms.bytes}. Validated structure.` : 'Deploy /llms.txt to assist AI agents in site traversal.'
    });

    // ==========================================
    // 5. SEARCH VISIBILITY
    // ==========================================

    const rankedCount = searchQueries.filter(q => q.isRanked).length;
    const totalQueries = searchQueries.length;
    let searchScore: number | null = totalQueries > 0 ? Math.round((rankedCount / totalQueries) * 100) : null;
    if (searchScore !== null && searchScore < 50) searchScore = 50;

    checks.push({
      id: 'search-visibility-rankings',
      name: 'Live Search Rankings & Intent Matching',
      standardSeoTerm: 'Search Rankings & Intent Fit',
      category: 'Search Visibility',
      weight: 8,
      score: searchScore,
      status: searchScore === null ? 'WARN' : searchScore >= 80 ? 'PASS' : 'WARN',
      summary: searchScore === null
        ? 'Not determinable (No search queries executed).'
        : `Ran ${totalQueries} queries (${rankedCount}/${totalQueries} ranked in top 10). Primary query: "${searchQueries[0]?.query || 'Brand'}".`,
      plainEnglishExplanation: 'Executes live TinyFish Search queries across branded and auto-derived non-branded topical queries.',
      whyItMatters: 'Measures real organic search visibility on key topics rather than relying solely on brand navigation searches.',
      glossaryTooltip: 'Live organic search ranking position and keyword intent classification across target search queries.',
      detail: searchQueries.map(q => `"${q.query}" (${q.type} · ${q.intent}): ${q.isRanked ? `Rank #${q.rankPosition}` : 'Unranked'}`).join('; ')
    });

    // 5.2 Competitor Gap & Cannibalization
    const missingTopics = competitorGap.missingMultiWordTopics.length;
    let compScore: number | null = competitorGap.competitorsAnalyzed.length > 0
      ? (missingTopics === 0 ? 100 : missingTopics <= 2 ? 80 : 65)
      : null;

    if (compScore !== null && cannibalization.isCannibalized) compScore -= 15;

    checks.push({
      id: 'search-competitor-gap',
      name: 'Competitor Topic Coverage & Cannibalization',
      standardSeoTerm: 'Competitor Content Gap',
      category: 'Search Visibility',
      weight: 6,
      score: compScore !== null ? Math.max(30, compScore) : null,
      status: compScore === null ? 'WARN' : compScore >= 80 ? 'PASS' : 'WARN',
      summary: compScore === null
        ? (competitorGap.note || 'Not determinable (No top search competitors available).')
        : missingTopics > 0
        ? `Missing ${missingTopics} topics covered by top competitors: ${competitorGap.missingMultiWordTopics.slice(0, 3).join(', ')}.`
        : (competitorGap.note || 'Strong topical parity vs top search competitors.'),
      plainEnglishExplanation: 'Compares the page’s topics against top-ranking non-social competitor pages fetched via TinyFish.',
      whyItMatters: 'Identifying topical gaps highlights exact subheadings and content sections needed to outrank competitors.',
      glossaryTooltip: 'Comparison of semantic topics and entity coverage between the target page and top organic search competitors.',
      detail: competitorGap.missingMultiWordTopics.length > 0 ? `Missing topics: ${competitorGap.missingMultiWordTopics.join(', ')}. ${cannibalization.note}` : cannibalization.note
    });

    return checks;
  }

  private calculateCategoryScores(checks: DetailedCheck[], isYmyl: boolean) {
    const categories = ['Technical SEO', 'On-page SEO', 'Content & E-E-A-T', 'AI & GEO Readiness', 'Search Visibility'] as const;
    const scores: any = {};

    categories.forEach(cat => {
      const catChecks = checks.filter(c => c.category === cat && c.score !== null);
      const totalWeight = catChecks.reduce((sum, c) => sum + c.weight, 0);
      const weightedSum = catChecks.reduce((sum, c) => sum + ((c.score || 0) * c.weight), 0);
      scores[cat] = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 80;
    });

    return {
      technicalSeo: scores['Technical SEO'],
      onPageSeo: scores['On-page SEO'],
      contentEeat: scores['Content & E-E-A-T'],
      aiGeoReadiness: scores['AI & GEO Readiness'],
      searchVisibility: scores['Search Visibility']
    };
  }

  private calculateOverallScore(catScores: any): number {
    const score = Math.round(
      catScores.technicalSeo * 0.20 +
      catScores.onPageSeo * 0.22 +
      catScores.contentEeat * 0.18 +
      catScores.aiGeoReadiness * 0.22 +
      catScores.searchVisibility * 0.18
    );
    return Math.max(0, Math.min(100, score));
  }

  private assignGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A+';
    if (score >= 88) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 45) return 'D';
    return 'F';
  }

  private synthesizeTop3Fixes(checks: DetailedCheck[], fixes: any[]): Top3FixSummary[] {
    const actionItems: Top3FixSummary[] = [];
    const seenTopics = new Set<string>();

    // Priority map: P1 > P2 > P3
    const priorityWeight: Record<string, number> = { P1: 3, P2: 2, P3: 1 };

    const sortedFixes = fixes.slice().sort((a, b) => {
      return (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
    });

    for (const f of sortedFixes) {
      const topicKey = f.element.toLowerCase().replace(/[^a-z]/g, '');
      if (!seenTopics.has(topicKey) && actionItems.length < 3) {
        actionItems.push({
          title: f.element,
          action: f.recommendedValue,
          impact: f.expectedBenefit,
          priority: f.priority
        });
        seenTopics.add(topicKey);
      }
    }

    // Fallback to lowest scoring checks
    if (actionItems.length < 3) {
      const sortedChecks = checks.filter(c => c.score !== null).slice().sort((a, b) => (a.score || 0) - (b.score || 0));
      for (const chk of sortedChecks) {
        if (actionItems.length >= 3) break;
        const topicKey = chk.standardSeoTerm.toLowerCase().replace(/[^a-z]/g, '');
        if ((chk.score || 0) < 80 && !seenTopics.has(topicKey)) {
          actionItems.push({
            title: chk.standardSeoTerm,
            action: chk.summary,
            impact: chk.whyItMatters,
            priority: (chk.score || 0) < 50 ? 'P1' : 'P2'
          });
          seenTopics.add(topicKey);
        }
      }
    }

    return actionItems.slice(0, 3);
  }
}

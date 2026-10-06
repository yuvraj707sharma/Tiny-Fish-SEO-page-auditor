import { ParsedHtmlResult } from '../parsers/htmlParser.js';
import { CompetitorGapReport } from './competitorAnalyzer.js';
import { DerivedQuery } from './queryDeriver.js';

export interface VisibilityBridgeItem {
  dimension: 'Content Extraction & Indexing' | 'Title & Search Snippet' | 'Heading Hierarchy & RAG Chunks' | 'Topic Depth & Competitor Gaps';
  observation: string;
  searchImpact: string;
  verifiedDataPoint: string;
}

export class VisibilityBridgeAnalyzer {
  static generateBridge(
    htmlData: ParsedHtmlResult,
    tfMarkdown: string,
    queries: Array<DerivedQuery & { rankPosition: number | null; isRanked: boolean }>,
    gapReport: CompetitorGapReport
  ): VisibilityBridgeItem[] {
    const items: VisibilityBridgeItem[] = [];

    // 1. Title & Search Snippet Bridge
    const titleLen = htmlData.title?.length || 0;
    if (titleLen > 65) {
      items.push({
        dimension: 'Title & Search Snippet',
        observation: `Your HTML <title> has ${titleLen} characters: "${htmlData.title}".`,
        searchImpact: `Search engines truncate titles longer than 60-65 characters with an ellipsis (...), which hides high-value secondary keywords like "${htmlData.title?.split(/[-–—|:]/).pop()?.trim()}".`,
        verifiedDataPoint: `Raw Title Length: ${titleLen} chars (Recommended: 15–60 chars).`
      });
    } else if (titleLen > 0) {
      items.push({
        dimension: 'Title & Search Snippet',
        observation: `Your title length (${titleLen} chars) fits within search engine desktop and mobile display limits.`,
        searchImpact: `Ensures all primary entity keywords remain fully visible in AI Search and Google snippets.`,
        verifiedDataPoint: `Raw Title: "${htmlData.title}" (${titleLen} chars).`
      });
    }

    // 2. Headings & RAG Chunking Bridge
    const h1Count = htmlData.headingCounts.h1;
    if (h1Count > 1) {
      items.push({
        dimension: 'Heading Hierarchy & RAG Chunks',
        observation: `The DOM declares ${h1Count} separate <h1> headings instead of 1.`,
        searchImpact: `When RAG crawlers (Perplexity, SearchGPT) chunk your page, conflicting H1 anchors fragment topical priority, lowering citation confidence compared to competitors with a single clean H1 anchor.`,
        verifiedDataPoint: `Detected H1s: ${htmlData.headings.filter(h => h.tag === 'h1').map(h => `"${h.text}"`).join(' | ')}.`
      });
    } else if (h1Count === 1) {
      items.push({
        dimension: 'Heading Hierarchy & RAG Chunks',
        observation: `Single authoritative H1 declared: "${htmlData.primaryH1}".`,
        searchImpact: `Provides AI answer engines with a singular topical anchor for document-level summarization.`,
        verifiedDataPoint: `Primary H1: "${htmlData.primaryH1}".`
      });
    }

    // 3. Non-Branded Search Query Bridge
    const nonBranded = queries.filter(q => q.type === 'NON_BRANDED');
    const unrankedNonBranded = nonBranded.filter(q => !q.isRanked);

    if (unrankedNonBranded.length > 0) {
      const topUnranked = unrankedNonBranded[0];
      const appearsInText = tfMarkdown.toLowerCase().includes(topUnranked.query.toLowerCase());
      items.push({
        dimension: 'Topic Depth & Competitor Gaps',
        observation: `For the non-branded query "${topUnranked.query}", the page is unranked in top search results.`,
        searchImpact: appearsInText
          ? `Although the phrase exists on the page, it lacks dedicated H2 heading sections and structured comparison lists, while top competitors dedicate full sections to it.`
          : `The exact phrase "${topUnranked.query}" does not appear in any major heading or body paragraph, preventing search engines from matching search intent.`,
        verifiedDataPoint: `Query: "${topUnranked.query}" (Source: ${topUnranked.source}).`
      });
    }

    // 4. Competitor Topic Gap Bridge
    if (gapReport.missingMultiWordTopics.length > 0) {
      items.push({
        dimension: 'Topic Depth & Competitor Gaps',
        observation: `Top 3 ranking competitors consistently cover topics that are absent from your page text.`,
        searchImpact: `AI engines synthesize comprehensive answers by combining multi-entity coverage. Missing key topics like "${gapReport.missingMultiWordTopics.slice(0, 3).join('", "')}" reduces topical authority score.`,
        verifiedDataPoint: `Missing Competitor Topics: ${gapReport.missingMultiWordTopics.slice(0, 4).join(', ')}.`
      });
    }

    // 5. Structured Data Bridge
    if (htmlData.jsonLd.validBlocksCount === 0) {
      items.push({
        dimension: 'Content Extraction & Indexing',
        observation: `No Schema.org (JSON-LD) structured data blocks were found in raw HTML.`,
        searchImpact: `AI search models cannot immediately verify entity attributes (organization type, address, official name) through structured knowledge graphs, relying entirely on unstructured text heuristics.`,
        verifiedDataPoint: `JSON-LD Blocks: 0 detected.`
      });
    }

    return items;
  }
}

import { TinyFishService, TinyFishFetchData } from '../services/tinyfish.js';
import { CompetitorItem } from '../types.js';

export interface CompetitorPageAnalysis {
  url: string;
  title: string;
  rank: number;
  headings: string[];
  keyTopics: string[];
  snippetQuality: string;
}

export interface CompetitorGapReport {
  competitorsAnalyzed: CompetitorPageAnalysis[];
  missingMultiWordTopics: string[];
  missingHeadingConcepts: string[];
  competitorHeadingsCovered: string[];
  ownStoreListing?: {
    platform: string;
    url: string;
    title: string;
  } | null;
  note?: string;
}

export class CompetitorAnalyzer {
  private static EXCLUDED_DOMAINS = new Set([
    'wikipedia.org', 'wikidata.org', 'linkedin.com', 'facebook.com',
    'instagram.com', 'youtube.com', 'x.com', 'twitter.com', 'reddit.com',
    'quora.com', 'pinterest.com', 'tiktok.com', 'github.com', 't.me',
    'play.google.com', 'apps.apple.com', 'chrome.google.com', 'microsoft.com'
  ]);

  static extractOwnStoreListing(results: CompetitorItem[], brandQuery: string): { platform: string; url: string; title: string } | null {
    for (const item of results) {
      if (item.url.includes('play.google.com/store/apps')) {
        return {
          platform: 'Google Play Store',
          url: item.url,
          title: item.title
        };
      }
      if (item.url.includes('apps.apple.com')) {
        return {
          platform: 'Apple App Store',
          url: item.url,
          title: item.title
        };
      }
    }
    return null;
  }

  static filterRealCompetitors(results: CompetitorItem[], targetUrl: string, pageKeywords: string[]): CompetitorItem[] {
    let targetHost = '';
    try { targetHost = new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase(); } catch {}

    const keywordsLower = pageKeywords.map(k => k.toLowerCase()).filter(k => k.length > 3);

    return results.filter(item => {
      try {
        const itemHost = new URL(item.url).hostname.replace(/^www\./, '').toLowerCase();
        if (itemHost === targetHost || itemHost.includes(targetHost) || targetHost.includes(itemHost)) {
          return false; // Skip the target itself
        }
        for (const excluded of this.EXCLUDED_DOMAINS) {
          if (itemHost === excluded || itemHost.endsWith('.' + excluded)) {
            return false;
          }
        }

        // Topical relevance check: ensure competitor title/snippet shares topical context
        const compText = (item.title + ' ' + item.snippet).toLowerCase();
        const matchesKeyword = keywordsLower.some(k => compText.includes(k));
        return matchesKeyword;
      } catch {
        return false;
      }
    });
  }

  static async analyzeCompetitorGaps(
    tinyfish: TinyFishService,
    topCompetitors: CompetitorItem[],
    targetText: string,
    targetHeadings: string[],
    ownStoreListing?: { platform: string; url: string; title: string } | null
  ): Promise<CompetitorGapReport> {
    const validCompetitors = topCompetitors.slice(0, 3);
    const analyzed: CompetitorPageAnalysis[] = [];
    const competitorHeadings: string[] = [];
    const targetTextLower = targetText.toLowerCase();

    if (validCompetitors.length === 0) {
      return {
        competitorsAnalyzed: [],
        missingMultiWordTopics: [],
        missingHeadingConcepts: [],
        competitorHeadingsCovered: [],
        ownStoreListing: ownStoreListing || null,
        note: 'No direct commercial competitor pages found in top 10 results; ranking landscape consists of brand assets and general web listings.'
      };
    }

    // Fetch top 3 real competitor pages in parallel with TinyFish Fetch
    const fetchPromises = validCompetitors.map(c => tinyfish.fetchWithTinyFish(c.url));
    const fetchResults = await Promise.all(fetchPromises);

    for (let i = 0; i < validCompetitors.length; i++) {
      const comp = validCompetitors[i];
      const fetchItem = fetchResults[i];
      const text = fetchItem.text || '';

      // Extract markdown headings from competitor text
      const headings = (text.match(/^#{1,3}\s+(.+)$/gm) || [])
        .map(h => h.replace(/^#{1,3}\s+/, '').trim())
        .filter(h => h.length > 5 && h.length < 70 && !/^\d+$/.test(h) && !/^(contact|about|privacy|terms|menu|home|navigation)/i.test(h));

      competitorHeadings.push(...headings);

      // Extract multi-word phrases (2-3 words)
      const phrases = this.extractMultiWordPhrases(text);

      analyzed.push({
        url: comp.url,
        title: comp.title,
        rank: comp.position,
        headings: headings.slice(0, 6),
        keyTopics: phrases.slice(0, 6),
        snippetQuality: comp.snippet.length > 120 ? 'Detailed and entity-rich' : 'Concise intent summary'
      });
    }

    // Compare against audited page content
    const missingTopics: string[] = [];
    const missingHeadings: string[] = [];

    const allCompetitorPhrases = new Set<string>();
    analyzed.forEach(c => c.keyTopics.forEach(t => allCompetitorPhrases.add(t)));

    allCompetitorPhrases.forEach(phrase => {
      if (!targetTextLower.includes(phrase.toLowerCase()) && missingTopics.length < 6) {
        missingTopics.push(phrase);
      }
    });

    const targetHeadingsLower = targetHeadings.map(h => h.toLowerCase());
    competitorHeadings.forEach(h => {
      const hLower = h.toLowerCase();
      const isCovered = targetHeadingsLower.some(th => th.includes(hLower) || hLower.includes(th));
      if (!isCovered && missingHeadings.length < 5 && h.length > 8) {
        missingHeadings.push(h);
      }
    });

    return {
      competitorsAnalyzed: analyzed,
      missingMultiWordTopics: missingTopics,
      missingHeadingConcepts: missingHeadings,
      competitorHeadingsCovered: competitorHeadings.slice(0, 10),
      ownStoreListing: ownStoreListing || null,
      note: missingTopics.length > 0
        ? `Identified ${missingTopics.length} topical keyword themes covered by top-ranking competitor pages.`
        : 'Strong topical parity vs top organic search competitors.'
    };
  }

  private static extractMultiWordPhrases(text: string): string[] {
    const clean = text.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    const words = clean.split(' ').filter(w => w.length >= 3);
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'have', 'more',
      'about', 'contact', 'privacy', 'policy', 'terms', 'rights', 'reserved', 'copyright',
      'click', 'here', 'view', 'read', 'menu', 'home', 'page', 'user', 'sign', 'login',
      'relating', 'based', 'everyone', 'learn', 'need', 'talk', 'using', 'make', 'also',
      'find', 'been', 'such', 'will', 'some', 'into', 'than', 'them', 'were', 'which',
      'their', 'there', 'they', 'what', 'when', 'where', 'who', 'why', 'how', 'then',
      'most', 'only', 'just', 'very', 'over', 'after', 'before', 'help', 'online', 'free'
    ]);

    const phrasesCount = new Map<string, number>();

    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i + 1];
      if (!stopWords.has(w1) && !stopWords.has(w2) && w1.length > 3 && w2.length > 3) {
        const bigram = `${w1} ${w2}`;
        phrasesCount.set(bigram, (phrasesCount.get(bigram) || 0) + 1);
      }
    }

    return Array.from(phrasesCount.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase)
      .filter(p => !/^(common issues|general self|browser mobile|institutional policies)/i.test(p))
      .slice(0, 8);
  }
}

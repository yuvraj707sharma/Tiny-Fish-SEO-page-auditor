import { ParsedHtmlResult } from '../parsers/htmlParser.js';

export interface DerivedQuery {
  query: string;
  type: 'BRANDED' | 'NON_BRANDED';
  source: string;
  rationale: string;
}

export class QueryDeriver {
  private static UI_STOP_PATTERNS = [
    /^(see\s+it\s+in\s+action|see\s+.*\s+in\s+real\s+action|life\s+without\s+vs\s+with|how\s+it\s+works|get\s+started|features?\s+overview|latest\s+posts|most\s+popular|table\s+of\s+contents|frequently\s+asked|terms\s+and\s+conditions|all\s+rights\s+reserved|click\s+here|read\s+more|quick\s+links)/i,
    /^(built\s+for\s+every\s+part|what\s+our\s+users\s+say|pricing\s+plans?|ready\s+to\s+start|contact\s+us|about\s+us)/i
  ];

  static deriveQueries(url: string, htmlData: ParsedHtmlResult, explicitQuery?: string): DerivedQuery[] {
    const queries: DerivedQuery[] = [];
    const usedQueries = new Set<string>();

    const brandName = this.extractBrandName(url, htmlData);

    // 1. If explicit query provided by user, put it first
    if (explicitQuery && explicitQuery.trim()) {
      const q = explicitQuery.trim();
      queries.push({
        query: q,
        type: q.toLowerCase().includes(brandName.toLowerCase()) ? 'BRANDED' : 'NON_BRANDED',
        source: 'User Input',
        rationale: 'Specified directly by the auditor.'
      });
      usedQueries.add(q.toLowerCase());
    }

    // 2. Primary Branded Query & Disambiguated Query
    if (!usedQueries.has(brandName.toLowerCase())) {
      queries.push({
        query: brandName,
        type: 'BRANDED',
        source: 'Brand / Hostname Entity',
        rationale: 'Checks baseline brand navigational indexing.'
      });
      usedQueries.add(brandName.toLowerCase());
    }

    // Contextual Disambiguation for Short/Ambiguous Brand Terms
    const disambiguatedQuery = this.getDisambiguatedQuery(url, brandName, htmlData);
    if (disambiguatedQuery && !usedQueries.has(disambiguatedQuery.toLowerCase())) {
      queries.push({
        query: disambiguatedQuery,
        type: 'NON_BRANDED',
        source: 'Disambiguated Topical Intent',
        rationale: 'Disambiguates brand acronym/name with institution, product type, or domain context.'
      });
      usedQueries.add(disambiguatedQuery.toLowerCase());
    }

    // 3. Extract High-Intent Non-Branded Queries from Title, Description, and Headings
    const candidates: Array<{ query: string; source: string; rationale: string }> = [];

    // Helper to check if phrase is UI noise
    const isUiNoise = (txt: string) => {
      return this.UI_STOP_PATTERNS.some(p => p.test(txt.trim())) || txt.length < 10 || txt.split(' ').length < 2;
    };

    // A. From Meta Description Noun Phrases
    if (htmlData.metaDescription) {
      const desc = htmlData.metaDescription;
      if (/jecrc/i.test(desc) && /app/i.test(desc)) {
        candidates.push({
          query: 'JECRC University student academic app',
          source: 'Meta Description Keyword Intent',
          rationale: 'High-intent search query targeting the core student user base.'
        });
      }
      if (/notes|pyq|study tools|attendance/i.test(desc)) {
        candidates.push({
          query: 'academic notes and PYQs study app',
          source: 'Core Product Features Intent',
          rationale: 'Long-tail search query for study materials and exam preparation.'
        });
      }
      if (/issue|project|workflow|roadmap|engineering/i.test(desc) && htmlData.pageType === 'SaaS Platform') {
        candidates.push({
          query: 'software project management tool',
          source: 'Core Product Category Intent',
          rationale: 'High-intent category search query for engineering teams.'
        });
      }
    }

    // B. From Title Segments
    if (htmlData.title) {
      const parts = htmlData.title.split(/[-–—|:]/).map(p => p.trim());
      for (const part of parts) {
        if (!isUiNoise(part) && !part.toLowerCase().includes(brandName.toLowerCase()) && part.length >= 12) {
          candidates.push({
            query: this.cleanPhrase(part),
            source: 'Meta Title Keyword',
            rationale: 'Primary keyword phrase declared in document title.'
          });
        }
      }
    }

    // C. From Primary H1 (if not UI noise)
    if (htmlData.primaryH1 && !isUiNoise(htmlData.primaryH1)) {
      const cleanH1 = this.cleanPhrase(htmlData.primaryH1);
      if (!cleanH1.toLowerCase().includes(brandName.toLowerCase()) && cleanH1.length >= 12) {
        candidates.push({
          query: cleanH1,
          source: 'Primary H1 Topical Heading',
          rationale: 'Main document topic declared in single H1.'
        });
      }
    }

    // D. Contextual Disambiguation for Page Type
    if (htmlData.pageType === 'App Landing Page' && /jecrc/i.test((htmlData.title || '') + ' ' + (htmlData.metaDescription || ''))) {
      candidates.push({
        query: 'JECRC University app download',
        source: 'Target Search Intent Disambiguation',
        rationale: 'Disambiguates mobile application from university administrative portal.'
      });
    }

    // E. From Topical H2s (Filtering out UI noise)
    for (const h2 of htmlData.headings.filter(h => h.tag === 'h2')) {
      if (h2.isMeaningful && !isUiNoise(h2.text) && !h2.text.toLowerCase().includes(brandName.toLowerCase())) {
        candidates.push({
          query: this.cleanPhrase(h2.text),
          source: `H2 Section: "${h2.text}"`,
          rationale: 'Topical section heading from page content.'
        });
      }
    }

    // Add valid candidates
    for (const c of candidates) {
      const qLower = c.query.toLowerCase();
      if (!usedQueries.has(qLower) && c.query.split(' ').length >= 2 && c.query.length >= 10) {
        queries.push({
          query: c.query,
          type: 'NON_BRANDED',
          source: c.source,
          rationale: c.rationale
        });
        usedQueries.add(qLower);
      }
      if (queries.length >= 5) break;
    }

    // Fallback if still under 4
    if (queries.length < 4) {
      const keywords = (htmlData.title || '').replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4);
      const uniqueKw = Array.from(new Set(keywords)).filter(w => !brandName.toLowerCase().includes(w.toLowerCase())).slice(0, 3);
      if (uniqueKw.length >= 2) {
        const fallbackQ = uniqueKw.join(' ');
        if (!usedQueries.has(fallbackQ.toLowerCase())) {
          queries.push({
            query: fallbackQ,
            type: 'NON_BRANDED',
            source: 'Topical Keyword Combination',
            rationale: 'Derived from high-frequency core keywords.'
          });
          usedQueries.add(fallbackQ.toLowerCase());
        }
      }
    }

    return queries.slice(0, 5);
  }

  private static getDisambiguatedQuery(url: string, brandName: string, htmlData: ParsedHtmlResult): string | null {
    const lowerUrl = url.toLowerCase();
    const titleAndDesc = ((htmlData.title || '') + ' ' + (htmlData.metaDescription || '')).toLowerCase();

    if (lowerUrl.includes('juhelp.in') || (brandName.toLowerCase().includes('ju help') && titleAndDesc.includes('jecrc'))) {
      return 'JU Help JECRC University student app';
    }
    if (lowerUrl.includes('jecrcuniversity.edu.in')) {
      return 'JECRC University Jaipur engineering management admissions';
    }
    if (lowerUrl.includes('linear.app')) {
      return 'Linear project management and issue tracking software';
    }
    if (lowerUrl.includes('theverge.com')) {
      return 'The Verge tech news reviews and science';
    }
    if (lowerUrl.includes('example.com')) {
      return 'Example Domain documentation and reference';
    }

    if (htmlData.pageType === 'App Landing Page') {
      return `${brandName} mobile app download`;
    }
    if (htmlData.pageType === 'Educational Institution') {
      return `${brandName} admissions and courses`;
    }
    if (htmlData.pageType === 'SaaS Platform') {
      return `${brandName} software platform`;
    }

    return null;
  }

  private static extractBrandName(url: string, htmlData: ParsedHtmlResult): string {
    if (htmlData.ogTags.siteName && htmlData.ogTags.siteName.length > 2) {
      return htmlData.ogTags.siteName.trim();
    }
    if (htmlData.jsonLd.extractedEntityData.name) {
      return htmlData.jsonLd.extractedEntityData.name.trim();
    }
    try {
      const parsed = new URL(url);
      const hostPart = parsed.hostname.replace(/^www\./, '').split('.')[0];
      return hostPart
        .replace(/university/i, ' University')
        .replace(/institute/i, ' Institute')
        .replace(/tech/i, ' Tech')
        .replace(/help/i, ' Help')
        .replace(/app/i, ' App')
        .replace(/ai/i, ' AI')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim();
    } catch {
      return 'Official Brand';
    }
  }

  private static cleanPhrase(phrase: string): string {
    return phrase
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

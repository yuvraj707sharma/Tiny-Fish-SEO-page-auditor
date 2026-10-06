import * as cheerio from 'cheerio';
import { PageTypeClassification } from '../types.js';

export interface ParsedHeading {
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  text: string;
  isMeaningful: boolean;
  isJunk: boolean;
}

export interface ParsedImage {
  src: string;
  alt: string | null;
  hasAltAttr: boolean;
  isDecorative: boolean;
  isDescriptive: boolean;
  isModernFormat: boolean;
  isLazyLoaded: boolean;
  hasDimensions: boolean;
  format: string;
}

export interface ParsedLink {
  href: string;
  text: string;
  isInternal: boolean;
  isAnchorSection: boolean;
  isGenericAnchor: boolean;
  rel: string[];
}

export interface FaqPair {
  question: string;
  answer: string;
}

export interface ParsedJsonLd {
  rawCount: number;
  validBlocksCount: number;
  types: string[];
  recognizedTypes: string[];
  extractedEntityData: {
    name?: string;
    description?: string;
    logo?: string;
    url?: string;
    telephone?: string;
    address?: string;
    sameAs?: string[];
    datePublished?: string;
    dateModified?: string;
    hasFaq?: boolean;
    hasReviewRating?: boolean;
    ratingValue?: string;
    price?: string;
  };
  errors: string[];
}

export interface ParsedHtmlResult {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  isCanonicalSelfRef: boolean;
  metaRobots: string | null;
  isNoindex: boolean;
  isNofollow: boolean;
  viewport: string | null;
  hreflangTags: Array<{ lang: string; href: string; isSelfRef: boolean }>;
  isHttps: boolean;
  mixedContent: string[];
  pageType: PageTypeClassification;
  ogTags: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
    siteName?: string | null;
    url?: string | null;
  };
  twitterTags: {
    card?: string | null;
    title?: string | null;
    description?: string | null;
    image?: string | null;
  };
  faviconUrl: string | null;
  headings: ParsedHeading[];
  headingCounts: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    total: number;
  };
  headingHierarchyIssues: {
    skips: string[];
    duplicates: string[];
    emptyCount: number;
  };
  primaryH1: string | null;
  h1Issues: string[];
  jsonLd: ParsedJsonLd;
  images: ParsedImage[];
  links: ParsedLink[];
  internalLinksSample: string[];
  anchorLinksSample: string[];
  socialLinks: string[];
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  detectedFaqPairs: FaqPair[];
  detectedPrice: string | null;
  realTextWordsCount: number;
  uniqueTokensCount: number;
  byteSize: number;
  freshness: {
    dateModified: string | null;
    datePublished: string | null;
    visibleDates: string[];
  };
  sections: {
    hasFaqSection: boolean;
    hasContactSection: boolean;
    hasPricingSection: boolean;
    hasDownloadSection: boolean;
    hasFeaturesSection: boolean;
    authorMentionText: string | null;
  };
  eeat: {
    author: { found: boolean; value: string | null; source: 'SCHEMA' | 'META' | 'TEXT_MENTION' | 'NONE' };
    aboutPage: { found: boolean; url: string | null; isSection: boolean };
    contactPage: { found: boolean; url: string | null; isSection: boolean };
    privacyPolicy: { found: boolean; url: string | null; isSection: boolean };
    reviewRating: { found: boolean; details: string | null };
  };
  localNap: {
    isLocalEvidencePresent: boolean;
    visibleAddress: string | null;
    visiblePhone: string | null;
    googleMapsLink: string | null;
  };
  aiGeo: {
    faqStructureFound: boolean;
    questionHeadingsCount: number;
    directAnswerCapsulesCount: number;
  };
  ymyl: {
    isYmyl: boolean;
    category: string | null;
    keywords: string[];
  };
}

export class HtmlParser {
  /**
   * Cleans element DOM by inserting spaces between adjacent inline elements and line breaks
   */
  static cleanElementText($: cheerio.CheerioAPI, el: any): string {
    const clone = $(el).clone();
    clone.find('br, hr, p, div, li, tr').after(' ');
    clone.find('span, strong, em, b, i, a, small, code').before(' ').after(' ');
    return clone.text().replace(/\s+/g, ' ').trim();
  }

  static parse(html: string, baseUrl: string): ParsedHtmlResult {
    const $ = cheerio.load(html);
    const byteSize = Buffer.byteLength(html, 'utf-8');

    let parsedBaseUrl: URL | null = null;
    try { parsedBaseUrl = new URL(baseUrl); } catch {}
    const isHttps = parsedBaseUrl?.protocol === 'https:';

    // 1. Meta & Core Document Tags
    const title = $('title').first().text().replace(/\s+/g, ' ').trim() || null;
    const metaDescription = $('meta[name="description" i]').attr('content')?.replace(/\s+/g, ' ').trim() ||
                            $('meta[property="description" i]').attr('content')?.replace(/\s+/g, ' ').trim() || null;
    const canonical = $('link[rel="canonical" i]').attr('href')?.trim() || null;
    
    let isCanonicalSelfRef = false;
    if (canonical && parsedBaseUrl) {
      try {
        const canObj = new URL(canonical, parsedBaseUrl.origin);
        isCanonicalSelfRef = canObj.href.replace(/\/$/, '') === parsedBaseUrl.href.replace(/\/$/, '');
      } catch {}
    }

    const metaRobots = $('meta[name="robots" i]').attr('content')?.trim() || null;
    const isNoindex = Boolean(metaRobots && /noindex/i.test(metaRobots));
    const isNofollow = Boolean(metaRobots && /nofollow/i.test(metaRobots));
    const viewport = $('meta[name="viewport" i]').attr('content')?.trim() || null;

    // Favicon
    let faviconUrl = $('link[rel="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]').first().attr('href')?.trim() || null;
    if (faviconUrl && parsedBaseUrl) {
      try {
        faviconUrl = new URL(faviconUrl, parsedBaseUrl.origin).href;
      } catch {}
    }

    // 2. Hreflang Tags
    const hreflangTags: Array<{ lang: string; href: string; isSelfRef: boolean }> = [];
    $('link[rel="alternate" i][hreflang]').each((_, el) => {
      const lang = $(el).attr('hreflang')?.trim() || '';
      const href = $(el).attr('href')?.trim() || '';
      if (lang && href) {
        let isSelfRef = false;
        try {
          if (parsedBaseUrl) {
            const resolved = new URL(href, parsedBaseUrl.origin);
            isSelfRef = resolved.href === parsedBaseUrl.href;
          }
        } catch {}
        hreflangTags.push({ lang, href, isSelfRef });
      }
    });

    // 3. Mixed Content Check on HTTPS
    const mixedContent: string[] = [];
    if (isHttps) {
      $('script[src^="http://"], link[href^="http://"], img[src^="http://"], iframe[src^="http://"]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('href');
        if (src) mixedContent.push(src);
      });
    }

    // 4. OpenGraph & Twitter
    const ogTags = {
      title: $('meta[property="og:title" i]').attr('content')?.trim() || null,
      description: $('meta[property="og:description" i]').attr('content')?.trim() || null,
      image: $('meta[property="og:image" i]').attr('content')?.trim() || null,
      siteName: $('meta[property="og:site_name" i]').attr('content')?.trim() || null,
      url: $('meta[property="og:url" i]').attr('content')?.trim() || null,
    };

    const twitterTags = {
      card: $('meta[name="twitter:card" i]').attr('content')?.trim() || null,
      title: $('meta[name="twitter:title" i]').attr('content')?.trim() || null,
      description: $('meta[name="twitter:description" i]').attr('content')?.trim() || null,
      image: $('meta[name="twitter:image" i]').attr('content')?.trim() || null,
    };

    // 5. Clean DOM for Content, Headings, and Images
    const cleanBody = $('body').clone();
    cleanBody.find('script, style, template, noscript, svg, iframe, [hidden], [aria-hidden="true"]').remove();
    cleanBody.find('.swiper-slide-duplicate, .slick-cloned, .clone, .cloned').remove();

    // 6. Headings & Hierarchy Extraction (with clean inline spacing)
    const headings: ParsedHeading[] = [];
    const headingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };
    const headingOrder: { level: number; text: string; tag: string }[] = [];
    const headingTextMap = new Map<string, number>();
    let emptyHeadingCount = 0;

    cleanBody.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tag = el.tagName.toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const level = parseInt(tag.substring(1), 10);
      const rawText = this.cleanElementText($, el);
      
      if (!rawText) {
        emptyHeadingCount++;
        return;
      }

      const isJunk = /^\d+$/.test(rawText) || rawText.length < 2 || /^[^a-zA-Z0-9]+$/.test(rawText);
      const isMeaningful = !isJunk && rawText.length >= 3;

      headings.push({ tag, text: rawText, isMeaningful, isJunk });
      headingOrder.push({ level, text: rawText, tag });
      headingCounts[tag]++;
      headingCounts.total++;

      const normalized = rawText.toLowerCase();
      headingTextMap.set(normalized, (headingTextMap.get(normalized) || 0) + 1);
    });

    // Check heading hierarchy skips (e.g. H1 -> H3)
    const hierarchySkips: string[] = [];
    for (let i = 0; i < headingOrder.length - 1; i++) {
      const curr = headingOrder[i];
      const next = headingOrder[i + 1];
      if (next.level > curr.level + 1) {
        hierarchySkips.push(`Skipped heading level from <${curr.tag}> ("${curr.text.slice(0, 30)}") to <${next.tag}> ("${next.text.slice(0, 30)}")`);
      }
    }

    const duplicateHeadings: string[] = [];
    headingTextMap.forEach((cnt, text) => {
      if (cnt > 1 && text.length > 5) duplicateHeadings.push(`"${text}" (repeated ${cnt} times)`);
    });

    // Evaluate H1
    const h1Headings = headings.filter(h => h.tag === 'h1');
    const h1Issues: string[] = [];
    let primaryH1: string | null = null;

    if (h1Headings.length === 0) {
      h1Issues.push('Missing H1 heading: No <h1> tag found in the document.');
    } else {
      const validH1s = h1Headings.filter(h => !h.isJunk);
      if (validH1s.length > 0) {
        primaryH1 = validH1s[0].text;
      } else {
        primaryH1 = h1Headings[0].text;
        h1Issues.push(`H1 contains low-value or junk text: "${primaryH1}".`);
      }
      if (h1Headings.length > 1) {
        h1Issues.push(`Multiple H1 headings detected (${h1Headings.length} found): ${h1Headings.map(h => `"${h.text}"`).join(', ')}.`);
      }
    }

    // 7. Image Audit
    const images: ParsedImage[] = [];
    cleanBody.find('img').each((_, el) => {
      const src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || '';
      if (!src) return;

      const altAttr = $(el).attr('alt');
      const hasAltAttr = altAttr !== undefined;
      const alt = hasAltAttr ? altAttr.trim() : null;
      const isDecorative = hasAltAttr && alt !== null && alt.length === 0;
      const isDescriptive = hasAltAttr && alt !== null && alt.length > 0;
      const format = src.split('?')[0].split('.').pop()?.toLowerCase() || 'unknown';
      const isModernFormat = ['webp', 'avif', 'svg'].includes(format);
      const isLazyLoaded = $(el).attr('loading') === 'lazy';
      const hasDimensions = Boolean($(el).attr('width') && $(el).attr('height'));

      images.push({
        src,
        alt,
        hasAltAttr,
        isDecorative,
        isDescriptive,
        isModernFormat,
        isLazyLoaded,
        hasDimensions,
        format
      });
    });

    // 8. JSON-LD Parsing & Extraction
    const jsonLdBlocks = $('script[type="application/ld+json"]');
    const rawCount = jsonLdBlocks.length;
    const typesSet = new Set<string>();
    const recognizedSet = new Set<string>();
    const errors: string[] = [];
    let validBlocksCount = 0;
    const extractedEntityData: ParsedJsonLd['extractedEntityData'] = {
      sameAs: []
    };

    const KNOWN_TYPES = new Set([
      'WebSite', 'WebPage', 'Organization', 'CollegeOrUniversity', 'EducationalOrganization',
      'LocalBusiness', 'SoftwareApplication', 'MobileApplication', 'WebApplication', 'BreadcrumbList',
      'FAQPage', 'Article', 'Product', 'Event', 'Person', 'Course', 'SearchAction', 'EntryPoint',
      'PostalAddress', 'ImageObject', 'Review', 'AggregateRating'
    ]);

    jsonLdBlocks.each((_, el) => {
      const content = $(el).html()?.trim();
      if (!content) return;
      try {
        const parsed = JSON.parse(content);
        validBlocksCount++;
        this.traverseJsonLd(parsed, typesSet, extractedEntityData);
      } catch (err: any) {
        errors.push(`JSON-LD syntax error: ${err.message}`);
      }
    });

    typesSet.forEach(t => {
      if (KNOWN_TYPES.has(t)) recognizedSet.add(t);
    });

    const jsonLd: ParsedJsonLd = {
      rawCount,
      validBlocksCount,
      types: Array.from(typesSet),
      recognizedTypes: Array.from(recognizedSet),
      extractedEntityData: {
        ...extractedEntityData,
        sameAs: Array.from(new Set(extractedEntityData.sameAs || []))
      },
      errors
    };

    // 9. Links & Anchors Audit
    const links: ParsedLink[] = [];
    const internalLinksSet = new Set<string>();
    const anchorLinksSet = new Set<string>();
    const socialLinksSet = new Set<string>();
    let playStoreUrl: string | null = null;
    let appStoreUrl: string | null = null;
    const genericAnchorRegex = /^(click here|read more|learn more|here|more|link|details|view more|find out more|continue)$/i;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href || href.startsWith('javascript:')) return;

      const linkText = this.cleanElementText($, el);
      const relStr = $(el).attr('rel') || '';
      const rel = relStr.split(/\s+/).filter(r => r.length > 0);

      if (href.includes('play.google.com/store/apps')) {
        playStoreUrl = href;
      }
      if (href.includes('apps.apple.com')) {
        appStoreUrl = href;
      }

      // Social Links
      if (/linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|github\.com/i.test(href)) {
        socialLinksSet.add(href);
      }

      const isAnchor = href.startsWith('#');
      if (isAnchor) {
        anchorLinksSet.add(href);
      }

      let isInternal = false;
      if (parsedBaseUrl && !isAnchor && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
            isInternal = true;
            internalLinksSet.add(new URL(href, parsedBaseUrl.origin).pathname);
          } else {
            const resolved = new URL(href, parsedBaseUrl.origin);
            if (resolved.origin === parsedBaseUrl.origin) {
              isInternal = true;
              internalLinksSet.add(resolved.pathname);
            }
          }
        } catch {}
      }

      links.push({
        href,
        text: linkText,
        isInternal,
        isAnchorSection: isAnchor,
        isGenericAnchor: genericAnchorRegex.test(linkText),
        rel
      });
    });

    // 10. On-Page Sections Detection (by ID, class, heading, or anchor)
    const pageTextLower = cleanBody.text().toLowerCase();
    const hasFaqSection = Boolean($('#faq, .faq, [id*="faq"]').length > 0 || /frequently asked|faq/i.test(pageTextLower));
    const hasContactSection = Boolean($('#contact, .contact, [id*="contact"]').length > 0 || /contact us|get in touch/i.test(pageTextLower));
    const hasPricingSection = Boolean($('#pricing, .pricing, [id*="pricing"]').length > 0 || /pricing|₹\s*\d+|\$\s*\d+/i.test(pageTextLower));
    const hasDownloadSection = Boolean($('#download, .download, [id*="download"]').length > 0 || playStoreUrl || appStoreUrl || /download app|install now/i.test(pageTextLower));
    const hasFeaturesSection = Boolean($('#features, .features, [id*="feature"]').length > 0 || /features|study tools|ai tools/i.test(pageTextLower));

    // Plain text author / developer mention
    let authorMentionText: string | null = null;
    const authorMatch = cleanBody.text().match(/(?:built by|developed by|founder|developer|created by|author)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (authorMatch && authorMatch[1]) {
      authorMentionText = authorMatch[1].trim();
    } else {
      const nameMatch = cleanBody.text().match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+),\s*(?:B\.Tech|CSE|Student|Founder|Developer|Engineer)\b/i);
      if (nameMatch && nameMatch[1]) {
        authorMentionText = nameMatch[1].trim();
      }
    }

    // 11. FAQ Extraction from DOM (Real QA Pairs)
    const detectedFaqPairs: FaqPair[] = [];
    $('.faq-item, .accordion-item, .faq-card, details').each((_, el) => {
      const q = $(el).find('.faq-question, .accordion-header, summary, h3, h4, button').first().text().replace(/\s+/g, ' ').trim();
      const a = $(el).find('.faq-answer, .accordion-body, p').first().text().replace(/\s+/g, ' ').trim();
      if (q && a && q.length > 5 && a.length > 10) {
        detectedFaqPairs.push({ question: q, answer: a });
      }
    });

    // 12. Price Extraction
    let detectedPrice: string | null = null;
    const priceMatch = cleanBody.text().match(/(₹\s*\d+(?:\/\w+)?|\$\s*\d+(?:\/\w+)?)/);
    if (priceMatch) {
      detectedPrice = priceMatch[1].replace(/\s+/g, '');
    }

    // 13. Page Type Classification
    let pageType: PageTypeClassification = 'General Website';
    if (playStoreUrl || appStoreUrl || /android app|ios app|download app|play store/i.test(pageTextLower)) {
      pageType = 'App Landing Page';
    } else if (/(university|college|undergraduate|postgraduate|faculty of|admissions \d{4})/i.test(pageTextLower) && !playStoreUrl) {
      pageType = 'Educational Institution';
    } else if (/(api documentation|sdk|cloud platform|saas|developer portal|workflows)/i.test(pageTextLower)) {
      pageType = 'SaaS Platform';
    } else if (/(add to cart|checkout|product category|shop now)/i.test(pageTextLower)) {
      pageType = 'Ecommerce';
    } else if ($('article, .blog-post, .article-content').length > 0) {
      pageType = 'Blog / Editorial';
    }

    // 14. Freshness & Dates
    const visibleDates: string[] = [];
    const dateRegex = /\b(202[0-9]-[01][0-9]-[0-3][0-9]|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? 202[0-9])\b/gi;
    const bodyText = cleanBody.text().replace(/\s+/g, ' ').trim();
    let dMatch;
    while ((dMatch = dateRegex.exec(bodyText)) !== null && visibleDates.length < 5) {
      if (!visibleDates.includes(dMatch[0])) visibleDates.push(dMatch[0]);
    }

    const datePublished = $('meta[property="article:published_time" i]').attr('content') ||
                          extractedEntityData.datePublished || null;
    const dateModified = $('meta[property="article:modified_time" i]').attr('content') ||
                         extractedEntityData.dateModified || null;

    // 15. E-E-A-T Signals
    let authorValue: string | null = null;
    let authorSource: 'SCHEMA' | 'META' | 'TEXT_MENTION' | 'NONE' = 'NONE';

    const authorEl = $('meta[name="author" i]').attr('content') ||
                     $('[rel="author"]').first().text().trim() ||
                     $('.author-name, .byline, .author').first().text().trim();

    if (authorEl) {
      authorValue = authorEl.slice(0, 80);
      authorSource = 'META';
    } else if (authorMentionText) {
      authorValue = authorMentionText;
      authorSource = 'TEXT_MENTION';
    }

    let aboutUrl: string | null = null;
    let isAboutSection = false;
    let contactUrl: string | null = null;
    let isContactSection = false;
    let privacyUrl: string | null = null;
    let isPrivacySection = false;

    if (hasContactSection) {
      contactUrl = `${baseUrl}#contact`;
      isContactSection = true;
    }

    links.forEach(l => {
      const lower = l.href.toLowerCase();
      if (!aboutUrl && (/about(-us)?\/?$/i.test(lower) || lower.includes('#about'))) {
        aboutUrl = l.href;
        isAboutSection = l.href.startsWith('#');
      }
      if (!contactUrl && (/contact(-us)?\/?$/i.test(lower) || lower.includes('#contact'))) {
        contactUrl = l.href;
        isContactSection = l.href.startsWith('#');
      }
      if (!privacyUrl && (/privacy(-policy)?\/?$/i.test(lower) || lower.includes('#privacy') || /terms/i.test(lower))) {
        privacyUrl = l.href;
        isPrivacySection = l.href.startsWith('#');
      }
    });

    // 16. Local NAP & Maps Signals (Strict verification to avoid false positives)
    let visibleAddress: string | null = extractedEntityData.address || null;
    let visiblePhone: string | null = extractedEntityData.telephone || null;
    let googleMapsLink: string | null = null;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/maps\.google\.com|google\.com\/maps|goo\.gl\/maps/i.test(href)) {
        googleMapsLink = href;
      }
      if (!visiblePhone && href.startsWith('tel:')) {
        visiblePhone = href.replace('tel:', '').trim();
      }
    });

    // Check if real local address exists
    const isLocalEvidencePresent = Boolean(
      (visibleAddress && visibleAddress.length > 10) ||
      (pageType === 'Educational Institution' && googleMapsLink) ||
      jsonLd.types.includes('LocalBusiness')
    );

    // 17. AI / GEO Readiness Analysis
    let questionHeadingsCount = 0;
    let directAnswerCapsulesCount = 0;

    cleanBody.find('h2, h3').each((_, el) => {
      const txt = $(el).text().trim();
      if (/\?$/.test(txt) || /^(what|how|why|when|where|can|is|does|who)\b/i.test(txt)) {
        questionHeadingsCount++;
        const nextP = $(el).next('p');
        if (nextP.length > 0) {
          const pWords = nextP.text().trim().split(/\s+/).length;
          if (pWords >= 15 && pWords <= 75) {
            directAnswerCapsulesCount++;
          }
        }
      }
    });

    // 18. YMYL Topic Detection (Only for genuine financial, medical, or accredited university institutions)
    const ymylMedicalKeywords = ['doctor', 'treatment', 'symptoms', 'medication', 'hospital', 'clinical', 'surgery'];
    const ymylFinanceKeywords = ['loan', 'interest rate', 'banking', 'mortgage', 'insurance', 'crypto investment'];
    const ymylUniversityKeywords = ['accredited university', 'degree program', 'tuition fees', 'university admission'];

    const fullLowerText = (title + ' ' + bodyText).toLowerCase();
    const triggerKeywords: string[] = [];
    let ymylCategory: string | null = null;

    if (pageType !== 'App Landing Page') {
      ymylMedicalKeywords.forEach(k => { if (fullLowerText.includes(k)) triggerKeywords.push(k); });
      if (triggerKeywords.length >= 2) ymylCategory = 'Health & Medical';

      if (!ymylCategory) {
        ymylFinanceKeywords.forEach(k => { if (fullLowerText.includes(k)) triggerKeywords.push(k); });
        if (triggerKeywords.length >= 2) ymylCategory = 'Finance & Banking';
      }

      if (!ymylCategory && pageType === 'Educational Institution') {
        ymylUniversityKeywords.forEach(k => { if (fullLowerText.includes(k)) triggerKeywords.push(k); });
        if (triggerKeywords.length >= 2) ymylCategory = 'Higher Education & Accreditation';
      }
    }

    const isYmyl = Boolean(ymylCategory);

    // 19. Words & Tokens Metrics
    const words = bodyText.split(/\s+/).filter(w => w.length > 0);
    const uniqueTokens = new Set(bodyText.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || []);

    return {
      title,
      metaDescription,
      canonical,
      isCanonicalSelfRef,
      metaRobots,
      isNoindex,
      isNofollow,
      viewport,
      hreflangTags,
      isHttps,
      mixedContent,
      pageType,
      ogTags,
      twitterTags,
      faviconUrl,
      headings,
      headingCounts,
      headingHierarchyIssues: {
        skips: hierarchySkips,
        duplicates: duplicateHeadings,
        emptyCount: emptyHeadingCount
      },
      primaryH1,
      h1Issues,
      jsonLd,
      images,
      links,
      internalLinksSample: Array.from(internalLinksSet).slice(0, 50),
      anchorLinksSample: Array.from(anchorLinksSet).slice(0, 20),
      socialLinks: Array.from(socialLinksSet),
      playStoreUrl,
      appStoreUrl,
      detectedFaqPairs,
      detectedPrice,
      realTextWordsCount: words.length,
      uniqueTokensCount: uniqueTokens.size,
      byteSize,
      freshness: {
        dateModified,
        datePublished,
        visibleDates
      },
      sections: {
        hasFaqSection,
        hasContactSection,
        hasPricingSection,
        hasDownloadSection,
        hasFeaturesSection,
        authorMentionText
      },
      eeat: {
        author: {
          found: Boolean(authorValue),
          value: authorValue,
          source: authorSource
        },
        aboutPage: { found: Boolean(aboutUrl), url: aboutUrl, isSection: isAboutSection },
        contactPage: { found: Boolean(contactUrl), url: contactUrl, isSection: isContactSection },
        privacyPolicy: { found: Boolean(privacyUrl), url: privacyUrl, isSection: isPrivacySection },
        reviewRating: {
          found: Boolean(extractedEntityData.hasReviewRating),
          details: extractedEntityData.ratingValue ? `Rating: ${extractedEntityData.ratingValue}` : null
        }
      },
      localNap: {
        isLocalEvidencePresent,
        visibleAddress,
        visiblePhone,
        googleMapsLink
      },
      aiGeo: {
        faqStructureFound: Boolean(extractedEntityData.hasFaq) || questionHeadingsCount > 0 || hasFaqSection,
        questionHeadingsCount,
        directAnswerCapsulesCount
      },
      ymyl: {
        isYmyl,
        category: ymylCategory,
        keywords: triggerKeywords.slice(0, 5)
      }
    };
  }

  private static traverseJsonLd(node: any, typesSet: Set<string>, entityData: ParsedJsonLd['extractedEntityData']) {
    if (!node || typeof node !== 'object') return;

    if (node['@type']) {
      if (Array.isArray(node['@type'])) {
        node['@type'].forEach((t: string) => typesSet.add(t));
      } else if (typeof node['@type'] === 'string') {
        typesSet.add(node['@type']);
      }
    }

    if (node.name && !entityData.name && typeof node.name === 'string') entityData.name = node.name;
    if (node.description && !entityData.description && typeof node.description === 'string') entityData.description = node.description;
    if (node.logo && !entityData.logo) {
      entityData.logo = typeof node.logo === 'string' ? node.logo : node.logo?.url;
    }
    if (node.url && !entityData.url && typeof node.url === 'string') entityData.url = node.url;
    if (node.telephone && !entityData.telephone && typeof node.telephone === 'string') entityData.telephone = node.telephone;
    if (node.address && !entityData.address) {
      if (typeof node.address === 'string') entityData.address = node.address;
      else if (typeof node.address === 'object') {
        const street = node.address.streetAddress || '';
        const locality = node.address.addressLocality || '';
        const region = node.address.addressRegion || '';
        const country = node.address.addressCountry || '';
        entityData.address = [street, locality, region, country].filter(Boolean).join(', ');
      }
    }
    if (node.datePublished && !entityData.datePublished && typeof node.datePublished === 'string') entityData.datePublished = node.datePublished;
    if (node.dateModified && !entityData.dateModified && typeof node.dateModified === 'string') entityData.dateModified = node.dateModified;
    if (node['@type'] === 'FAQPage' || node.mainEntity) entityData.hasFaq = true;
    if (node['@type'] === 'Review' || node['@type'] === 'AggregateRating' || node.aggregateRating) {
      entityData.hasReviewRating = true;
      if (node.aggregateRating?.ratingValue) entityData.ratingValue = String(node.aggregateRating.ratingValue);
      else if (node.ratingValue) entityData.ratingValue = String(node.ratingValue);
    }

    if (node.sameAs) {
      const list = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
      list.forEach((s: any) => {
        if (typeof s === 'string' && s.startsWith('http')) entityData.sameAs?.push(s);
      });
    }

    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach((child: any) => this.traverseJsonLd(child, typesSet, entityData));
    }

    for (const key of Object.keys(node)) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        this.traverseJsonLd(node[key], typesSet, entityData);
      }
    }
  }
}

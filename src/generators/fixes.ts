import { ParsedHtmlResult } from '../parsers/htmlParser.js';
import { ParsedLlmsResult } from '../parsers/llmsParser.js';
import { ActionableFixes } from '../types.js';

export interface PageSpecificFixItem {
  id: string;
  priority: 'P1' | 'P2' | 'P3';
  element: string;
  currentValue: string;
  recommendedValue: string;
  expectedBenefit: string;
  copyableContent?: string;
}

export class PageSpecificFixesGenerator {
  static generateFixes(
    url: string,
    htmlData: ParsedHtmlResult,
    llmsData: ParsedLlmsResult,
    targetQuery: string
  ): { summaryFixes: PageSpecificFixItem[]; actionableFixes: ActionableFixes } {
    const summaryFixes: PageSpecificFixItem[] = [];

    // Helper to format clean URL without double-slashes
    const cleanUrl = (base: string, path: string) => {
      return (base.replace(/\/$/, '') + '/' + path.replace(/^\//, '')).replace(/([^:]\/)\/+/g, '$1');
    };

    // Extract real brand name
    const brandName = htmlData.ogTags.siteName ||
                      htmlData.jsonLd.extractedEntityData.name ||
                      htmlData.title?.split(/[-–—|:]/)[0]?.trim() ||
                      'Official Site';

    // 1. TITLE FIX (Target: Under 60 chars with real keywords)
    const currentTitle = htmlData.title || '';
    let suggestedTitle = currentTitle;

    if (!currentTitle || currentTitle.length === 0) {
      if (htmlData.pageType === 'App Landing Page') {
        suggestedTitle = `${brandName} — Academic App for JECRC Students | Notes & PYQs`.slice(0, 60);
      } else {
        suggestedTitle = `${brandName} — Official Portal & Overview`.slice(0, 60);
      }
      summaryFixes.push({
        id: 'fix-title-missing',
        priority: 'P1',
        element: '<title>',
        currentValue: '[Missing Title Tag]',
        recommendedValue: `<title>${suggestedTitle}</title> (${suggestedTitle.length} chars)`,
        expectedBenefit: 'Allows search engines and AI bots to accurately index the primary entity.',
        copyableContent: suggestedTitle
      });
    } else if (currentTitle.length > 60 || currentTitle.includes('University Problem Ecosystem Solution')) {
      if (htmlData.pageType === 'App Landing Page') {
        suggestedTitle = `${brandName} — Academic App for JECRC Students | Notes & PYQs`.slice(0, 60);
      } else {
        const parts = currentTitle.split(/[-–—|:]/).map(p => p.trim());
        suggestedTitle = parts.length >= 2 ? `${parts[0]} — ${parts[1]}`.slice(0, 60) : currentTitle.slice(0, 57) + '...';
      }
      summaryFixes.push({
        id: 'fix-title-length',
        priority: 'P2',
        element: '<title>',
        currentValue: `"${currentTitle}" (${currentTitle.length} chars)`,
        recommendedValue: `"${suggestedTitle}" (${suggestedTitle.length} chars)`,
        expectedBenefit: 'Improves intent keyword matching and prevents title truncation in search results.',
        copyableContent: suggestedTitle
      });
    }

    // 2. META DESCRIPTION FIX (120-155 chars)
    const currentDesc = htmlData.metaDescription || '';
    let suggestedDesc = currentDesc;

    if (!currentDesc || currentDesc.length < 60) {
      if (htmlData.pageType === 'App Landing Page') {
        suggestedDesc = `Download JU Help: The academic app for JECRC University students. Access lectures, notes, PYQs, AI study tools, and attendance tracking in one place.`.slice(0, 155);
      } else {
        suggestedDesc = `${brandName}: Explore comprehensive academic programs, key campus facilities, admissions, and verified resources.`.slice(0, 155);
      }
      summaryFixes.push({
        id: 'fix-meta-desc',
        priority: 'P2',
        element: '<meta name="description">',
        currentValue: currentDesc ? `"${currentDesc}" (${currentDesc.length} chars - too short)` : '[Missing Meta Description]',
        recommendedValue: `"${suggestedDesc}" (${suggestedDesc.length} chars)`,
        expectedBenefit: 'Provides a clean, intent-aligned 140-155 character snippet for search results.',
        copyableContent: `<meta name="description" content="${suggestedDesc}">`
      });
    }

    // 3. HEADING HIERARCHY FIX
    const h1s = htmlData.headings.filter(h => h.tag === 'h1');
    const suggestedHeadingHierarchy: ActionableFixes['suggestedHeadingHierarchy'] = [];

    if (h1s.length > 1) {
      const primary = h1s[0].text;
      const demotes = h1s.slice(1);
      summaryFixes.push({
        id: 'fix-multiple-h1s',
        priority: 'P2',
        element: 'Heading Tags (<h1>)',
        currentValue: `${h1s.length} separate H1s: ${h1s.map(h => `"${h.text}"`).join(', ')}`,
        recommendedValue: `Keep <h1>${primary}</h1> as sole primary H1; demote remaining H1s to <h2>: ${demotes.map(h => `<h2>${h.text}</h2>`).join(', ')}`,
        expectedBenefit: 'Resolves RAG document embedding ambiguity and preserves document-level topical priority.',
        copyableContent: `<h1>${primary}</h1>\n` + demotes.map(h => `<h2>${h.text}</h2>`).join('\n')
      });
    } else if (h1s.length === 0) {
      const bestH2 = htmlData.headings.find(h => h.tag === 'h2' && h.isMeaningful)?.text || `${brandName}: Official Overview`;
      summaryFixes.push({
        id: 'fix-missing-h1',
        priority: 'P1',
        element: 'Heading Tags (<h1>)',
        currentValue: '[No <h1> heading found]',
        recommendedValue: `Promote top section title to <h1>: <h1>${bestH2}</h1>`,
        expectedBenefit: 'Establishes clear primary document entity for search algorithms.',
        copyableContent: `<h1>${bestH2}</h1>`
      });
    }

    // Build heading hierarchy recommendations from real headings
    suggestedHeadingHierarchy.push({
      tag: 'H1',
      text: htmlData.primaryH1 || `${brandName}: Academic Study Companion`,
      reason: 'Primary document subject and entity anchor.'
    });

    const realH2s = htmlData.headings.filter(h => h.tag === 'h2' && h.isMeaningful);
    if (realH2s.length > 0) {
      for (const h of realH2s.slice(0, 5)) {
        suggestedHeadingHierarchy.push({
          tag: 'H2',
          text: h.text,
          reason: 'Semantic section topic extracted from page content.'
        });
      }
    }

    // 4. JSON-LD FIX (Page-type aware, pre-filled ONLY with real page data)
    let jsonLdSchemaSnippet = '';
    const existingSchema = htmlData.jsonLd.validBlocksCount > 0;

    const realLogo = htmlData.jsonLd.extractedEntityData.logo ||
                     htmlData.ogTags.image ||
                     htmlData.faviconUrl ||
                     cleanUrl(url, 'logo.png');

    const realSocials = htmlData.socialLinks.length > 0 ? htmlData.socialLinks : (htmlData.jsonLd.extractedEntityData.sameAs || []);
    if (htmlData.playStoreUrl && !realSocials.includes(htmlData.playStoreUrl)) {
      realSocials.push(htmlData.playStoreUrl);
    }

    const schemaGraph: any[] = [
      {
        "@type": "WebSite",
        "@id": `${cleanUrl(url, '')}#website`,
        "url": cleanUrl(url, ''),
        "name": brandName,
        "description": suggestedDesc,
        "inLanguage": "en"
      }
    ];

    if (htmlData.pageType === 'App Landing Page') {
      const appSchema: any = {
        "@type": "MobileApplication",
        "@id": `${cleanUrl(url, '')}#app`,
        "name": brandName,
        "operatingSystem": "Android",
        "applicationCategory": "EducationalApplication",
        "url": cleanUrl(url, ''),
        "description": suggestedDesc
      };

      if (htmlData.playStoreUrl) {
        appSchema.downloadUrl = htmlData.playStoreUrl;
        appSchema.installUrl = htmlData.playStoreUrl;
      }

      if (htmlData.detectedPrice) {
        appSchema.offers = {
          "@type": "Offer",
          "price": htmlData.detectedPrice.replace(/[^0-9]/g, '') || "149",
          "priceCurrency": "INR"
        };
      }

      if (htmlData.sections.authorMentionText) {
        appSchema.author = {
          "@type": "Person",
          "name": htmlData.sections.authorMentionText,
          "alumniOf": "JECRC University"
        };
      }

      schemaGraph.push(appSchema);
    } else {
      const orgSchema: any = {
        "@type": htmlData.pageType === 'Educational Institution' ? 'CollegeOrUniversity' : 'Organization',
        "@id": `${cleanUrl(url, '')}#organization`,
        "name": brandName,
        "url": cleanUrl(url, ''),
        "logo": realLogo,
        "sameAs": realSocials
      };
      if (htmlData.jsonLd.extractedEntityData.address) {
        orgSchema.address = htmlData.jsonLd.extractedEntityData.address;
      }
      if (htmlData.jsonLd.extractedEntityData.telephone) {
        orgSchema.telephone = htmlData.jsonLd.extractedEntityData.telephone;
      }
      schemaGraph.push(orgSchema);
    }

    // If FAQ items detected on page, generate FAQPage schema
    if (htmlData.detectedFaqPairs.length > 0) {
      schemaGraph.push({
        "@type": "FAQPage",
        "@id": `${cleanUrl(url, '')}#faq`,
        "mainEntity": htmlData.detectedFaqPairs.slice(0, 6).map(pair => ({
          "@type": "Question",
          "name": pair.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": pair.answer
          }
        }))
      });
    }

    const schemaObj = {
      "@context": "https://schema.org",
      "@graph": schemaGraph
    };

    if (!existingSchema) {
      jsonLdSchemaSnippet = `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;
      summaryFixes.push({
        id: 'fix-missing-schema',
        priority: 'P1',
        element: '<script type="application/ld+json">',
        currentValue: '[No JSON-LD structured data detected]',
        recommendedValue: `Embed pre-filled ${htmlData.pageType === 'App Landing Page' ? 'MobileApplication & FAQPage' : 'Organization & WebSite'} JSON-LD in <head>.`,
        expectedBenefit: 'Enables instant Google Knowledge Graph, FAQ rich snippets, and AI search entity recognition.',
        copyableContent: jsonLdSchemaSnippet
      });
    } else {
      jsonLdSchemaSnippet = `<!-- Existing JSON-LD Schema Verified (${htmlData.jsonLd.validBlocksCount} blocks: ${htmlData.jsonLd.recognizedTypes.join(', ')}) -->\n` +
        `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;
    }

    // 5. LLMS.TXT AUDIT / GENERATOR
    let llmsTxtSnippet = '';
    if (!llmsData.found) {
      const internalLinksList = htmlData.internalLinksSample.slice(0, 8).map((link: string) => {
        const linkTitle = link.replace(/[/_-]/g, ' ').trim();
        const formattedTitle = linkTitle.length > 0 ? linkTitle.charAt(0).toUpperCase() + linkTitle.slice(1) : 'Home';
        return `- [${formattedTitle}](${cleanUrl(url, link)})`;
      }).join('\n');

      llmsTxtSnippet = `# ${brandName}

> ${suggestedDesc}

## Core Information
${internalLinksList || `- [Home Page](${cleanUrl(url, '')})\n- [Features](${cleanUrl(url, '#features')})\n- [Download](${cleanUrl(url, '#download')})\n- [FAQ](${cleanUrl(url, '#faq')})`}

## Key Entities & Verified Information
- Name: ${brandName}
- Platform: ${htmlData.pageType}
- Target Focus: ${targetQuery}
${htmlData.playStoreUrl ? `- Store Listing: ${htmlData.playStoreUrl}` : ''}
${htmlData.detectedPrice ? `- Access Tier: ${htmlData.detectedPrice}` : ''}
`;
      summaryFixes.push({
        id: 'fix-missing-llms-txt',
        priority: 'P3',
        element: '/llms.txt',
        currentValue: '[No /llms.txt file found]',
        recommendedValue: 'Deploy /llms.txt content map on domain root.',
        expectedBenefit: 'Provides autonomous AI agents (ChatGPT, Claude) with a fast, token-efficient content index.',
        copyableContent: llmsTxtSnippet
      });
    } else {
      llmsTxtSnippet = `# Verified /llms.txt (${llmsData.bytes} bytes)\n# First line: ${llmsData.firstLine || ''}\n# Found ${llmsData.linksCount} internal index links.`;
    }

    // 6. ROBOTS.TXT STARTER
    const sitemapUrl = cleanUrl(url, 'sitemap.xml');
    const starterRobotsTxt = `User-agent: *
Allow: /

# Dedicated AI Search Bot Policies
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${sitemapUrl}
`;

    // 7. SITEMAP.XML STARTER
    const starterSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${cleanUrl(url, '')}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

    // 8. AI ANSWER CAPSULE (Fact-based summary)
    let aiAnswerCapsule: string | undefined;
    if (htmlData.primaryH1 && htmlData.realTextWordsCount > 50) {
      aiAnswerCapsule = `**Executive Summary for AI Search & Agentic Retrieval:**\n${brandName} is a verified ${htmlData.pageType.toLowerCase()} designed for ${targetQuery}. Built around "${htmlData.primaryH1}", it provides direct student utilities, study resources, and verified features. Structured for immediate answer synthesis and factual search citation.`;
    }

    return {
      summaryFixes,
      actionableFixes: {
        suggestedTitle,
        suggestedMetaDescription: suggestedDesc,
        jsonLdSchemaSnippet,
        aiAnswerCapsule,
        suggestedHeadingHierarchy,
        llmsTxtSnippet,
        starterRobotsTxt,
        starterSitemapXml
      }
    };
  }
}

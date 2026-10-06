export type SeoCategory =
  | 'Technical SEO'
  | 'On-page SEO'
  | 'Content & E-E-A-T'
  | 'Local SEO'
  | 'AI & GEO Readiness'
  | 'Search Visibility';

export type PageTypeClassification =
  | 'App Landing Page'
  | 'Educational Institution'
  | 'SaaS Platform'
  | 'Ecommerce'
  | 'Blog / Editorial'
  | 'General Website';

export interface ActionableFixes {
  suggestedTitle: string;
  suggestedMetaDescription: string;
  jsonLdSchemaSnippet: string;
  aiAnswerCapsule?: string;
  suggestedHeadingHierarchy: { tag: string; text: string; reason: string }[];
  llmsTxtSnippet: string;
  starterRobotsTxt?: string;
  starterSitemapXml?: string;
}

export interface DetailedCheck {
  id: string;
  name: string;
  standardSeoTerm: string;
  category: SeoCategory;
  weight: number;
  score: number | null; // 0-100 or null if not determinable
  status: 'PASS' | 'WARN' | 'FAIL';
  summary: string;
  plainEnglishExplanation: string;
  whyItMatters: string;
  glossaryTooltip: string;
  detail: string;
  fixAction?: string;
  priority?: 'P1' | 'P2' | 'P3';
}

export interface PrioritizedFix {
  priority: 'P1' | 'P2' | 'P3';
  check: string;
  action: string;
}

export interface CompetitorItem {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchQueryAnalysisItem {
  query: string;
  type: 'BRANDED' | 'NON_BRANDED';
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  source: string;
  rationale: string;
  isRanked: boolean;
  rankPosition: number | null;
  snippet: string | null;
  title: string | null;
  qualityNote: string;
  intentMatchFitsPage: boolean;
}

export interface Top3FixSummary {
  title: string;
  impact: string;
  action: string;
  priority: 'P1' | 'P2' | 'P3';
}

export interface VisibilityBridgeItem {
  dimension: 'Content Extraction & Indexing' | 'Title & Search Snippet' | 'Heading Hierarchy & RAG Chunks' | 'Topic Depth & Competitor Gaps';
  observation: string;
  searchImpact: string;
  verifiedDataPoint: string;
}

export interface TechnicalDetails {
  statusCode: number;
  finalUrl: string;
  redirectChain: string[];
  hopCount: number;
  isHttps: boolean;
  mixedContentFound: string[];
  sitemap: {
    status: 'FOUND' | 'NOT_FOUND' | 'ERROR';
    sitemapUrl: string | null;
    totalUrlsFound: number;
    isAuditedUrlPresent: boolean;
    sampledUrls: Array<{ url: string; status: number }>;
    note: string;
  };
  hreflang: {
    tags: Array<{ lang: string; href: string; isSelfRef: boolean }>;
    hasSelfRef: boolean;
    isValid: boolean;
  };
  viewport: {
    hasViewport: boolean;
    content: string | null;
  };
  canonical: {
    declared: boolean;
    url: string | null;
    isSelfReferencing: boolean;
  };
  metaRobots: {
    declared: boolean;
    content: string | null;
    isNoindex: boolean;
    isNofollow: boolean;
  };
  openGraph: {
    hasOgTitle: boolean;
    hasOgDescription: boolean;
    hasOgImage: boolean;
    hasTwitterCard: boolean;
  };
  serverIndicators: {
    ttfbMs: number;
    htmlByteSize: number;
    disclaimer: string;
  };
}

export interface OnPageDetails {
  headingHierarchy: {
    skips: string[];
    duplicates: string[];
    emptiesCount: number;
  };
  imageAudit: {
    total: number;
    withAltCount: number;
    altPercentage: number;
    missingAltSample: string[];
    modernFormatCount: number;
    lazyLoadedCount: number;
    missingDimensionsCount: number;
  };
  linksAudit: {
    totalPageLinks: number;
    anchorSectionLinksCount: number;
    uniqueTargetsCount: number;
    genericAnchorCount: number;
    genericAnchorsSample: string[];
    sampledLinkHealth: Array<{ url: string; status: number }>;
  };
  externalLinks: {
    total: number;
    nofollowCount: number;
    sponsoredCount: number;
    ugcCount: number;
    noopenerCount: number;
  };
  onPageSections: {
    hasFaqSection: boolean;
    hasContactSection: boolean;
    hasPricingSection: boolean;
    hasDownloadSection: boolean;
    hasFeaturesSection: boolean;
    authorMentionText: string | null;
  };
  serpSnippetPreview: {
    titlePreview: string;
    descriptionPreview: string;
    isTitleTruncated: boolean;
    isDescriptionTruncated: boolean;
    titlePixelWidthEst: number;
  };
}

export interface ContentEeatDetails {
  freshness: {
    dateModified: string | null;
    datePublished: string | null;
    lastModifiedHeader: string | null;
    visibleDates: string[];
  };
  eeatSignals: {
    author: { found: boolean; value: string | null; source: 'SCHEMA' | 'META' | 'TEXT_MENTION' | 'NONE' };
    aboutPage: { found: boolean; url: string | null; isSection: boolean };
    contactPage: { found: boolean; url: string | null; isSection: boolean };
    privacyPolicy: { found: boolean; url: string | null; isSection: boolean };
    reviewRating: { found: boolean; details: string | null };
  };
  ymylAnalysis: {
    isYmyl: boolean;
    category: string | null;
    triggerKeywords: string[];
    weightBoostExplanation: string | null;
  };
}

export interface LocalSeoDetails {
  isLocalDetected: boolean;
  businessType?: string;
  schemaAddress?: string;
  visibleAddress?: string;
  addressConsistent?: boolean;
  schemaPhone?: string;
  visiblePhone?: string;
  phoneConsistent?: boolean;
  googleMapsLink?: string | null;
}

export interface AiGeoDetails {
  faqStructureFound: boolean;
  questionHeadingsCount: number;
  directAnswerCapsulesCount: number;
  citationMetadataPresent: boolean;
  metadataDiff: {
    isTitleDiff: boolean;
    rawTitle: string | null;
    fetchTitle: string | null;
    isDescDiff: boolean;
    rawDesc: string | null;
    fetchDesc: string | null;
    isH1Diff: boolean;
    rawH1: string | null;
    fetchH1: string | null;
    notes: string;
  };
}

export interface KeywordCannibalizationItem {
  query: string;
  competingUrls: string[];
  isCannibalized: boolean;
  note: string;
}

export interface OutOfScopeTerm {
  term: string;
  definition: string;
  whyItMatters: string;
  recommendedTools: string;
}

export interface ComprehensiveAuditReport {
  timestamp: string;
  targetUrl: string;
  finalUrl: string;
  redirectChain: string[];
  targetQuery: string;
  pageType: PageTypeClassification;
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summarySentence: string;
  top3FixesToday: Top3FixSummary[];
  stats: {
    passed: number;
    warnings: number;
    failed: number;
    checksCount: number;
    fixesCount: number;
    searchCalls: number;
    fetchCalls: number;
  };
  categoryScores: {
    technicalSeo: number;
    onPageSeo: number;
    contentEeat: number;
    localSeo?: number;
    aiGeoReadiness: number;
    searchVisibility: number;
  };
  technicalDetails: TechnicalDetails;
  onPageDetails: OnPageDetails;
  contentEeatDetails: ContentEeatDetails;
  localSeoDetails?: LocalSeoDetails;
  aiGeoDetails: AiGeoDetails;
  ownStoreListing?: {
    platform: string;
    url: string;
    title: string;
  } | null;
  cannibalizationAnalysis: KeywordCannibalizationItem[];
  outOfScopePanels: OutOfScopeTerm[];
  dataConsistency: {
    rawHtmlHeadingsCount: number;
    fetchMarkdownHeadingsCount: number;
    headingsDiffNote: string;
    rawUniqueTokens: number;
    fetchUniqueTokens: number;
    jsDependencyPercentage: number;
    jsonLdBlocksCount: number;
    jsonLdUniqueTypes: string[];
  };
  searchVisibilityTable: SearchQueryAnalysisItem[];
  visibilityBridge: VisibilityBridgeItem[];
  competitorGap: {
    missingMultiWordTopics: string[];
    missingHeadingConcepts: string[];
    competitorsAnalyzed: Array<{
      url: string;
      title: string;
      rank: number;
      headings: string[];
      keyTopics: string[];
      snippetQuality: string;
    }>;
    note?: string;
  };
  agentInteraction?: {
    endpointUsed: boolean;
    completed: boolean;
    notes: string;
    runUrl?: string;
    revealedFaqCount?: number;
    revealedTextSample?: string;
    durationMs: number;
  } | null;
  prioritizedFixes: PrioritizedFix[];
  detailedChecks: DetailedCheck[];
  actionableFixes: ActionableFixes;
  evidence: {
    raw_html: {
      status: number;
      bytes: number;
      error: string | null;
      redirect_chain: string[];
    };
    fetch: {
      url: string;
      final_url: string;
      title: string | null;
      description: string | null;
      language: string;
      latency_ms: number;
      text_chars: number;
      format: string;
    };
    robots_txt: {
      status: number;
      snippet: string | null;
      blockedAiCrawlers: string[];
      sitemapsListed: string[];
    };
    llms_txt: {
      status: number;
      bytes: number;
      firstLine: string | null;
    };
    search_queries_run: number;
    primary_query: string;
    primary_search_results: CompetitorItem[];
  };
}

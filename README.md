# 🐟 TinyFish SEO & AI-Readability Page Auditor

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7.svg?style=flat&logo=render)](https://tiny-fish-seo-page-auditor.onrender.com/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Open%20Source-181717.svg?style=flat&logo=github)](https://github.com/yuvraj707sharma/Tiny-Fish-SEO-page-auditor)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![TinyFish API](https://img.shields.io/badge/Powered%20By-TinyFish%20APIs-ff6600.svg)](https://tinyfish.ai/)

> **A professional-grade, live, and actionable SEO & AI-readability auditor for any URL.**  
> 🌐 **Live Demo:** [https://tiny-fish-seo-page-auditor.onrender.com/](https://tiny-fish-seo-page-auditor.onrender.com/)  
> 💻 **GitHub Repository:** [https://github.com/yuvraj707sharma/Tiny-Fish-SEO-page-auditor](https://github.com/yuvraj707sharma/Tiny-Fish-SEO-page-auditor)  
> Powered by **TinyFish Fetch**, **TinyFish Search**, and **TinyFish Agent** (real browser automation).  
> Designed for modern search engines (Google, Bing) and LLM search answer engines (SearchGPT, Perplexity, Gemini, Claude).

---

## 🤖 AI Search & Generative Engine Optimization (GEO) Infrastructure

This project is architected for maximum discoverability and citation accuracy across modern AI answer engines:

- **`/llms.txt` & `/llms-full.txt`**: Standardized Markdown summaries following the [llmstxt.org](https://llmstxt.org) standard, allowing autonomous AI agents to ingest capabilities with zero token overhead.
- **AI-Permissive `/robots.txt`**: Dedicated crawler policies granting full access to `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `Amazonbot`, `Cohere-ai`, and `CCBot`.
- **Schema.org Knowledge Graph**: Rich JSON-LD structured data embedding `WebSite`, `SoftwareApplication`, `Organization`, and an interactive `FAQPage` answering common search queries.
- **XML Sitemap (`/sitemap.xml`)**: Automated indexing of main application pages, health diagnostics, and LLM text endpoints.

---

## 🌟 How TinyFish Endpoints Are Used in This Auditor

```
                       ┌─────────────────────────┐
                       │   Target URL / Domain   │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   TinyFish Fetch    │  │   TinyFish Search   │  │   TinyFish Agent    │
│ (JS Render & Diff)  │  │ (Live SERP & Gaps)  │  │(Browser Automation) │
└──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘
           │                        │                        │
           │ • JS dependency %      │ • Live brand & non-    │ • Expands accordions
           │ • SSR consistency diff │   branded rankings     │ • Extracts hidden QA
           │ • Competitor page text │ • Topical content gaps │ • Diff vs static DOM
           └────────────────────────┼────────────────────────┘
                                    │
                                    ▼
                   ┌─────────────────────────────────┐
                   │  Master Auditor Engine & Report │
                   │ (17 Checks · Top 3 · Fix Gen)   │
                   └─────────────────────────────────┘
```

1. **TinyFish Fetch (`fetch content get`)**:
   - **SSR Consistency & JS-Dependency**: Compares server-side raw HTML tokens with headless JS-rendered markdown to detect client-side rendering penalties for AI crawlers.
   - **Metadata Reconciliation**: Flags mismatches in `<title>`, `<meta description>`, and `<h1>` caused by client-side hydration.
   - **Competitor Content Fetching**: Deep-scrapes top non-social organic competitors in parallel to extract missing multi-word topical keywords.

2. **TinyFish Search (`search query`)**:
   - **Contextual Query Derivation**: Automatically generates high-intent branded and non-branded queries disambiguated by page type and institution context.
   - **Live Ranking & Intent Match**: Tests real search visibility across informational, commercial, and navigational intents.
   - **Own-Property Asset Discovery**: Isolates app store listings (Google Play Store / Apple App Store) from competitor gaps.

3. **TinyFish Agent (`agent run`)**:
   - **Live Dynamic Element Traversal**: Executes real browser automation steps to interact with collapsed FAQ accordions, pricing tables, and dynamic tab panels.
   - **Delta Reporting**: Reports only new dynamic content that static DOM parsers and basic fetchers missed.
   - **Zero Noise / Conditional Display**: Automatically hides if the page has no interactive collapsed states.

---

## 📋 17 Professional Audit Checks Across 6 Categories

| Category | Standard SEO Term | What It Audits & Enforces |
| :--- | :--- | :--- |
| **Technical SEO** | `Status Code & Redirect Chain` | Verifies HTTP 200, hop count, and full redirect chain. |
| **Technical SEO** | `Canonical Link Tag` | Validates `<link rel="canonical">` and self-referencing consistency. |
| **Technical SEO** | `Meta Robots Indexability` | Enforces no accidental `noindex` or `nofollow` directives. |
| **Technical SEO** | `Open Graph & Twitter Cards` | Audits `og:title`, `og:description`, `og:image`, and `twitter:card`. |
| **Technical SEO** | `HTTPS & Mixed Content` | Verifies encrypted transport and flags insecure asset requests. |
| **Technical SEO** | `XML Sitemap` | Follows `<sitemapindex>` child trees, samples URL status, and caps at 500+. |
| **Technical SEO** | `Mobile Viewport Meta` | Checks mobile-friendly viewport and hreflang regional tags. |
| **On-page SEO** | `Heading Hierarchy (H1-H6)` | Validates single primary `<h1>` with clean inline spacing and hierarchy. |
| **On-page SEO** | `Title & Meta Description` | Enforces standard SERP pixel lengths (Title: 15-65 chars; Desc: 70-160 chars). |
| **On-page SEO** | `Title Intent Alignment & Rewrite` | Compares keywords to derived search intent; provides rewritten title <60 chars. |
| **On-page SEO** | `Image Alt Text & Formats` | Separates missing `alt` attributes (penalized) from decorative `alt=""` (valid). |
| **On-page SEO** | `Internal Links & Section Anchors`| Differentiates on-page jump anchors (`#features`) from page links. |
| **Content & E-E-A-T** | `E-E-A-T & Trust Signals` | Audits About Us, Contact, Privacy Policy, and author bylines (capped if 2+ missing). |
| **Content & E-E-A-T** | `Content Substance & Word Count` | Detects thin content (<300 words) vs rich topical substance. |
| **AI & GEO Readiness** | `Server-Side Rendering (SSR)` | Measures static token accessibility for LLM crawlers without JS engines. |
| **AI & GEO Readiness** | `AI Crawler Policy (robots.txt)` | Audits access for `GPTBot`, `ClaudeBot`, `PerplexityBot`, and `Google-Extended`. |
| **AI & GEO Readiness** | `Schema.org Structured Data` | Validates JSON-LD (`MobileApplication`, `CollegeOrUniversity`, `Organization`). |
| **AI & GEO Readiness** | `/llms.txt AI Content Map` | Validates `/llms.txt` existence, byte size, and internal documentation shortcuts. |
| **Search Visibility** | `Search Rankings & Intent Fit` | Measures live rank position across auto-derived multi-intent queries. |
| **Search Visibility** | `Competitor Content Gap` | Deep-compares semantic topic coverage against top ranking search competitors. |
| **Local SEO** *(Conditional)* | `Local NAP & Maps Verification` | Validates Name, Address, Phone, and Google Maps links for local entities. |

---

## 🛠️ Page Archetype Classification & Zero-Hallucination Fixes

The auditor automatically detects page archetypes and tailors recommendations:
- **App Landing Page**: Generates `MobileApplication` + `FAQPage` JSON-LD schema with real prices (e.g. `₹149`), Google Play download links, and actual FAQ pairs extracted from the DOM.
- **Educational Institution**: Generates `CollegeOrUniversity` schema with verified campus NAP, contact numbers, and social links.
- **SaaS Platform**: Recommends `SoftwareApplication` + `Organization` schema and checks for developer documentation and `/llms.txt`.
- **Blog / Editorial**: Generates `Article` / `NewsMediaOrganization` schema with author attribution and freshness metadata.

---

## 🚀 Quickstart

### Prerequisites
- **Node.js**: `v18.0.0` or higher (compatible with Node 20 and Node 22).
- **TinyFish API Key**: Free key from [TinyFish](https://tinyfish.ai/).

### 1. Clone & Install
```bash
git clone https://github.com/yuvraj707sharma/Tiny-Fish-SEO-page-auditor.git
cd Tiny-Fish-SEO-page-auditor
npm install
```

### 2. Environment Configuration
Create a `.env` file from the template:
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=3000
TINYFISH_API_KEY=your_tinyfish_api_key_here
```

### 3. Run the Web Dashboard
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 4. Run the CLI Auditor
Run an audit on any live URL directly in your terminal:
```bash
# General usage:
npm run cli -- <URL> [optional-search-query]

# Real live benchmarks:
npm run cli -- https://www.semrush.com/
npm run cli -- https://www.tinyfish.ai/
npm run cli -- https://webscraper.io/
npm run cli -- juhelp.in
npm run cli -- jecrcuniversity.edu.in
```

### 5. Run Deterministic Unit Tests
```bash
npm test
```

---

## 💻 Portability & Environment Compatibility

This project is built for **100% portability** across environments:
- **Zero OS-specific dependencies**: Pure TypeScript / Node.js ESM codebase tested on Windows, Linux (Ubuntu/Debian/Alpine), and macOS.
- **Serverless & Container Ready**: Express backend with static frontend and modular `AuditorEngine` that can run standalone, inside Docker containers, or in CI/CD pipelines.
- **Graceful Degradation & Safe Networking**: Built-in SSRF protection, private IP blocking, 12-second abort timeouts, and safe error handling for offline or non-existent domains.

---

## 📊 Live Audit Benchmark Results

| Target URL | Archetype | Score / Grade | Headings | Schema Status | AI Robots Policy | Search Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`https://www.semrush.com/`** | SaaS / SEO Platform | **84 / 100 (B)** | `h1 x1, h2 x12, h3 x40` (53 total) | 1 block (`PostalAddress`) | Allowed (`/llms.txt` 14.9KB) | `4/5` Top 10 (#1 for *"Semrush"*) |
| **`https://www.tinyfish.ai/`** | Web Infra for AI Agents | **84 / 100 (B)** | `h1 x1, h2 x14, h3 x5` (20 total) | 2 blocks (`SoftwareApplication`, `FAQPage`) | Allowed (`/llms.txt` 37.6KB) | `3/5` Top 10 (#1 for *"Tinyfish"*) |
| **`https://webscraper.io/`** | SaaS / Scraping Platform| **90 / 100 (A)** | `h1 x1, h2 x17, h3 x26` (50 total) | 0 blocks (Fix generated) | Allowed (`/llms.txt` 924B) | `4/5` Top 10 (#1 for *"Web Scraper Cloud"*) |
| **`juhelp.in`** | App Landing Page | **78 / 100 (C)** | `h1 x1, h2 x11, h3 x4` (25 total) | Missing (Fix generated) | HTTP 404 (Allowed) | `#1` for *"Ju Help"* |
| **`jecrcuniversity.edu.in`** | Educational Institution | **78 / 100 (C)** | `h1 x4, h2 x28, h3 x7` (61 total) | 2 blocks (`CollegeOrUniversity`) | Allowed | `#1` for *"JECRC University"* |

---

## 📁 Repository Structure

```
Tiny-Fish-SEO-page-auditor/
├── public/                 # Responsive web dashboard frontend
│   ├── index.html          # Clean, modern UI with real-time audit tabs
│   ├── style.css           # TinyFish branding (Dark mode & Orange accents)
│   ├── app.js              # Live event handling, error banner & progress animation
│   └── Logo.svg            # Official TinyFish SVG logo
├── src/
│   ├── analyzers/          # Analysis engines
│   │   ├── cannibalizationChecker.ts # Domain keyword cannibalization
│   │   ├── competitorAnalyzer.ts     # Topic gap extraction & store asset filtering
│   │   ├── intentClassifier.ts       # Query intent categorization
│   │   ├── linkHealthChecker.ts      # Sampled internal link validation
│   │   ├── outOfScopeReference.ts    # Enterprise off-page reference guide
│   │   ├── queryDeriver.ts           # Contextual query disambiguation
│   │   └── visibilityBridge.ts       # Extraction-to-visibility impact bridge
│   ├── generators/
│   │   └── fixes.ts        # 100% page-derived JSON-LD, title, meta & robots generators
│   ├── parsers/
│   │   ├── htmlParser.ts   # Cheerio DOM parser with inline tag text spacing
│   │   ├── llmsParser.ts   # /llms.txt validator & link counter
│   │   ├── robotsParser.ts # Robots.txt AI crawler rules parser
│   │   └── sitemapParser.ts# XML sitemap index & recursive child parser
│   ├── services/
│   │   └── tinyfish.ts     # TinyFish Fetch, Search, and Agent API client
│   ├── utils/
│   │   └── security.ts     # SSRF protection & safe URL normalization
│   ├── cli.ts              # Full CLI entry point with colorized reports
│   ├── engine.ts           # Master auditor engine & category scoring logic
│   ├── server.ts           # Express API server for web dashboard
│   └── types.ts            # Comprehensive TypeScript type definitions
├── test/
│   ├── fixtures/           # Deterministic HTML, robots, and llms fixtures
│   └── parser.test.ts      # Comprehensive unit tests
├── .env.example            # Environment configuration template
├── .gitignore              # Git ignore rules
├── package.json            # Node.js project manifest & scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # Project documentation
```

---

## 🔭 Beyond a Single-URL Audit: Enterprise SEO Dimensions

While this tool delivers an exhaustive single-URL and competitor-backed audit, full enterprise search audits require multi-page domain crawlers and external backlink indices. Below is a reference of dimensions outside single-URL HTML scope:

- **Backlinks & Referring Domains**: Measure domain authority and link velocity via *Ahrefs* or *Semrush*.
- **Crawl Budget & Server Logs**: Analyze bot hit frequency across millions of URLs via *Screaming Frog Log Analyzer* or *Botify*.
- **Core Web Vitals Field Data (CrUX)**: Real-user 75th percentile loading performance (LCP, INP, CLS) from Chrome UX Report.
- **Search Console Performance**: Organic query impressions, CTR, and keyword ranking trajectory from Google Search Console.

---

## ⚖️ License

Distributed under the **MIT License**. See `LICENSE` for more information.

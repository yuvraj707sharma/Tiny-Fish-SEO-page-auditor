import { OutOfScopeTerm } from '../types.js';

export class OutOfScopeReference {
  static getTerms(): OutOfScopeTerm[] {
    return [
      {
        term: 'Backlinks & Referring Domains',
        definition: 'Total count and domain diversity of external hyperlinks pointing to the website.',
        whyItMatters: 'Backlinks represent external votes of trust and domain authority that cannot be measured from a single-page HTML audit.',
        recommendedTools: 'Ahrefs, Semrush, Moz Link Explorer, Google Search Console'
      },
      {
        term: 'Anchor Text Profile',
        definition: 'Distribution of visible clickable text strings used in external inbound backlinks.',
        whyItMatters: 'Over-optimized exact-match commercial anchors risk Google algorithmic link spam penalties.',
        recommendedTools: 'Ahrefs Site Explorer, Majestic SEO'
      },
      {
        term: 'Domain Authority / Domain Rating (DA / DR)',
        definition: 'Proprietary logarithmic 0-100 logarithmic domain-level strength scores.',
        whyItMatters: 'Measures sitewide ranking potential vs competitors based on aggregate backlink graphs.',
        recommendedTools: 'Moz Pro (DA), Ahrefs (DR), Semrush Authority Score'
      },
      {
        term: 'Toxic Links & Link Velocity',
        definition: 'Rate of new backlink acquisition and proportion of links from spam networks or penalized domains.',
        whyItMatters: 'Sudden spikes in low-quality links can trigger algorithmic demotions or manual link penalties.',
        recommendedTools: 'Semrush Backlink Audit, Google Disavow Tool'
      },
      {
        term: 'Crawl Budget & Server Log Analysis',
        definition: 'Frequency and volume of Googlebot / Bingbot hits across the entire domain.',
        whyItMatters: 'Large sites (>10k pages) require log analysis to prevent search bots from wasting crawl bandwidth on faceted filters or redirect loops.',
        recommendedTools: 'Screaming Frog Log File Analyzer, OnCrawl, Botify'
      },
      {
        term: 'Sitewide Orphan Pages',
        definition: 'Pages present on the server or in XML sitemaps that have 0 internal links pointing to them.',
        whyItMatters: 'Orphan pages lose PageRank flow and are rarely indexed or updated by search engines.',
        recommendedTools: 'Screaming Frog SEO Spider, Sitebulb'
      },
      {
        term: 'Core Web Vitals Field Data (CrUX)',
        definition: 'Real-user 75th percentile performance metrics (LCP, INP, CLS) collected over 28-day rolling periods.',
        whyItMatters: 'Field data represents actual Chrome user experience and is Google’s official ranking signal, unlike synthetic lab audits.',
        recommendedTools: 'Google PageSpeed Insights (CrUX), Chrome UX Report API'
      },
      {
        term: 'Search Console Clicks, Impressions & CTR',
        definition: 'Actual search engine query traffic, impressions, click-through rates, and average positions from Google.',
        whyItMatters: 'Direct first-party measurement of organic user behavior and ranking trajectory.',
        recommendedTools: 'Google Search Console, Bing Webmaster Tools'
      },
      {
        term: 'Manual Actions & Algorithmic Penalties',
        definition: 'Official Google security or quality actions applied against a domain by human reviewers.',
        whyItMatters: 'Cannot be inferred from HTML without direct access to verified Search Console security and manual action logs.',
        recommendedTools: 'Google Search Console Security & Manual Actions tab'
      }
    ];
  }
}

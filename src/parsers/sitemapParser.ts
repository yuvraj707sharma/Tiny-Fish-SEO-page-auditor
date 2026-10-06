export interface ParsedSitemapResult {
  status: 'FOUND' | 'NOT_FOUND' | 'ERROR';
  sitemapUrl: string | null;
  totalUrlsFound: number;
  totalUrlsDisplay: string;
  isCapped: boolean;
  isAuditedUrlPresent: boolean;
  sampledUrls: Array<{ url: string; status: number }>;
  note: string;
}

export class SitemapParser {
  private static MAX_URL_CAP = 500;

  /**
   * Fetches and parses an XML sitemap, recursively resolves sitemapindex child sitemaps,
   * verifies sample URLs, and checks for presence of the target URL.
   */
  static async auditSitemap(
    targetUrl: string,
    sitemapUrlCandidate?: string | null
  ): Promise<ParsedSitemapResult> {
    let targetObj: URL;
    try {
      targetObj = new URL(targetUrl);
    } catch {
      return {
        status: 'ERROR',
        sitemapUrl: null,
        totalUrlsFound: 0,
        totalUrlsDisplay: '0',
        isCapped: false,
        isAuditedUrlPresent: false,
        sampledUrls: [],
        note: 'Invalid target URL format for sitemap lookup.'
      };
    }

    const sitemapUrl = sitemapUrlCandidate || `${targetObj.origin}/sitemap.xml`;

    try {
      const resp = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; TinyFish-SEO-Auditor/1.0)'
        },
        signal: AbortSignal.timeout(7000)
      });

      if (!resp.ok) {
        return {
          status: 'NOT_FOUND',
          sitemapUrl,
          totalUrlsFound: 0,
          totalUrlsDisplay: '0',
          isCapped: false,
          isAuditedUrlPresent: false,
          sampledUrls: [],
          note: `Sitemap request returned HTTP ${resp.status}.`
        };
      }

      const xmlText = await resp.text();
      if (!xmlText.includes('<urlset') && !xmlText.includes('<sitemapindex') && !xmlText.includes('<loc>')) {
        return {
          status: 'NOT_FOUND',
          sitemapUrl,
          totalUrlsFound: 0,
          totalUrlsDisplay: '0',
          isCapped: false,
          isAuditedUrlPresent: false,
          sampledUrls: [],
          note: 'Response was not valid XML sitemap markup.'
        };
      }

      const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      const extractedUrls: string[] = [];
      const childSitemaps: string[] = [];
      let isCapped = false;

      // Check if it's a sitemap index
      const isSitemapIndex = xmlText.includes('<sitemapindex') || xmlText.includes('<sitemap>');

      let match;
      while ((match = locRegex.exec(xmlText)) !== null) {
        const u = match[1].trim();
        if (isSitemapIndex && (u.endsWith('.xml') || u.includes('sitemap'))) {
          childSitemaps.push(u);
        } else {
          extractedUrls.push(u);
          if (extractedUrls.length >= this.MAX_URL_CAP) {
            isCapped = true;
            break;
          }
        }
      }

      // If sitemap index, follow child sitemaps in parallel (up to 8 child sitemaps)
      if (childSitemaps.length > 0 && extractedUrls.length < this.MAX_URL_CAP) {
        const childrenToFetch = childSitemaps.slice(0, 8);
        const childResponses = await Promise.allSettled(
          childrenToFetch.map(cUrl =>
            fetch(cUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyFish-SEO-Auditor/1.0)' },
              signal: AbortSignal.timeout(5000)
            }).then(r => (r.ok ? r.text() : ''))
          )
        );

        for (const res of childResponses) {
          if (res.status === 'fulfilled' && res.value) {
            let childMatch;
            const childRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
            while ((childMatch = childRegex.exec(res.value)) !== null) {
              const u = childMatch[1].trim();
              if (!u.endsWith('.xml') && !extractedUrls.includes(u)) {
                extractedUrls.push(u);
                if (extractedUrls.length >= this.MAX_URL_CAP) {
                  isCapped = true;
                  break;
                }
              }
            }
          }
          if (extractedUrls.length >= this.MAX_URL_CAP) {
            isCapped = true;
            break;
          }
        }
      }

      const normalizedTarget = targetObj.href.replace(/\/$/, '').toLowerCase();
      const isAuditedUrlPresent = extractedUrls.some(u => u.replace(/\/$/, '').toLowerCase() === normalizedTarget);

      // Sample up to 5 URLs to check HTTP status
      const sampled = extractedUrls.slice(0, 5);
      const sampledResults: Array<{ url: string; status: number }> = [];

      await Promise.all(
        sampled.map(async u => {
          try {
            const r = await fetch(u, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TinyFish-SEO-Auditor/1.0)' },
              signal: AbortSignal.timeout(4000)
            });
            sampledResults.push({ url: u, status: r.status });
          } catch {
            sampledResults.push({ url: u, status: 0 });
          }
        })
      );

      const totalDisplay = isCapped ? `${this.MAX_URL_CAP}+ (capped)` : `${extractedUrls.length}`;

      return {
        status: 'FOUND',
        sitemapUrl,
        totalUrlsFound: extractedUrls.length,
        totalUrlsDisplay: totalDisplay,
        isCapped,
        isAuditedUrlPresent,
        sampledUrls: sampledResults,
        note: `Discovered ${totalDisplay} URLs in XML sitemap. ${isAuditedUrlPresent ? 'Audited URL is indexed.' : 'Audited URL was not in top sampled XML entries.'}`
      };
    } catch (err: any) {
      return {
        status: 'NOT_FOUND',
        sitemapUrl,
        totalUrlsFound: 0,
        totalUrlsDisplay: '0',
        isCapped: false,
        isAuditedUrlPresent: false,
        sampledUrls: [],
        note: `Could not fetch sitemap: ${err.message || 'connection timeout'}`
      };
    }
  }
}

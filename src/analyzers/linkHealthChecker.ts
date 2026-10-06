export interface SampledLinkHealth {
  url: string;
  status: number;
}

export class LinkHealthChecker {
  /**
   * Samples up to 10 internal URLs and performs fast HEAD requests to detect 200, 301/302 redirects, or 404 broken links
   */
  static async checkSampledLinks(
    internalPaths: string[],
    baseUrl: string
  ): Promise<SampledLinkHealth[]> {
    let baseObj: URL;
    try {
      baseObj = new URL(baseUrl);
    } catch {
      return [];
    }

    const uniquePaths = Array.from(new Set(internalPaths)).slice(0, 10);
    const results: SampledLinkHealth[] = [];

    await Promise.all(
      uniquePaths.map(async path => {
        let fullUrl: string;
        try {
          fullUrl = new URL(path, baseObj.origin).href;
        } catch {
          return;
        }

        try {
          const resp = await fetch(fullUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; TinyFish-SEO-Auditor/1.0)'
            },
            signal: AbortSignal.timeout(4000),
            redirect: 'manual'
          });
          results.push({ url: path, status: resp.status });
        } catch {
          results.push({ url: path, status: 0 });
        }
      })
    );

    return results;
  }
}

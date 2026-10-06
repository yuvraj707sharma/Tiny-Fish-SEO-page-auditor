import { TinyFishService } from '../services/tinyfish.js';
import { KeywordCannibalizationItem } from '../types.js';

export class CannibalizationChecker {
  /**
   * Checks whether multiple URLs from the same domain are ranking/competing for the same target query
   */
  static async checkCannibalization(
    domain: string,
    primaryTopic: string,
    tinyfish: TinyFishService
  ): Promise<KeywordCannibalizationItem> {
    const siteQuery = `site:${domain} "${primaryTopic}"`;
    try {
      const searchResult = await tinyfish.searchWithTinyFish(siteQuery);
      const ownUrls = (searchResult.results || [])
        .map(r => r.url)
        .filter(u => u.includes(domain));

      const isCannibalized = ownUrls.length > 1;
      return {
        query: primaryTopic,
        competingUrls: ownUrls.slice(0, 4),
        isCannibalized,
        note: isCannibalized
          ? `Found ${ownUrls.length} internal pages competing for "${primaryTopic}". Consider consolidating keyword targeting or setting clear canonicals.`
          : `Single authoritative internal page ranking for "${primaryTopic}". No internal cannibalization detected.`
      };
    } catch {
      return {
        query: primaryTopic,
        competingUrls: [],
        isCannibalized: false,
        note: 'Could not perform site-specific cannibalization check.'
      };
    }
  }
}

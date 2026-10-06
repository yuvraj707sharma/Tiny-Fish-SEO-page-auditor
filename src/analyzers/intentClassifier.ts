export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

export interface IntentClassificationResult {
  query: string;
  intent: SearchIntent;
  fitsPage: boolean;
  rationale: string;
}

export class IntentClassifier {
  /**
   * Classifies search query intent and checks alignment with page type
   */
  static classify(query: string, queryType: 'BRANDED' | 'NON_BRANDED', pageType: 'HOMEPAGE' | 'ARTICLE' | 'PRODUCT' | 'LANDING'): IntentClassificationResult {
    const qLower = query.toLowerCase();

    let intent: SearchIntent = 'Informational';
    let rationale = '';

    if (queryType === 'BRANDED') {
      intent = 'Navigational';
      rationale = 'Branded or site name search intent targeting official portal navigation.';
    } else if (/\b(buy|price|pricing|order|purchase|apply|admission|enroll|sign up|register|download|hire)\b/i.test(qLower)) {
      intent = 'Transactional';
      rationale = 'Contains action-oriented intent verbs seeking direct conversion or enrollment.';
    } else if (/\b(best|top|vs|compare|comparison|review|reviews|rated|alternative|ranking)\b/i.test(qLower)) {
      intent = 'Commercial';
      rationale = 'Commercial investigation intent comparing programs, features, or vendor options.';
    } else {
      intent = 'Informational';
      rationale = 'Informational inquiry seeking topical knowledge, requirements, or educational details.';
    }

    let fitsPage = true;
    if (pageType === 'HOMEPAGE' || pageType === 'LANDING') {
      // Homepages handle Navigational, Commercial, and high-level Informational well
      fitsPage = true;
    } else if (pageType === 'ARTICLE') {
      fitsPage = intent === 'Informational' || intent === 'Commercial';
    } else if (pageType === 'PRODUCT') {
      fitsPage = intent === 'Transactional' || intent === 'Commercial';
    }

    return {
      query,
      intent,
      fitsPage,
      rationale
    };
  }
}

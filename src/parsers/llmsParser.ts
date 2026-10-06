export interface LlmsTxtLink {
  title: string;
  url: string;
  isOnDomain: boolean;
  status: 'VALID' | 'EXTERNAL' | 'INVALID_URL';
}

export interface ParsedLlmsResult {
  status: number;
  found: boolean;
  bytes: number;
  firstLine: string | null;
  hasH1Header: boolean;
  hasSummaryBlockquote: boolean;
  linksCount: number;
  links: LlmsTxtLink[];
  brokenLinks: string[];
  issues: string[];
}

export class LlmsParser {
  static parse(content: string | null, statusCode: number, baseUrl: string): ParsedLlmsResult {
    if (!content || statusCode !== 200) {
      return {
        status: statusCode,
        found: false,
        bytes: 0,
        firstLine: null,
        hasH1Header: false,
        hasSummaryBlockquote: false,
        linksCount: 0,
        links: [],
        brokenLinks: [],
        issues: ['/llms.txt not found (HTTP 404). AI models lack a direct markdown content map.']
      };
    }

    const bytes = Buffer.byteLength(content, 'utf-8');
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim() || null;
    const hasH1Header = lines.some(l => /^#\s+.+/.test(l.trim()));
    const hasSummaryBlockquote = lines.some(l => /^>\s+.+/.test(l.trim()));

    const issues: string[] = [];
    if (!hasH1Header) issues.push('Missing top-level # Title header in /llms.txt.');
    if (!hasSummaryBlockquote) issues.push('Missing brief summary blockquote (> Summary) for LLM system prompts.');

    // Extract markdown links [Title](url)
    const links: LlmsTxtLink[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    let parsedOrigin = '';
    try { parsedOrigin = new URL(baseUrl).origin; } catch {}

    while ((match = linkRegex.exec(content)) !== null) {
      const linkTitle = match[1].trim();
      const rawUrl = match[2].trim();

      let isOnDomain = false;
      let status: LlmsTxtLink['status'] = 'VALID';

      try {
        const parsed = new URL(rawUrl, baseUrl);
        isOnDomain = parsed.origin === parsedOrigin;
        if (!isOnDomain) status = 'EXTERNAL';
      } catch {
        status = 'INVALID_URL';
        issues.push(`Malformed URL detected in /llms.txt: "${rawUrl}"`);
      }

      links.push({
        title: linkTitle,
        url: rawUrl,
        isOnDomain,
        status
      });
    }

    if (links.length === 0) {
      issues.push('/llms.txt contains no markdown links to internal pages.');
    }

    return {
      status: statusCode,
      found: true,
      bytes,
      firstLine,
      hasH1Header,
      hasSummaryBlockquote,
      linksCount: links.length,
      links,
      brokenLinks: [],
      issues
    };
  }
}

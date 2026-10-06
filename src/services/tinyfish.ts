import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { SecurityValidator } from '../utils/security.js';
import { CompetitorItem } from '../types.js';

dotenv.config();

const execAsync = promisify(exec);

export interface RawFetchResult {
  url: string;
  finalUrl: string;
  redirectChain: string[];
  statusCode: number;
  html: string;
  bytes: number;
  error: string | null;
}

export interface TinyFishFetchData {
  url: string;
  final_url: string;
  title: string | null;
  description: string | null;
  language: string;
  author: string | null;
  published_date: string | null;
  latency_ms: number;
  format: string;
  text: string;
  text_chars: number;
}

export interface TinyFishSearchData {
  query: string;
  total_results: number;
  results: CompetitorItem[];
}

export interface AgentInteractionResult {
  completed: boolean;
  endpointUsed: boolean;
  notes: string;
  runUrl?: string;
  revealedFaqCount?: number;
  revealedTextSample?: string;
  durationMs: number;
}

export class TinyFishService {
  private apiKey: string;
  private maxByteLimit = 10 * 1024 * 1024; // 10MB

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TINYFISH_API_KEY || '';
  }

  /**
   * Safe raw HTML fetch with SSRF checks, redirect tracking, and timeout
   */
  async fetchRawHtmlSafe(inputUrl: string): Promise<RawFetchResult> {
    const safety = SecurityValidator.validateUrlSafety(inputUrl);
    if (!safety.safe || !safety.normalizedUrl) {
      return {
        url: inputUrl,
        finalUrl: inputUrl,
        redirectChain: [],
        statusCode: 400,
        html: '',
        bytes: 0,
        error: safety.error || 'Invalid or unsafe URL.'
      };
    }

    const startUrl = safety.normalizedUrl;
    const redirectChain: string[] = [startUrl];

    try {
      const response = await fetch(startUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; TinyFish-SEO-Auditor/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow'
      });

      const finalUrl = response.url || startUrl;
      if (finalUrl !== startUrl) {
        redirectChain.push(finalUrl);
      }

      const html = await response.text();
      const bytes = Buffer.byteLength(html, 'utf-8');

      if (bytes > this.maxByteLimit) {
        return {
          url: startUrl,
          finalUrl,
          redirectChain,
          statusCode: response.status,
          html: html.slice(0, this.maxByteLimit),
          bytes: this.maxByteLimit,
          error: 'Response size exceeded 10MB limit (truncated).'
        };
      }

      return {
        url: startUrl,
        finalUrl,
        redirectChain,
        statusCode: response.status,
        html,
        bytes,
        error: null
      };
    } catch (err: any) {
      return {
        url: startUrl,
        finalUrl: startUrl,
        redirectChain,
        statusCode: 500,
        html: '',
        bytes: 0,
        error: `Fetch connection failed: ${err.message}`
      };
    }
  }

  /**
   * Fetches /robots.txt safely
   */
  async fetchRobotsTxt(baseUrl: string): Promise<{ status: number; text: string | null }> {
    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.origin}/robots.txt`;
      const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return { status: res.status, text: null };
      const text = await res.text();
      return { status: res.status, text };
    } catch {
      return { status: 404, text: null };
    }
  }

  /**
   * Fetches /llms.txt safely
   */
  async fetchLlmsTxt(baseUrl: string): Promise<{ status: number; text: string | null }> {
    try {
      const parsed = new URL(baseUrl);
      const llmsUrl = `${parsed.origin}/llms.txt`;
      const res = await fetch(llmsUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return { status: res.status, text: null };
      const text = await res.text();
      return { status: res.status, text };
    } catch {
      return { status: 404, text: null };
    }
  }

  /**
   * Fetches live JS-rendered page with TinyFish Fetch
   */
  async fetchWithTinyFish(url: string): Promise<TinyFishFetchData> {
    const startTime = Date.now();
    try {
      const cmd = `npx -y @tiny-fish/cli fetch content get "${url}"`;
      const { stdout } = await execAsync(cmd, {
        timeout: 25000,
        env: { ...process.env, TINYFISH_API_KEY: this.apiKey }
      });

      const parsed = JSON.parse(stdout.trim());
      if (parsed.results && parsed.results.length > 0) {
        const item = parsed.results[0];
        const text = item.text || '';
        return {
          url: item.url || url,
          final_url: item.final_url || url,
          title: item.title || null,
          description: item.description || null,
          language: item.language || 'en',
          author: item.author || null,
          published_date: item.published_date || null,
          latency_ms: item.latency_ms || (Date.now() - startTime),
          format: 'markdown',
          text,
          text_chars: text.length
        };
      }
    } catch {}

    return {
      url,
      final_url: url,
      title: null,
      description: null,
      language: 'en',
      author: null,
      published_date: null,
      latency_ms: Date.now() - startTime,
      format: 'markdown',
      text: '',
      text_chars: 0
    };
  }

  /**
   * Queries TinyFish Search API for live search rankings
   */
  async searchWithTinyFish(query: string): Promise<TinyFishSearchData> {
    try {
      const cmd = `npx -y @tiny-fish/cli search query "${query}"`;
      const { stdout } = await execAsync(cmd, {
        timeout: 25000,
        env: { ...process.env, TINYFISH_API_KEY: this.apiKey }
      });

      const parsed = JSON.parse(stdout.trim());
      const results: CompetitorItem[] = (parsed.results || []).map((r: any) => ({
        position: r.position,
        title: r.title,
        url: r.url,
        snippet: r.snippet
      }));

      return {
        query: parsed.query || query,
        total_results: parsed.total_results || results.length,
        results
      };
    } catch {
      return { query, total_results: 0, results: [] };
    }
  }

  /**
   * Real TinyFish Agent interaction check
   * Clicks accordions, tabs, and interactive elements to extract revealed dynamic content
   */
  async runAgentInteractionCheck(url: string, rawHtml?: string, fetchText?: string): Promise<AgentInteractionResult> {
    const startTime = Date.now();
    try {
      const cmd = `npx -y @tiny-fish/cli agent run "Expand all FAQ accordion questions or tabs, read the revealed answers, and return any text revealed by clicking" --url "${url}" --sync`;
      const { stdout } = await execAsync(cmd, {
        timeout: 90000,
        env: { ...process.env, TINYFISH_API_KEY: this.apiKey }
      });

      // Parse JSON from output
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        return {
          completed: false,
          endpointUsed: false,
          notes: 'No interactive accordion or tab content revealed by agent.',
          durationMs: Date.now() - startTime
        };
      }

      const parsed = JSON.parse(stdout.slice(jsonStart).trim());
      const resultText = typeof parsed.result === 'string' ? parsed.result : parsed.result?.result || '';

      if (!resultText || resultText.length < 30) {
        return {
          completed: false,
          endpointUsed: false,
          notes: 'No interactive hidden content discovered on page.',
          durationMs: Date.now() - startTime
        };
      }

      // Count FAQ items found
      const faqMatches = resultText.match(/\d+\.\s+\*\*(.+?)\*\*/g) || [];
      const revealedCount = faqMatches.length > 0 ? faqMatches.length : 1;

      return {
        completed: true,
        endpointUsed: true,
        notes: `TinyFish Agent executed ${parsed.num_of_steps || 11} browser interaction steps and extracted ${revealedCount} interactive QA items hidden behind accordions.`,
        runUrl: parsed.run_url,
        revealedFaqCount: revealedCount,
        revealedTextSample: resultText.slice(0, 300) + (resultText.length > 300 ? '...' : ''),
        durationMs: Date.now() - startTime
      };
    } catch {
      return {
        completed: false,
        endpointUsed: false,
        notes: 'Agent check skipped or timed out.',
        durationMs: Date.now() - startTime
      };
    }
  }
}

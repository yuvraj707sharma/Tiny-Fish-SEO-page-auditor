export interface RobotsBotStatus {
  botName: string;
  isBlocked: boolean;
  ruleMatched?: string;
}

export interface ParsedRobotsResult {
  status: number;
  found: boolean;
  snippet: string | null;
  blockedAiCrawlers: string[];
  allowedAiCrawlers: string[];
  botStatuses: RobotsBotStatus[];
  hasSitemap: boolean;
  sitemaps: string[];
}

export class RobotsParser {
  private static AI_BOTS = [
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'CCBot',
    'PerplexityBot',
    'Bytespider',
    'Applebot-Extended',
    'Amazonbot',
    'Cohere-ai',
    'Meta-ExternalAgent'
  ];

  static parse(robotsContent: string | null, statusCode: number, targetPath: string = '/'): ParsedRobotsResult {
    if (!robotsContent || statusCode !== 200) {
      return {
        status: statusCode,
        found: false,
        snippet: null,
        blockedAiCrawlers: [],
        allowedAiCrawlers: this.AI_BOTS,
        botStatuses: this.AI_BOTS.map(bot => ({ botName: bot, isBlocked: false })),
        hasSitemap: false,
        sitemaps: []
      };
    }

    const lines = robotsContent.split('\n').map(l => l.trim());
    const sitemaps: string[] = [];

    // Parse blocks by user-agent
    type RuleGroup = { agents: string[]; disallows: string[]; allows: string[] };
    const groups: RuleGroup[] = [];
    let currentGroup: RuleGroup | null = null;

    for (const rawLine of lines) {
      // Remove comments
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const directive = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (directive === 'sitemap') {
        if (value) sitemaps.push(value);
      } else if (directive === 'user-agent') {
        if (!currentGroup || (currentGroup.disallows.length > 0 || currentGroup.allows.length > 0)) {
          currentGroup = { agents: [value], disallows: [], allows: [] };
          groups.push(currentGroup);
        } else {
          currentGroup.agents.push(value);
        }
      } else if (directive === 'disallow') {
        if (currentGroup) currentGroup.disallows.push(value);
      } else if (directive === 'allow') {
        if (currentGroup) currentGroup.allows.push(value);
      }
    }

    const blockedAiCrawlers: string[] = [];
    const allowedAiCrawlers: string[] = [];
    const botStatuses: RobotsBotStatus[] = [];

    for (const bot of this.AI_BOTS) {
      const isBlocked = this.isPathBlockedForBot(bot, targetPath, groups);
      botStatuses.push({ botName: bot, isBlocked });
      if (isBlocked) {
        blockedAiCrawlers.push(bot);
      } else {
        allowedAiCrawlers.push(bot);
      }
    }

    return {
      status: statusCode,
      found: true,
      snippet: robotsContent.slice(0, 600),
      blockedAiCrawlers,
      allowedAiCrawlers,
      botStatuses,
      hasSitemap: sitemaps.length > 0,
      sitemaps
    };
  }

  private static isPathBlockedForBot(botName: string, path: string, groups: Array<{ agents: string[]; disallows: string[]; allows: string[] }>): boolean {
    const normBot = botName.toLowerCase();

    // 1. Look for specific bot group
    const specificGroup = groups.find(g => g.agents.some(a => a.toLowerCase() === normBot || a.toLowerCase() === normBot + '*'));
    if (specificGroup) {
      return this.checkGroupRules(specificGroup.disallows, specificGroup.allows, path);
    }

    // 2. Fall back to wildcard * group
    const wildcardGroup = groups.find(g => g.agents.some(a => a === '*'));
    if (wildcardGroup) {
      return this.checkGroupRules(wildcardGroup.disallows, wildcardGroup.allows, path);
    }

    return false;
  }

  private static checkGroupRules(disallows: string[], allows: string[], path: string): boolean {
    // If empty disallow: `Disallow:` means allow all
    const activeDisallows = disallows.filter(d => d.trim().length > 0);
    if (activeDisallows.length === 0) return false;

    // Check specific allows first
    for (const allow of allows) {
      if (allow === '/' || (allow && path.startsWith(allow))) {
        return false;
      }
    }

    // Check disallows
    for (const disallow of activeDisallows) {
      if (disallow === '/' || path.startsWith(disallow)) {
        return true;
      }
    }

    return false;
  }
}

import { URL } from 'url';
import net from 'net';

export class SecurityValidator {
  /**
   * Validates if a URL is safe against SSRF attacks.
   * Rejects localhost, loopback, private IPv4/IPv6 networks, cloud metadata endpoints, and non-http(s) schemes.
   */
  static validateUrlSafety(inputUrl: string): { safe: boolean; error?: string; normalizedUrl?: string } {
    let raw = inputUrl.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = 'https://' + raw;
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return { safe: false, error: 'Invalid URL format.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Only http and https protocols are supported.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost or invalid hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { safe: false, error: 'Access to localhost and internal hostnames is blocked for security.' };
    }

    // IP validation for private ranges
    if (net.isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        return { safe: false, error: 'Access to private network IP addresses is blocked for security.' };
      }
    }

    // AWS / GCP / Azure metadata endpoint block
    if (hostname === '169.254.169.254') {
      return { safe: false, error: 'Access to cloud instance metadata services is blocked.' };
    }

    return { safe: true, normalizedUrl: parsed.toString() };
  }

  private static isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 127.0.0.0/8
      if (parts[0] === 127) return true;
      // 169.254.0.0/16 (link local)
      if (parts[0] === 169 && parts[1] === 254) return true;
      // 0.0.0.0
      if (parts[0] === 0) return true;
    } else if (net.isIPv6(ip)) {
      if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
        return true;
      }
    }
    return false;
  }
}

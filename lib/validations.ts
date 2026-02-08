import { z } from "zod";
import { ScanProfile } from "@prisma/client";

// SSRF prevention - block private IPs, localhost, etc.
function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variations
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("127.") ||
      hostname === "[::1]" ||
      hostname === "[::]"
    ) {
      return false;
    }

    // Block private IP ranges
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipRegex);
    if (match) {
      const [, a, b, c, d] = match.map(Number);
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
      if (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
      ) {
        return false;
      }
    }

    // Block internal/local TLDs
    if (
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const scanSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(isValidPublicUrl, "URL must be a public website (localhost and private IPs not allowed)"),
  profile: z.nativeEnum(ScanProfile),
});

export const workspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

export const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export const shareLinkSchema = z.object({
  scanId: z.string(),
  password: z.string().min(6).optional(),
});

export const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  reportTitle: z.string().max(100).optional(),
});

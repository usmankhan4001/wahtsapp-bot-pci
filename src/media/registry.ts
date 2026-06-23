// Per-project media library: brochure, floor/layout plans, images, location.
// Files live on the public media host (Cloudflare R2) — WAHA sends them by URL.
//
// This module scans the R2 bucket on startup to discover available media
// automatically. No JSON files, no manual registry — just upload to R2 and
// the bot will find it.
import { config } from "../config.js";
import { logger } from "../logger.js";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const r2Client = config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey
  ? new S3Client({
      region: "auto",
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    })
  : null;

export interface ProjectMedia {
  /** Canonical project name (should match the Bitrix project name when possible). */
  name: string;
  /** URL-safe folder slug under the media host. */
  slug: string;
  /** Alternative names/abbreviations customers or the AI might use. */
  aliases: string[];
  brochure?: string; // relative path to the brochure PDF
  paymentPlan?: string; // relative path to the payment-plan PDF
  floorPlans: { label: string; path: string }[]; // layout/floor plan files
  images: string[]; // unit/project images
  /** A Google Maps URL or a plain location string. */
  location?: string;
}

// ── Known project metadata (aliases + locations) ────────────────
// Slugs MUST match the R2 folder names. The scanner will fill in
// brochure/paymentPlan/floorPlans from whatever files it finds.
const PROJECT_META: Omit<ProjectMedia, "brochure" | "paymentPlan" | "floorPlans" | "images">[] = [
  {
    name: "Box Park-3",
    slug: "box-park-3",
    aliases: ["box park 3", "bp3", "boxpark3", "bo park 3", "bopark3", "boxpark-3", "box park three", "box park iii"],
    location: "https://maps.app.goo.gl/boxpark3pci",
  },
  {
    name: "Buraq Heights",
    slug: "buraq-heights",
    aliases: ["buraq", "buraq height", "bh", "buraqheights"],
    location: "https://maps.app.goo.gl/buraqheightspci",
  },
  {
    name: "Grand Orchard",
    slug: "grand-orchard",
    aliases: ["grand orchard", "go", "grandorchard", "orchard"],
    location: "https://maps.app.goo.gl/grandorchardpci",
  },
  {
    name: "River Courtyard Tower-1",
    slug: "river-courtyard-1",
    aliases: ["river courtyard", "rct", "rct1", "river courtyard 1", "river courtyard tower 1", "rivercourtyard"],
    location: "https://maps.app.goo.gl/rivercourtyardpci",
  },
  {
    name: "Grand Gallery",
    slug: "grand-gallery",
    aliases: ["grand gallery", "gg", "grandgallery"],
  },
  {
    name: "Roman Grove-1",
    slug: "roman-grove-1",
    aliases: ["roman grove", "rg", "roman grove 1", "romangrove"],
  },
  {
    name: "Spring Arch",
    slug: "spring-arch",
    aliases: ["spring arch", "springarch", "sa"],
  },
  {
    name: "River Hills-5",
    slug: "river-hills-5",
    aliases: ["river hills 5", "rh5", "riverhills5"],
  },
  {
    name: "Gateway By Premier Choice",
    slug: "gateway",
    aliases: ["gateway", "gateway dubai", "gateway pci"],
  },
  {
    name: "Southlofts 1",
    slug: "southlofts-1",
    aliases: ["south lofts", "southlofts", "south loft 1"],
  },
  {
    name: "Barari Views",
    slug: "barari-views",
    aliases: ["barari", "barari views"],
  },
];

// ── Live media data (populated by scanR2Bucket or manually) ─────
export let MEDIA: ProjectMedia[] = [];

const abs = (p?: string): string | undefined =>
  p ? `${config.mediaBaseUrl}/${p.replace(/^\/+/, "")}` : undefined;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── R2 Bucket Scanner ───────────────────────────────────────────
// Uses the public R2 URL to list known project folders and probe for files.
// This avoids needing S3 credentials — we just HEAD-check known paths.

/** File patterns to look for in each project folder. */
const PROBE_FILES = [
  { key: "brochure", patterns: ["brochure.pdf"] },
  { key: "paymentPlan", patterns: ["payment-plan.pdf", "payment_plan.pdf", "paymentplan.pdf"] },
  { key: "floorPlans", patterns: ["floor-plans.pdf", "floor_plans.pdf", "floorplans.pdf", "layout.pdf", "layouts.pdf"] },
  { key: "flyer", patterns: ["flyer.pdf"] },
];

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method: "HEAD", signal: controller.signal });
      return res.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

/**
 * Scan the R2 bucket by probing known project slug + file patterns.
 * This is the "live sync" — if you upload a brochure.pdf to a project
 * folder on R2, the bot will find it on the next scan (every 10 min).
 */
export async function scanR2Bucket(): Promise<void> {
  logger.info("Scanning R2 bucket for media...");
  const results: ProjectMedia[] = [];

  let r2Objects: string[] | null = null;
  if (r2Client && config.r2.bucketName) {
    try {
      const keys: string[] = [];
      let isTruncated = true;
      let continuationToken: string | undefined = undefined;

      while (isTruncated) {
        const command: any = new ListObjectsV2Command({
          Bucket: config.r2.bucketName,
          ContinuationToken: continuationToken,
        });
        const response: any = await r2Client.send(command);
        if (response.Contents) {
          keys.push(...response.Contents.map((o: any) => o.Key).filter((k: any): k is string => !!k));
        }
        isTruncated = response.IsTruncated ?? false;
        continuationToken = response.NextContinuationToken;
      }
      r2Objects = keys;
      logger.info(`R2 list objects successful: found ${keys.length} items.`);
    } catch (e) {
      logger.error("Failed to list R2 objects using S3 client, falling back to HTTP probe.", e);
    }
  }

  for (const meta of PROJECT_META) {
    const project: ProjectMedia = {
      ...meta,
      brochure: undefined,
      paymentPlan: undefined,
      floorPlans: [],
      images: [],
    };

    if (r2Objects) {
      const prefix = `${meta.slug}/`;
      const projectKeys = r2Objects.filter(k => k.startsWith(prefix));

      for (const probe of PROBE_FILES) {
        for (const pattern of probe.patterns) {
          const expectedKey = `${meta.slug}/${pattern}`;
          const foundKey = projectKeys.find(k => k.toLowerCase() === expectedKey.toLowerCase());
          if (foundKey) {
            if (probe.key === "brochure") project.brochure = foundKey;
            else if (probe.key === "paymentPlan") project.paymentPlan = foundKey;
            else if (probe.key === "floorPlans") {
              project.floorPlans.push({ label: pattern.replace(/\.pdf$/i, "").replace(/[-_]/g, " "), path: foundKey });
            } else if (probe.key === "flyer") {
              project.images.push(foundKey);
            }
            break;
          }
        }
      }

      for (const key of projectKeys) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg") || lowerKey.endsWith(".png")) {
          if (!project.images.includes(key)) {
            project.images.push(key);
          }
        }
      }
    } else {
      const baseUrl = `${config.mediaBaseUrl}/${meta.slug}`;
      for (const probe of PROBE_FILES) {
        for (const pattern of probe.patterns) {
          const url = `${baseUrl}/${pattern}`;
          const exists = await probeUrl(url);
          if (exists) {
            const relativePath = `${meta.slug}/${pattern}`;
            if (probe.key === "brochure") project.brochure = relativePath;
            else if (probe.key === "paymentPlan") project.paymentPlan = relativePath;
            else if (probe.key === "floorPlans") {
              project.floorPlans.push({ label: pattern.replace(/\.pdf$/i, "").replace(/[-_]/g, " "), path: relativePath });
            } else if (probe.key === "flyer") {
              project.images.push(relativePath);
            }
            break;
          }
        }
      }
    }

    results.push(project);
    const hasMedia = project.brochure || project.paymentPlan || project.floorPlans.length > 0 || project.images.length > 0;
    if (hasMedia) {
      logger.info(`  ${meta.name}: brochure=${!!project.brochure} paymentPlan=${!!project.paymentPlan} floorPlans=${project.floorPlans.length} images=${project.images.length}`);
    }
  }

  MEDIA = results;
  logger.info(`R2 scan complete: ${results.filter(r => r.brochure || r.paymentPlan || r.floorPlans.length > 0 || r.images.length > 0).length}/${results.length} projects have media.`);
}

// ── Background refresh ──────────────────────────────────────────
let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startMediaRefresh(intervalMs = 10 * 60 * 1000): void {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    scanR2Bucket().catch((e) => logger.error("R2 media refresh failed", e));
  }, intervalMs);
}

// ── Lookup functions (unchanged API) ────────────────────────────

/** Resolve a project name (fuzzy) to its media entry. */
export function findProjectMedia(nameOrSlug: string): ProjectMedia | undefined {
  const q = norm(nameOrSlug);
  if (!q) return undefined;
  const keys = (m: ProjectMedia) => [m.slug, m.name, ...m.aliases].map(norm);
  return (
    MEDIA.find((m) => keys(m).some((k) => k === q)) ??
    MEDIA.find((m) => keys(m).some((k) => k.includes(q) || q.includes(k)))
  );
}

/** Absolute brochure URL for a project, if configured. */
export function brochureUrl(name: string): string | undefined {
  return abs(findProjectMedia(name)?.brochure);
}

/** Absolute payment-plan PDF URL for a project, if configured. */
export function paymentPlanUrl(name: string): string | undefined {
  return abs(findProjectMedia(name)?.paymentPlan);
}

/** Absolute floor-plan URLs (with labels) for a project. */
export function floorPlanUrls(name: string): { label: string; url: string }[] {
  const m = findProjectMedia(name);
  return (m?.floorPlans ?? []).map((f) => ({ label: f.label, url: abs(f.path)! }));
}

/** Absolute image URLs for a project. */
export function imageUrls(name: string): string[] {
  const m = findProjectMedia(name);
  return (m?.images ?? []).map((p) => abs(p)!).filter(Boolean);
}

export function locationOf(name: string): string | undefined {
  return findProjectMedia(name)?.location;
}

/** Names of all projects we have media for (for "which projects?" answers). */
export function projectsWithMedia(): string[] {
  return MEDIA.filter((m) => m.brochure || m.paymentPlan || m.floorPlans.length > 0).map((m) => m.name);
}

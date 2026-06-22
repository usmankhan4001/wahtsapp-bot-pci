// Per-project media library: brochure, floor/layout plans, images, location.
// Files live on the public media host (Cloudflare R2) — WAHA sends them by URL.
//
// Edit MEDIA below as you add projects/files. Paths are relative to the media
// base URL (config.mediaBaseUrl), e.g. "box-park-3/brochure.pdf" resolves to
// https://media.premierchoiceint.online/box-park-3/brochure.pdf
import { config } from "../config.js";

export interface ProjectMedia {
  /** Canonical project name (should match the Bitrix project name when possible). */
  name: string;
  /** URL-safe folder slug under the media host. */
  slug: string;
  brochure?: string; // relative path to the brochure PDF
  floorPlans?: { label: string; path: string }[]; // layout/floor plan images
  images?: string[]; // unit/project images
  /** A Google Maps URL or a plain location string. */
  location?: string;
}

// ── EDIT THIS as files are uploaded to R2 ──────────────────────────
// (Empty paths are fine — tools will say "not available yet" gracefully.)
export const MEDIA: ProjectMedia[] = [
  // Example (fill real paths once uploaded):
  // {
  //   name: "Box Park-3",
  //   slug: "box-park-3",
  //   brochure: "box-park-3/brochure.pdf",
  //   floorPlans: [{ label: "Ground Floor", path: "box-park-3/floor-plans/ground.jpg" }],
  //   images: ["box-park-3/images/front.jpg"],
  //   location: "https://maps.google.com/?q=DHA+Phase+...",
  // },
];

const abs = (p?: string): string | undefined =>
  p ? `${config.mediaBaseUrl}/${p.replace(/^\/+/, "")}` : undefined;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Resolve a project name (fuzzy) to its media entry. */
export function findProjectMedia(nameOrSlug: string): ProjectMedia | undefined {
  const q = norm(nameOrSlug);
  if (!q) return undefined;
  return (
    MEDIA.find((m) => norm(m.slug) === q || norm(m.name) === q) ??
    MEDIA.find((m) => norm(m.name).includes(q) || q.includes(norm(m.slug)))
  );
}

/** Absolute brochure URL for a project, if configured. */
export function brochureUrl(name: string): string | undefined {
  return abs(findProjectMedia(name)?.brochure);
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
  return MEDIA.map((m) => m.name);
}

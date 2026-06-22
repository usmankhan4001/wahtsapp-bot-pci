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
  /** Alternative names/abbreviations customers or the AI might use. */
  aliases?: string[];
  brochure?: string; // relative path to the brochure PDF
  paymentPlan?: string; // relative path to the payment-plan PDF
  floorPlans?: { label: string; path: string }[]; // layout/floor plan files
  images?: string[]; // unit/project images
  /** A Google Maps URL or a plain location string. */
  location?: string;
}

// ── EDIT THIS as files are uploaded to R2 ──────────────────────────
// (Empty paths are fine — tools will say "not available yet" gracefully.)
export const MEDIA: ProjectMedia[] = [
  {
    name: "Box Park-3",
    slug: "box-park-3",
    aliases: ["box park 3", "bp3", "box park three", "boxpark3"],
    brochure: "box-park-3/brochure.pdf",
    paymentPlan: "box-park-3/payment-plan.pdf",
  },
  {
    name: "Buraq Heights",
    slug: "buraq-heights",
    aliases: ["buraq", "buraq height", "buraqheights"],
    brochure: "buraq-heights/brochure.pdf",
    floorPlans: [{ label: "Layouts", path: "buraq-heights/floor-plans.pdf" }],
  },
  {
    name: "Grand Orchard",
    slug: "grand-orchard",
    aliases: ["orchard", "dha orchard", "grandorchard"],
    brochure: "grand-orchard/brochure.pdf",
    paymentPlan: "grand-orchard/payment-plan.pdf",
    floorPlans: Array.from({ length: 23 }, (_, i) => ({
      label: `Layout Page ${i + 1}`,
      path: `grand-orchard/layouts/page-${(i + 1).toString().padStart(2, "0")}.pdf`
    })),
  },
  {
    name: "River Courtyard Tower-1",
    slug: "river-courtyard-1",
    aliases: ["river courtyard", "river courtyard 1", "rcy1", "rcy", "river courtyard tower 1"],
    brochure: "river-courtyard-1/brochure.pdf",
    floorPlans: [{ label: "Layouts", path: "river-courtyard-1/floor-plans.pdf" }],
    paymentPlan: "river-courtyard-1/payment-plan.pdf",
  },
];

const abs = (p?: string): string | undefined =>
  p ? `${config.mediaBaseUrl}/${p.replace(/^\/+/, "")}` : undefined;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Resolve a project name (fuzzy) to its media entry. */
export function findProjectMedia(nameOrSlug: string): ProjectMedia | undefined {
  const q = norm(nameOrSlug);
  if (!q) return undefined;
  const keys = (m: ProjectMedia) => [m.slug, m.name, ...(m.aliases ?? [])].map(norm);
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
  return MEDIA.map((m) => m.name);
}

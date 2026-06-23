// Per-project media library: brochure, floor/layout plans, images, location.
// Files live on the public media host (Cloudflare R2) — WAHA sends them by URL.
//
// Edit MEDIA below as you add projects/files. Paths are relative to the media
// base URL (config.mediaBaseUrl), e.g. "box-park-3/brochure.pdf" resolves to
// https://media.premierchoiceint.online/box-park-3/brochure.pdf
import { config } from "../config.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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

const REGISTRY_FILE = "data/registry.json";

export let MEDIA: ProjectMedia[] = [];

export function loadRegistry() {
  const SEED_FILE = "seed-registry.json";
  
  let needsSeed = !existsSync(REGISTRY_FILE);
  if (existsSync(REGISTRY_FILE)) {
    try {
      const content = readFileSync(REGISTRY_FILE, "utf-8").trim();
      if (content === "[]" || content === "{}" || content === "") {
        needsSeed = true;
      }
    } catch (e) {}
  }

  if (needsSeed && existsSync(SEED_FILE)) {
    try {
      require("node:fs").mkdirSync("data", { recursive: true });
      require("node:fs").copyFileSync(SEED_FILE, REGISTRY_FILE);
    } catch (e) {
      console.error("Failed to seed registry.json", e);
    }
  }

  if (existsSync(REGISTRY_FILE)) {
    try {
      MEDIA = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
    } catch (e) {
      console.error("Failed to parse registry.json", e);
    }
  }
}

export function saveRegistry() {
  writeFileSync(REGISTRY_FILE, JSON.stringify(MEDIA, null, 2));
}

loadRegistry();

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

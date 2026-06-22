// Per-project branding assets (logos + hero image), mirroring the calculator's
// generatePDF.js. Keys are matched loosely against the Bitrix project name.
import { config } from "../config.js";

export interface ProjectAsset {
  logoUrl: string;
  imageUrl: string;
}

const base = config.mediaBaseUrl + "/assets";

export const COMPANY_LOGO = `${base}/pci-logo.png`;
export const COMPANY_LOGO_WHITE = `${base}/pci-logo-white.png`;

/** Full-page sales-offer cover used only for Box Park-3. */
export const BOXPARK3_COVER = `${base}/boxpark3-sales-offer.jpg`;

/** True if a project should use the special Box Park-3 layout. */
export function isBoxPark3(projectName?: string): boolean {
  return /box\s*park[-\s]*3|box\s*park[-\s]*iii/i.test(projectName ?? "");
}

const ASSETS: Record<string, ProjectAsset> = {
  "river courtyard": {
    logoUrl: `${base}/river-courtyard-logo.png`,
    imageUrl: `${base}/river-courtyard-small.png`,
  },
  "grand gallery": {
    logoUrl: `${base}/grand-gallery-logo.png`,
    imageUrl: `${base}/grand-gallery-small.png`,
  },
  "box park": {
    logoUrl: `${base}/box-park-logo.png`,
    imageUrl: `${base}/box-park-small.jpg`,
  },
  "roman grove": {
    logoUrl: `${base}/roman-grove-logo.png`,
    imageUrl: `${base}/roman-grove-small.jpg`,
  },
  "buraq heights": {
    logoUrl: `${base}/buraq-heights-logo.png`,
    imageUrl: `${base}/buraq-heights-small.png`,
  },
  "grand orchard": {
    logoUrl: `${base}/grand-orchard-logo.png`,
    imageUrl: `${base}/grand-orchard-small.jpg`,
  },
  "box park-3": {
    logoUrl: `${base}/box-park-3-logo.png`,
    imageUrl: `${base}/box-park-3-front.jpg`,
  },
};

const DEFAULT: ProjectAsset = {
  logoUrl: `${base}/grand-orchard-logo.png`,
  imageUrl: `${base}/grand-orchard-small.jpg`,
};

export function assetsFor(projectName?: string): ProjectAsset {
  if (!projectName) return DEFAULT;
  const q = projectName.toLowerCase();
  const key = Object.keys(ASSETS).find((k) => q.includes(k));
  return key ? ASSETS[key] : DEFAULT;
}

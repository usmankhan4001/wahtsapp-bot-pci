// Per-project branding assets (logos + hero image), mirroring the calculator's
// generatePDF.js. Keys are matched loosely against the Bitrix project name.
export interface ProjectAsset {
  logoUrl: string;
  imageUrl: string;
}

export const COMPANY_LOGO = "https://i.postimg.cc/50n359N3/pci-logo-01-01.png";
export const COMPANY_LOGO_WHITE = "https://i.postimg.cc/Y2mc6bX0/Logo-White.png";

/** Full-page sales-offer cover used only for Box Park-3. */
export const BOXPARK3_COVER =
  "https://i.postimg.cc/bYn99gjn/Sales-Offer-Box-Park-III-jpg.jpg";

/** True if a project should use the special Box Park-3 layout. */
export function isBoxPark3(projectName?: string): boolean {
  return /box\s*park[-\s]*3|box\s*park[-\s]*iii/i.test(projectName ?? "");
}

const ASSETS: Record<string, ProjectAsset> = {
  "river courtyard": {
    logoUrl: "https://i.postimg.cc/FHNNkXGY/River-Courtyard.png",
    imageUrl: "https://i.postimg.cc/nz0Qg1zw/river-Small.png",
  },
  "grand gallery": {
    logoUrl: "https://i.postimg.cc/QdhhKZS7/Grand-Gallery.png",
    imageUrl: "https://i.postimg.cc/4dBhq1dq/grand-gallery-Small.png",
  },
  "box park": {
    logoUrl: "https://i.postimg.cc/7ZwwJrXG/Box-Park.png",
    imageUrl: "https://i.postimg.cc/262BMx60/box-park-II-Small.jpg",
  },
  "roman grove": {
    logoUrl: "https://i.postimg.cc/jSttnYvW/Roman-Grove.png",
    imageUrl: "https://i.postimg.cc/NMprSxM4/roman-grove-1-Small.jpg",
  },
  "buraq heights": {
    logoUrl: "https://i.postimg.cc/vZbbxwXW/Buraq-Heights.png",
    imageUrl: "https://i.postimg.cc/C1mfX41P/buraq-height-Small.png",
  },
  "grand orchard": {
    logoUrl: "https://i.postimg.cc/SxkkYbV8/Grand-Orchard.png",
    imageUrl: "https://i.postimg.cc/50nFTm0P/DHA-Orchard-Night-Shot-01-Small.jpg",
  },
  "box park-3": {
    logoUrl: "https://i.postimg.cc/pVjJJCth/sales-offer-Box-Park-3-04.png",
    imageUrl: "https://i.postimg.cc/L4z2FdpS/Front-View.jpg",
  },
};

const DEFAULT: ProjectAsset = {
  logoUrl: "https://i.postimg.cc/SxkkYbV8/Grand-Orchard.png",
  imageUrl: "https://i.postimg.cc/50nFTm0P/DHA-Orchard-Night-Shot-01-Small.jpg",
};

export function assetsFor(projectName?: string): ProjectAsset {
  if (!projectName) return DEFAULT;
  const q = projectName.toLowerCase();
  const key = Object.keys(ASSETS).find((k) => q.includes(k));
  return key ? ASSETS[key] : DEFAULT;
}

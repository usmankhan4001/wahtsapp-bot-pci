import * as fs from "fs";
import * as path from "path";

export interface ProjectAsset {
  logoPath: string;
  imagePath: string;
}

const INVENTORY_DIR = path.resolve("E:/Apps/PCI Whatsapp Bot/Inventory");
const LOGO_DIR = path.join(INVENTORY_DIR, "logos");
const PROJECT_DIR = path.join(INVENTORY_DIR, "projects");

export const COMPANY_LOGO = path.join(LOGO_DIR, "pci-logo.png");
export const COMPANY_LOGO_WHITE = path.join(LOGO_DIR, "pci-logo-white.png");

const ASSETS: Record<string, ProjectAsset> = {
  "river courtyard": {
    logoPath: path.join(LOGO_DIR, "river-courtyard-logo.png"),
    imagePath: path.join(PROJECT_DIR, "river.png"),
  },
  "grand gallery": {
    logoPath: path.join(LOGO_DIR, "grand-gallery-logo.png"),
    imagePath: path.join(PROJECT_DIR, "grand gallery.png"),
  },
  "box park": {
    logoPath: path.join(LOGO_DIR, "box-park-logo.png"),
    imagePath: path.join(PROJECT_DIR, "box park II.jpg"),
  },
  "roman grove": {
    logoPath: path.join(LOGO_DIR, "roman-grove-logo.png"),
    imagePath: path.join(PROJECT_DIR, "roman grove 1.jpg"),
  },
  "buraq height": {
    logoPath: path.join(LOGO_DIR, "buraq-heights-logo.png"),
    imagePath: path.join(PROJECT_DIR, "buraq height.png"),
  },
  "grand orchard": {
    logoPath: path.join(LOGO_DIR, "grand-orchard-logo.png"),
    imagePath: path.join(PROJECT_DIR, "DHA_Orchard_Night_Shot_01.jpg"),
  },
};

const DEFAULT: ProjectAsset = {
  logoPath: path.join(LOGO_DIR, "pci-logo.png"),
  imagePath: path.join(PROJECT_DIR, "box park II.jpg"),
};

export function assetsFor(projectName?: string): ProjectAsset {
  if (!projectName) return DEFAULT;
  const q = projectName.toLowerCase();
  const key = Object.keys(ASSETS).find((k) => q.includes(k));
  return key ? ASSETS[key] : DEFAULT;
}

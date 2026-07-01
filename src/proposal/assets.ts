import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In dist mode, __dirname is dist/proposal. Assets are in dist/assets.
// In dev mode, __dirname is src/proposal. Assets are in src/assets.
// Go up one level to reach src or dist.
const ASSETS_DIR = path.join(__dirname, "../assets");
const LOGO_DIR = path.join(ASSETS_DIR, "logos");
const PROJECT_DIR = path.join(ASSETS_DIR, "projects");
const COVER_DIR = path.join(ASSETS_DIR, "covers");

export interface ProjectAsset {
  logoPath: string;
  imagePath: string;
  coverPath: string | null;
}

// Ensure defaults don't break if PCI logo is missing (we don't have it in the new set yet)
export const COMPANY_LOGO = ""; 
export const COMPANY_LOGO_WHITE = "";

const ASSETS: Record<string, ProjectAsset> = {
  "river courtyard": {
    logoPath: path.join(LOGO_DIR, "River Courtyard.png"),
    imagePath: path.join(PROJECT_DIR, "river.png"),
    coverPath: path.join(COVER_DIR, "spa cover RCY copy.pdf"),
  },
  "grand gallery": {
    logoPath: path.join(LOGO_DIR, "Grand Gallery.png"),
    imagePath: path.join(PROJECT_DIR, "grand gallery.png"),
    coverPath: null,
  },
  "box park": {
    logoPath: path.join(LOGO_DIR, "Box Park.png"),
    imagePath: path.join(PROJECT_DIR, "box park II.jpg"),
    coverPath: path.join(COVER_DIR, "box park 3 spa copy.pdf"),
  },
  "roman grove": {
    logoPath: path.join(LOGO_DIR, "Roman Grove.png"),
    imagePath: path.join(PROJECT_DIR, "roman grove 1.jpg"),
    coverPath: null,
  },
  "buraq height": {
    logoPath: path.join(LOGO_DIR, "Buraq Heights.png"),
    imagePath: path.join(PROJECT_DIR, "buraq height.png"),
    coverPath: path.join(COVER_DIR, "buraq spa cover copy.pdf"),
  },
  "grand orchard": {
    logoPath: path.join(LOGO_DIR, "Grand Orchard.png"),
    imagePath: path.join(PROJECT_DIR, "DHA_Orchard_Night_Shot_01.jpg"),
    coverPath: path.join(COVER_DIR, "spa covers grand orchard.pdf"),
  },
  "river hills": {
    logoPath: "",
    imagePath: "",
    coverPath: path.join(COVER_DIR, "Rhs spa copy.pdf"),
  }
};

const DEFAULT: ProjectAsset = {
  logoPath: "",
  imagePath: "",
  coverPath: null,
};

export function assetsFor(projectName?: string): ProjectAsset {
  if (!projectName) return DEFAULT;
  const q = projectName.toLowerCase();
  const key = Object.keys(ASSETS).find((k) => q.includes(k));
  return key ? ASSETS[key] : DEFAULT;
}

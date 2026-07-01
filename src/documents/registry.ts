/**
 * Registry mapping project names to their Google Drive file IDs for PDF delivery.
 * To get the file ID, look at the Google Drive share link:
 * e.g., https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view
 * The ID is 1A2B3C4D5E6F7G8H9I0J.
 */
export const PROJECT_DOCUMENTS: Record<string, { brochure?: string; layout?: string }> = {
  "Box Park-2": {
    brochure: "REPLACE_WITH_FILE_ID_1",
    layout: "REPLACE_WITH_FILE_ID_2"
  },
  "Florence Galleria": {
    brochure: "REPLACE_WITH_FILE_ID_3",
    layout: "REPLACE_WITH_FILE_ID_4"
  }
  // Add other projects here
};

/**
 * Helper to extract a File ID from a full Google Drive URL if the user pastes the full URL
 */
export function extractDriveFileId(urlOrId: string): string {
  if (!urlOrId.includes("drive.google.com")) {
    return urlOrId; // Assume it's already an ID
  }
  const match = urlOrId.match(/\/d\/(.+?)\//);
  return match ? match[1] : urlOrId;
}

/**
 * Generate a direct download URL that WAHA can fetch.
 */
export function getDriveDownloadUrl(fileId: string): string {
  const cleanId = extractDriveFileId(fileId);
  return `https://drive.google.com/uc?export=download&id=${cleanId}`;
}

import { Router } from "express";
import { config } from "../config.js";
import multer from "multer";
import { ingestPdf } from "./ingest.js";
import { MEDIA } from "../media/registry.js";
import { logger } from "../logger.js";

export const adminRouter = Router();

// Basic Auth Middleware
adminRouter.use((req, res, next) => {
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");

  if (login && password === config.adminPassword) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="401"');
  res.status(401).send("Authentication required.");
});

// Serve the dashboard
adminRouter.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PCI Bot Media Dashboard</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; padding: 2rem; max-width: 800px; margin: 0 auto; }
        h1, h2 { color: #111827; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        form { display: flex; flex-direction: column; gap: 1rem; }
        input, select, button { padding: 0.5rem; font-size: 1rem; }
        button { background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .log { background: #1f2937; color: #10b981; padding: 1rem; border-radius: 4px; font-family: monospace; white-space: pre-wrap; display: none; }
      </style>
    </head>
    <body>
      <h1>PCI Bot Media Dashboard</h1>
      
      <div class="card">
        <h2>Upload New Brochure / Layout</h2>
        <form id="uploadForm">
          <label>Project:
            <select name="projectName" required>
              ${MEDIA.map((m) => `<option value="${m.name}">${m.name}</option>`).join("")}
            </select>
          </label>
          <label>File Type:
            <select name="fileType" required>
              <option value="brochure">Main Brochure</option>
              <option value="paymentPlan">Payment Plan</option>
              <option value="floorPlan">Floor Plan / Layout</option>
            </select>
          </label>
          <label id="floorPlanLabel" style="display:none;">Floor Plan Label (e.g. 'Page 1', 'Ground Floor'):
            <input type="text" name="floorLabel">
          </label>
          <label>PDF File:
            <input type="file" name="file" accept="application/pdf" required>
          </label>
          <button type="submit">Upload and Process RAG</button>
        </form>
        <div id="log" class="log"></div>
      </div>

      <script>
        document.querySelector('select[name="fileType"]').addEventListener('change', (e) => {
          document.getElementById('floorPlanLabel').style.display = e.target.value === 'floorPlan' ? 'block' : 'none';
        });

        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const log = document.getElementById('log');
          log.style.display = 'block';
          log.textContent = 'Uploading and processing (this may take a minute for large PDFs with OCR)...\\n';
          
          const formData = new FormData(e.target);
          try {
            const res = await fetch('/admin/api/upload', {
              method: 'POST',
              body: formData
            });
            const text = await res.text();
            log.textContent += (res.ok ? '\\n✅ SUCCESS:\\n' : '\\n❌ ERROR:\\n') + text;
          } catch (err) {
            log.textContent += '\\n❌ ERROR:\\n' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

const upload = multer({ dest: "data/uploads/" });

adminRouter.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { projectName, fileType, floorLabel } = req.body;

    if (!file || !projectName || !fileType) {
      return res.status(400).send("Missing required fields.");
    }

    // Process PDF: Extract text via Gemini File API, embed, save to vectors.json
    await ingestPdf(file.path, projectName, file.originalname);

    // TODO: Upload to Cloudflare R2 here
    // For now, we update registry pointing to local or R2 path.
    const project = MEDIA.find((m) => m.name === projectName);
    if (project) {
      const destPath = `${project.slug}/${fileType}-${Date.now()}.pdf`;
      
      // Update registry
      if (fileType === "brochure") project.brochure = destPath;
      if (fileType === "paymentPlan") project.paymentPlan = destPath;
      if (fileType === "floorPlan") {
        project.floorPlans ??= [];
        project.floorPlans.push({ label: floorLabel || "Layout", path: destPath });
      }
    }

    res.send(`Successfully processed and ingested ${file.originalname}.`);
  } catch (err) {
    logger.error("Upload failed", err);
    res.status(500).send(err instanceof Error ? err.message : "Unknown error");
  }
});

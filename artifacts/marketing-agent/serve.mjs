import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "dist/public");

const port = Number(process.env.PORT);
if (!port || Number.isNaN(port)) {
  throw new Error("PORT environment variable is required.");
}

const app = express();

app.disable("x-powered-by");

app.use(
  "/assets",
  express.static(path.join(distDir, "assets"), {
    immutable: true,
    maxAge: "1y",
    setHeaders(res) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
    },
  }),
);

app.use(
  express.static(distDir, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader(
          "Cache-Control",
          "no-cache, no-store, must-revalidate",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  }),
);

app.get(/.*/, (_req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-cache, no-store, must-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[marketing-agent] serving ${distDir} on :${port}`);
});

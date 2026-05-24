import { Router, type IRouter } from "express";
import { findPublicObject, streamPublicObject } from "../lib/objectStorage";

const router: IRouter = Router();

router.get("/storage/public-objects/*splat", async (req, res): Promise<void> => {
  const splat = req.params["splat"];
  const relativePath = (Array.isArray(splat) ? splat.join("/") : splat ?? "").replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..")) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }
  try {
    const file = await findPublicObject(relativePath);
    if (!file) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { body, contentType, size } = await streamPublicObject(file);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (size) res.setHeader("Content-Length", size);
    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    req.log.warn({ err }, "Public object stream error");
    if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    else res.end();
  }
});

export default router;

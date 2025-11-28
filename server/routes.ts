import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import luamin from "luamin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post('/beautify', (req, res) => {
    const code = req.body.code;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    res.status(501).json({ error: 'Beautify not available in luamin package - only minify is supported' });
  });

  app.post('/minify', (req, res) => {
    const code = req.body.code;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      res.json({ result: luamin.minify(code) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return httpServer;
}

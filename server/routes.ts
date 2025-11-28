import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import luaFormat from "lua-format";
import { analyzeVariableSemantics, applySemanticRenames } from "./variableAnalyzer";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post('/beautify', (req, res) => {
    const { code, options } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      const result = luaFormat.Beautify(code, {
        RenameVariables: options?.renameVariables ?? false,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
        Indentation: options?.useTabs ? '\t' : ' '.repeat(options?.indentSize ?? 2),
      });
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/minify', (req, res) => {
    const { code, options } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      const result = luaFormat.Minify(code, {
        RenameVariables: options?.renameVariables ?? true,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
      });

      // Apply smart semantic renaming if enabled
      let finalResult = result;
      if (options?.renameVariables && options?.smartRename) {
        const semantics = analyzeVariableSemantics(code);
        if (Object.keys(semantics).length > 0) {
          finalResult = applySemanticRenames(result, semantics);
        }
      }

      res.json({ result: finalResult });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return httpServer;
}

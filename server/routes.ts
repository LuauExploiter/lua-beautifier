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
      let processedCode = code;

      // Apply smart semantic renaming FIRST (before beautifying)
      if (options?.renameVariables && options?.smartRename) {
        try {
          const semantics = analyzeVariableSemantics(code);
          if (Object.keys(semantics).length > 0) {
            processedCode = applySemanticRenames(code, semantics);
          }
        } catch (semanticErr) {
          console.warn('Smart rename failed, using original code:', semanticErr);
        }
      }

      let result = luaFormat.Beautify(processedCode, {
        RenameVariables: (options?.renameVariables && !options?.smartRename) ?? false,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
        Indentation: options?.useTabs ? '\t' : ' '.repeat(options?.indentSize ?? 2),
      });

      // Apply post-processing options
      if (options?.removeBlankLines) {
        result = result.replace(/\n\s*\n/g, '\n');
      }
      if (options?.normalizeQuotes) {
        result = result.replace(/'/g, '"');
      }
      if (options?.sortTableFields) {
        result = sortTableFields(result);
      }

      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/minify', (req, res) => {
    const { code, options } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      let result = luaFormat.Minify(code, {
        RenameVariables: options?.renameVariables ?? true,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
      });

      // Apply smart semantic renaming if enabled
      if (options?.renameVariables && options?.smartRename) {
        const semantics = analyzeVariableSemantics(code);
        if (Object.keys(semantics).length > 0) {
          result = applySemanticRenames(result, semantics);
        }
      }

      // Apply post-processing optimizations
      if (options?.removeWhitespace) {
        result = result.replace(/\s+/g, ' ').trim();
      }
      if (options?.removeStrings) {
        result = result.replace(/"[^"]*"|'[^']*'/g, '""');
      }
      if (options?.removeComments) {
        result = result.replace(/--\[\[[\s\S]*?\]\]--|--[^\n]*/g, '');
      }
      if (options?.convertNumberFormats) {
        result = convertNumberFormats(result);
      }
      if (options?.compressStrings) {
        result = compressStrings(result);
      }

      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return httpServer;
}

function sortTableFields(code: string): string {
  return code.replace(/\{[\s\S]*?\}/g, (match) => {
    const fields = match.split(',').map((f) => f.trim()).sort();
    return '{ ' + fields.join(', ') + ' }';
  });
}

function convertNumberFormats(code: string): string {
  return code.replace(/(\d+)\.0+([^\d])/g, '$1$2');
}

function compressStrings(code: string): string {
  const stringMap: { [key: string]: string } = {};
  let stringCount = 0;

  let result = code.replace(/"[^"]*"|'[^']*'/g, (match) => {
    if (!stringMap[match]) {
      stringMap[match] = `s${stringCount++}`;
    }
    return stringMap[match];
  });

  return result;
}

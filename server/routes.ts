import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import luaFormat from "lua-format";
import { smartRename } from "./variableAnalyzer";

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
          processedCode = smartRename(code);
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
      let processedCode = code;

      // Apply smart semantic renaming FIRST if enabled
      if (options?.renameVariables && options?.smartRename) {
        try {
          processedCode = smartRename(code);
        } catch (semanticErr) {
          console.warn('Smart rename failed, using original code:', semanticErr);
        }
      }

      let result = luaFormat.Minify(processedCode, {
        RenameVariables: (options?.renameVariables && !options?.smartRename) ?? true,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
      });

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

  app.post('/api/detect-vars', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    try {
      const variables: Array<{ old: string; detected: string }> = [];
      const typeCounters: { [key: string]: number } = {};

      // Find all local variable assignments with their RHS
      const regex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?)(?:\n|;|$)/g;
      let m;
      while ((m = regex.exec(code)) !== null) {
        const varName = m[1];
        const rhs = m[2].trim();
        
        let semanticName = extractSemanticName(rhs);
        
        // Count duplicates and add suffix
        if (typeCounters[semanticName] !== undefined) {
          typeCounters[semanticName]++;
          const finalName = `${semanticName}${typeCounters[semanticName]}`;
          variables.push({ old: varName, detected: finalName });
        } else {
          typeCounters[semanticName] = 1;
          variables.push({ old: varName, detected: semanticName });
        }
      }

      // Also detect function definitions
      const funcRegex = /\blocal\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let fm;
      while ((fm = funcRegex.exec(code)) !== null) {
        const funcName = fm[1];
        if (typeCounters['Function'] !== undefined) {
          typeCounters['Function']++;
          variables.push({ old: funcName, detected: `Function${typeCounters['Function']}` });
        } else {
          typeCounters['Function'] = 1;
          variables.push({ old: funcName, detected: funcName });
        }
      }

      // Solve math expressions in the code
      let solvedCode = code;
      const mathRegex = /(\d+)\s*([+\-*/%])\s*(\d+)/g;
      solvedCode = solvedCode.replace(mathRegex, (match: string, a: string, op: string, b: string): string => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        let result;
        switch (op) {
          case '+': result = numA + numB; break;
          case '-': result = numA - numB; break;
          case '*': result = numA * numB; break;
          case '/': result = Math.floor(numA / numB); break;
          case '%': result = numA % numB; break;
          default: return match;
        }
        return String(result);
      });

      res.json({ variables, solvedCode });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Helper to extract semantic name from RHS
  function extractSemanticName(rhs: string): string {
    // Handle game:GetService("Players") → Players
    const getServiceMatch = rhs.match(/GetService\s*\(\s*["']([^"']+)["']\s*\)/);
    if (getServiceMatch) {
      return getServiceMatch[1];
    }

    // Handle Instance.new("Type", Parent) or Instance.new("Type") → Type
    // This takes the first argument (the type), not parent
    const instanceNewMatch = rhs.match(/Instance\.new\s*\(\s*["']([^"']+)["']/);
    if (instanceNewMatch) {
      return instanceNewMatch[1];
    }

    // Handle game.Players → Players
    const gamePlayersMatch = rhs.match(/game\.([A-Za-z_]\w*)/);
    if (gamePlayersMatch) {
      return gamePlayersMatch[1];
    }

    // Handle LocalPlayer reference
    if (rhs.includes('LocalPlayer')) {
      return 'LocalPlayer';
    }

    // Handle workspace reference
    if (rhs.includes('workspace')) {
      return 'Workspace';
    }

    // Default to Var
    return 'Var';
  }

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

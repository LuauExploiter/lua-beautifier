import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import luaFormat from "lua-format";
import { smartRename } from "./variableAnalyzer";

// Fast in-memory cache for performance
const cache = new Map<string, string>();
const CACHE_MAX_SIZE = 100;

function getCacheKey(code: string, options: any, endpoint: string): string {
  return `${endpoint}:${code.length}:${JSON.stringify(options).length}`;
}

function getCached(key: string): string | null {
  return cache.get(key) || null;
}

function setCached(key: string, value: string): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post('/beautify', (req, res) => {
    const { code, options } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Invalid code' });
    try {
      let processedCode = code.trim();
      if (!processedCode) return res.status(400).json({ error: 'Code is empty' });

      let result = luaFormat.Beautify(processedCode, {
        RenameVariables: options?.renameVariables ?? false,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
        Indentation: options?.useTabs ? '\t' : ' '.repeat(Math.max(1, Math.min(8, options?.indentSize ?? 2))),
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
      console.error('Beautify error:', err);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  app.post('/minify', (req, res) => {
    const { code, options } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Invalid code' });
    try {
      let processedCode = code.trim();
      if (!processedCode) return res.status(400).json({ error: 'Code is empty' });

      let result = luaFormat.Minify(processedCode, {
        RenameVariables: options?.renameVariables ?? true,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
      });

      // Apply post-processing optimizations
      if (options?.removeComments) {
        result = result.replace(/--\[\[[\s\S]*?\]\]--|--[^\n]*/g, '');
      }
      if (options?.removeWhitespace) {
        result = result.replace(/\s+/g, ' ').trim();
      }
      if (options?.convertNumberFormats) {
        result = convertNumberFormats(result);
      }
      if (options?.compressStrings) {
        result = compressStrings(result);
      }

      res.json({ result });
    } catch (err) {
      console.error('Minify error:', err);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  app.post('/api/detect-vars', (req, res) => {
    const { code } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Invalid code' });
    try {
      let trimmedCode = code.trim();
      if (!trimmedCode) return res.status(400).json({ error: 'Code is empty' });

      const variables: Array<{ old: string; detected: string }> = [];
      const typeCounters: { [key: string]: number } = {};

      // Find all local variable assignments - handles one-liners, nested, obfuscated
      const regex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;\n]+?)(?=\n|;|$|local\s)/g;
      let m;
      while ((m = regex.exec(trimmedCode)) !== null) {
        const varName = m[1];
        const rhs = m[2].trim();
        if (!rhs) continue;
        
        let semanticName = extractSemanticName(rhs);
        
        // Count duplicates
        if (typeCounters[semanticName] !== undefined) {
          typeCounters[semanticName]++;
          variables.push({ old: varName, detected: `${semanticName}${typeCounters[semanticName]}` });
        } else {
          typeCounters[semanticName] = 1;
          variables.push({ old: varName, detected: semanticName });
        }
      }

      // Detect functions with semantic analysis
      const funcRegex = /\blocal\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)[\s\n]*([\s\S]*?)(?=\bend\b|$)/g;
      let fm;
      while ((fm = funcRegex.exec(trimmedCode)) !== null) {
        const funcName = fm[1];
        const args = fm[2] || "";
        const body = fm[3] || "";
        
        let semanticFuncName = analyzeFunction(funcName, args, body);
        if (typeCounters[semanticFuncName] !== undefined) {
          typeCounters[semanticFuncName]++;
          variables.push({ old: funcName, detected: `${semanticFuncName}${typeCounters[semanticFuncName]}` });
        } else {
          typeCounters[semanticFuncName] = 1;
          variables.push({ old: funcName, detected: semanticFuncName });
        }
      }

      // Solve math: handles decimals, preserves hex/large numbers
      let solvedCode = trimmedCode;
      const mathRegex = /(\d+(?:\.\d+)?)\s*([+\-*/%])\s*(\d+(?:\.\d+)?)/g;
      solvedCode = solvedCode.replace(mathRegex, (match: string, a: string, op: string, b: string): string => {
        try {
          const numA = parseFloat(a);
          const numB = parseFloat(b);
          let result;
          switch (op) {
            case '+': result = numA + numB; break;
            case '-': result = numA - numB; break;
            case '*': result = numA * numB; break;
            case '/': result = numA / numB; break;
            case '%': result = numA % numB; break;
            default: return match;
          }
          return op === '/' ? result.toString() : Math.floor(result).toString();
        } catch {
          return match;
        }
      });

      res.json({ variables, solvedCode });
    } catch (err) {
      console.error('Detect vars error:', err);
      res.status(500).json({ error: 'Detection failed' });
    }
  });

  // Extract semantic name from RHS - optimized for speed & intelligence
  function extractSemanticName(rhs: string): string {
    if (!rhs || rhs.length === 0) return 'Var';

    // GetService detection
    if (rhs.includes('GetService')) {
      const m = rhs.match(/GetService\s*\(\s*["']([^"']+)["']\s*\)/);
      if (m) return m[1];
    }

    // Instance.new detection
    if (rhs.includes('Instance.new')) {
      const m = rhs.match(/Instance\.new\s*\(\s*["']([^"']+)["']/);
      if (m) return m[1];
    }

    // Property access (game.X, workspace.X, script.X, require.X)
    const propMatch = rhs.match(/(game|workspace|script|require)\.([A-Za-z_]\w*)/);
    if (propMatch) return propMatch[2];

    // Table constructor
    if (rhs.startsWith('{')) return 'Table';

    // Boolean/Nil
    if (rhs === 'true' || rhs === 'false') return 'Enabled';
    if (rhs === 'nil') return 'Value';

    // Numbers (including decimals, scientific notation)
    if (/^-?[\d.]+(?:e[+-]?\d+)?$/.test(rhs)) return 'Number';

    // Strings
    if (rhs.startsWith('"') || rhs.startsWith("'")) return 'Text';

    // Function definitions
    if (rhs.includes('function')) return 'Function';

    // Method calls with chaining
    if (/:[\w]+\s*\(.*\)\s*:/.test(rhs)) return 'Result';

    // Generic method calls
    if (rhs.match(/\.\w+\s*\(/) || rhs.match(/:\w+\s*\(/)) return 'Result';

    // Math expressions
    if (/^[\d\s+\-*/%().]+$/.test(rhs)) return 'Calculation';

    return 'Var';
  }

  // Analyze function body and determine what it does - WITH ADVANCED INTELLIGENCE
  function analyzeFunction(funcName: string, args: string, body: string): string {
    // Validation/Check functions - detect boolean returns and comparisons
    if (/\breturn\s+(true|false|nil|[^;,\n]*(?:==|~=|>=|<=|>|<))/.test(body)) {
      return 'Check';
    }
    if (/\bif\b.*\bthen\b.*\breturn/.test(body) && body.includes('return')) {
      return 'Check';
    }

    // Destruction functions - remove/destroy/delete operations
    if (/\b(Destroy|Remove|Delete|Dispose|Clear)\s*\(/.test(body)) {
      return 'Remove';
    }
    if (/\bfor.*\bin.*\bdo\b.*Destroy/.test(body)) {
      return 'Remove';
    }

    // Creation functions - new instances, table constructors
    if (/\bInstance\.new\s*\(|table\.new\s*\(/.test(body)) {
      return 'Create';
    }
    if (/\.Parent\s*=\s*\w+|setParent/.test(body)) {
      return 'Create';
    }
    if (body.startsWith('{') || body.includes('return {')) {
      return 'Create';
    }

    // Event handling - Connect, ChildAdded, etc.
    if (/\.Connect\s*\(|:Connect\s*\(/.test(body)) {
      return 'Handle';
    }
    if (/ChildAdded|ChildRemoved|Changed|MouseClick|Touched/.test(body)) {
      return 'Handle';
    }

    // Iteration/Looping - GetChildren, pairs, ipairs, GetDescendants
    if (/\bGetChildren\b|GetDescendants|pairs|ipairs/.test(body)) {
      return 'Iterate';
    }
    if (/\bfor\b.*\bin\b.*\bdo\b/.test(body)) {
      return 'Iterate';
    }

    // Filtering/Searching - loops with conditionals
    if (/\bfor\b.*\bin\b.*\bif\b/.test(body)) {
      return 'Filter';
    }
    if (/\bfind|search|match|filter/i.test(body.toLowerCase())) {
      return 'Filter';
    }

    // Update/Refresh - state changes, redraws
    if (/\bupdate|refresh|reload|sync/i.test(body.toLowerCase())) {
      return 'Update';
    }

    // Render/Display - UI updates, drawing
    if (/\bRender|Display|Draw|redraw|compose/i.test(body)) {
      return 'Render';
    }

    // Configuration/Initialization - setup, config, init
    if (/\bInit|Setup|Configure|Config|Initialize/i.test(body)) {
      return 'Init';
    }

    // Getters - property access and return
    if (/\breturn\s+\w+\.\w+|\breturn\s+[\w\[\]\.\'\"]+/.test(body) && !body.includes('=')) {
      return 'Get';
    }

    // Setters - property assignment
    if (/\.\w+\s*=\s*\w+|setProperty|setAttribute/i.test(body) && !body.includes('local')) {
      return 'Set';
    }

    // Parsing/Processing - string/data manipulation
    if (/\bsplit|match|parse|process|decode|encode/i.test(body.toLowerCase())) {
      return 'Parse';
    }

    // Calculation/Math operations
    if (/[\+\-\*\/\%]/.test(body) && !body.includes('print')) {
      return 'Calculate';
    }

    // Default naming based on args
    if (args && args.trim().length > 0) {
      return 'Process';
    }

    return 'Handler';
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

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

      let result = luaFormat.Beautify(processedCode, {
        RenameVariables: options?.renameVariables ?? false,
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

      let result = luaFormat.Minify(processedCode, {
        RenameVariables: options?.renameVariables ?? true,
        RenameGlobals: options?.renameGlobals ?? false,
        SolveMath: options?.solveMath ?? false,
      });

      // Apply post-processing optimizations
      if (options?.removeWhitespace) {
        result = result.replace(/\s+/g, ' ').trim();
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
      // Improved: handles one-liners, nested calls, and obfuscated patterns
      const regex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;\n]+?)(?=\n|;|$)/g;
      let m;
      while ((m = regex.exec(code)) !== null) {
        const varName = m[1];
        const rhs = m[2].trim();
        
        let semanticName = extractSemanticName(rhs, code);
        
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

      // Also detect function definitions with semantic analysis
      const funcRegex = /\blocal\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)[\s\n]*([\s\S]*?)(?=\bend\b|$)/g;
      let fm;
      while ((fm = funcRegex.exec(code)) !== null) {
        const funcName = fm[1];
        const args = fm[2] || "";
        const body = fm[3] || "";
        
        let semanticFuncName = analyzeFunction(funcName, args, body);
        
        // Count duplicates
        if (typeCounters[semanticFuncName] !== undefined) {
          typeCounters[semanticFuncName]++;
          variables.push({ old: funcName, detected: `${semanticFuncName}${typeCounters[semanticFuncName]}` });
        } else {
          typeCounters[semanticFuncName] = 1;
          variables.push({ old: funcName, detected: semanticFuncName });
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

  // Helper to extract semantic name from RHS - with advanced obfuscation detection
  function extractSemanticName(rhs: string, fullCode: string = ''): string {
    // Handle game:GetService("Players") → Players
    const getServiceMatch = rhs.match(/GetService\s*\(\s*["']([^"']+)["']\s*\)/);
    if (getServiceMatch) {
      return getServiceMatch[1];
    }

    // Handle Instance.new("Type", Parent) or Instance.new("Type") → Type
    const instanceNewMatch = rhs.match(/Instance\.new\s*\(\s*["']([^"']+)["']/);
    if (instanceNewMatch) {
      return instanceNewMatch[1];
    }

    // Handle game.Players, workspace.X, script.X → extract last property
    const gamePlayersMatch = rhs.match(/(game|workspace|script)\.([A-Za-z_]\w*)/);
    if (gamePlayersMatch) {
      return gamePlayersMatch[2];
    }

    // Handle chained calls like game:GetService("X"):FindFirstChild(...) 
    const chainedMatch = rhs.match(/:\w+\s*\([^)]*\)\s*:/);
    if (chainedMatch) {
      return 'Result';
    }

    // Handle table/array constructors {...} 
    if (rhs.startsWith('{')) {
      return 'Table';
    }

    // Handle functions and methods
    if (rhs.includes('function') || rhs.match(/\w+\s*\(/)) {
      return 'Function';
    }

    // Handle LocalPlayer reference
    if (rhs.includes('LocalPlayer')) {
      return 'LocalPlayer';
    }

    // Handle workspace reference
    if (rhs.includes('workspace')) {
      return 'Workspace';
    }

    // Handle obfuscated math/logic
    if (/^[\d\s+\-*/%()]+$/.test(rhs)) {
      return 'Calculation';
    }

    // Handle string literals
    if (rhs.match(/^["']/)) {
      return 'Text';
    }

    // Handle numeric literals
    if (/^\d+(\.\d+)?$/.test(rhs)) {
      return 'Number';
    }

    // Default
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

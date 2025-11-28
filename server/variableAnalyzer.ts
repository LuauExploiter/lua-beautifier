/**
 * Advanced Lua variable semantic analyzer with smart pattern recognition
 */

interface VariableMapping {
  [variable: string]: string;
}

export function analyzeVariableSemantics(code: string): VariableMapping {
  const mapping: VariableMapping = {};
  const assignmentPattern =
    /\b(?:local|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;\n]+)/g;

  let match;
  const usedNames = new Set<string>();

  while ((match = assignmentPattern.exec(code)) !== null) {
    const varName = match[1];
    const expression = match[2].trim();
    const semanticName = extractSemanticName(expression, usedNames);
    
    if (semanticName && semanticName !== varName && !usedNames.has(semanticName)) {
      mapping[varName] = semanticName;
      usedNames.add(semanticName);
    }
  }

  return mapping;
}

function extractSemanticName(expression: string, usedNames: Set<string>): string | null {
  expression = expression.replace(/--.*$/, "").trim();

  // Try member chain extraction (highest priority)
  const memberChainMatch = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/);
  if (memberChainMatch) {
    const chain = memberChainMatch[0];
    const parts = chain.split(".");
    
    // Try last part first
    for (let i = parts.length - 1; i >= Math.max(1, parts.length - 2); i--) {
      const part = parts[i];
      if (isValidIdentifier(part) && part.length <= 30 && !usedNames.has(part)) {
        return part;
      }
    }
  }

  // Function calls with prefix removal
  const functionCallMatch = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
  if (functionCallMatch) {
    const funcName = functionCallMatch[1];
    const semanticName = extractFromFunctionName(funcName);
    if (semanticName && !usedNames.has(semanticName)) {
      return semanticName;
    }
  }

  // Table constructor
  if (expression.match(/^\s*\{/)) {
    if (!usedNames.has("Tbl")) return "Tbl";
    if (!usedNames.has("Data")) return "Data";
  }

  // Array/table access
  const arrayAccessMatch = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\[/);
  if (arrayAccessMatch) {
    const arrayName = arrayAccessMatch[1];
    if (!usedNames.has(arrayName)) return arrayName;
  }

  return null;
}

function extractFromFunctionName(funcName: string): string | null {
  const prefixes = [
    "get", "create", "load", "find", "fetch", "init", "make", 
    "build", "setup", "new", "spawn", "start", "begin", "open",
    "read", "write", "send", "receive", "request", "handle"
  ];

  for (const prefix of prefixes) {
    if (funcName.toLowerCase().startsWith(prefix)) {
      const remaining = funcName.substring(prefix.length);
      if (remaining && isValidIdentifier(remaining)) {
        return remaining;
      }
    }
  }

  return funcName.length <= 20 && isValidIdentifier(funcName) ? funcName : null;
}

function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

export function applySemanticRenames(minifiedCode: string, semantics: VariableMapping): string {
  let result = minifiedCode;
  for (const [boringName, semanticName] of Object.entries(semantics)) {
    const regex = new RegExp(`\\b${boringName}\\b`, "g");
    result = result.replace(regex, semanticName);
  }
  return result;
}

/**
 * Advanced code analysis for additional optimizations
 */
export function analyzeCodeStructure(code: string) {
  return {
    hasRecursion: /local\s+\w+\s*=\s*function\s*\(/.test(code) && 
                  /function\s*\(/m.test(code),
    hasLoops: /\b(?:for|while|repeat)\b/i.test(code),
    hasConditionals: /\b(?:if|then|else|elseif)\b/i.test(code),
    hasTableOperations: /\{|\}/g.test(code),
    hasFunctionCalls: /\w+\s*\(/g.test(code),
    hasStrings: /"[^"]*"|'[^']*'/g.test(code),
    lineCount: code.split('\n').length,
  };
}

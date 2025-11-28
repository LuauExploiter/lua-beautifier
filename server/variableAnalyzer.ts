/**
 * Intelligent Lua variable semantic analyzer with usage-based pattern recognition
 */

interface VariableMapping {
  [variable: string]: string;
}

// Known Roblox/Lua API patterns and their likely variable names
const KNOWN_APIS: Record<string, string> = {
  "game.Players": "Players",
  "game.RunService": "RunService",
  "game.Debris": "Debris",
  "game.Workspace": "Workspace",
  "game.StarterPlayer": "StarterPlayer",
  "game.ServerScriptService": "ServerScriptService",
  "game.ServerStorage": "ServerStorage",
  "game.ReplicatedStorage": "ReplicatedStorage",
  "game.Lighting": "Lighting",
  "game.HttpService": "HttpService",
  "game.UserInputService": "UserInputService",
  ".LocalPlayer": "LocalPlayer",
  ".PlayerAdded": "PlayerAdded",
  ".PlayerRemoving": "PlayerRemoving",
  ".CharacterAdded": "CharacterAdded",
  ".GetTouchingParts": "GetTouchingParts",
  ".FindFirstChild": "FindFirstChild",
  ".WaitForChild": "WaitForChild",
};

// Method signatures that indicate variable types
const METHOD_SIGNATURES: Record<string, string> = {
  "Connect": "Signal",
  "Fire": "Signal",
  "GetChildren": "Instance",
  "FindFirstChild": "Instance",
  "WaitForChild": "Instance",
  "Destroy": "Instance",
  "Clone": "Instance",
  "GetDescendants": "Instance",
  "Move": "Part",
  "SetPrimaryPartCFrame": "Model",
  "MoveTo": "Humanoid",
  "TakeDamage": "Humanoid",
  "LoadCharacter": "Player",
  "Kick": "Player",
  "GetRankInGroup": "Player",
  "GetService": "Game",
};

export function analyzeVariableSemantics(code: string): VariableMapping {
  const mapping: VariableMapping = {};
  const usedNames = new Set<string>();

  // Extract all local variable assignments
  const assignmentPattern =
    /\b(?:local|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;\n]+)/g;

  let match;
  const varAssignments: Map<string, string> = new Map();

  while ((match = assignmentPattern.exec(code)) !== null) {
    const varName = match[1];
    const expression = match[2].trim();
    varAssignments.set(varName, expression);
  }

  // Analyze each variable
  for (const [varName, expression] of Array.from(varAssignments.entries())) {
    let semanticName: string | null = null;

    // 1. Check if expression matches known APIs
    for (const [api, suggestedName] of Object.entries(KNOWN_APIS)) {
      if (expression.includes(api)) {
        semanticName = suggestedName;
        break;
      }
    }

    // 2. If no API match, analyze how the variable is USED in the code
    if (!semanticName) {
      semanticName = analyzeVariableUsage(varName, code);
    }

    // 3. If still no name, try extracting from the expression directly
    if (!semanticName) {
      semanticName = extractSemanticName(expression, usedNames);
    }

    // Add to mapping if we found a good name and it's unique
    if (
      semanticName &&
      semanticName !== varName &&
      !usedNames.has(semanticName)
    ) {
      mapping[varName] = semanticName;
      usedNames.add(semanticName);
    }
  }

  return mapping;
}

/**
 * Analyze how a variable is used to infer its semantic meaning
 */
function analyzeVariableUsage(varName: string, code: string): string | null {
  const varRegex = new RegExp(`\\b${varName}\\b`, "g");
  const usageContext: string[] = [];

  // Find all usages of this variable
  const lines = code.split("\n");
  for (const line of lines) {
    if (varRegex.test(line)) {
      usageContext.push(line.trim());
    }
  }

  // Analyze usage patterns
  for (const usage of usageContext) {
    // Check for method calls
    const methodMatch = usage.match(
      new RegExp(`${varName}\\s*[:.](\\w+)\\s*\\(`)
    );
    if (methodMatch) {
      const methodName = methodMatch[1];
      const inferredType = METHOD_SIGNATURES[methodName];
      if (inferredType) {
        return inferredType;
      }
    }

    // Check for property access patterns
    const propMatch = usage.match(new RegExp(`${varName}\\.(\\w+)`));
    if (propMatch) {
      const propName = propMatch[1];
      // Common property patterns
      if (
        propName === "LocalPlayer" ||
        propName === "Character" ||
        propName === "Humanoid"
      ) {
        return propName;
      }
      if (propName === "Position" || propName === "Size" || propName === "CFrame") {
        return "Part";
      }
      if (
        propName === "Parent" ||
        propName === "Children" ||
        propName === "Name"
      ) {
        return "Instance";
      }
    }

    // Check for function calls
    const funcMatch = usage.match(new RegExp(`(\\w+)\\s*\\(.*${varName}`));
    if (funcMatch) {
      const funcName = funcMatch[1];
      // Detect patterns like "table.insert(list, item)"
      if (funcName === "table" || funcName === "insert" || funcName === "remove") {
        return "List";
      }
      if (funcName === "ipairs" || funcName === "pairs") {
        return "Table";
      }
    }

    // Check for iteration patterns
    if (usage.includes("for") && usage.includes(" in ")) {
      if (usage.includes("pairs")) {
        return "Table";
      }
      if (usage.includes("ipairs")) {
        return "List";
      }
    }

    // Check for table access
    if (usage.includes(`${varName}[`)) {
      return "Table";
    }

    // Check for `:Connect` pattern (signal)
    if (usage.includes(`${varName}:Connect`)) {
      return "Signal";
    }

    // Check for string concatenation (likely a string)
    if (
      usage.includes(`${varName}..`) ||
      usage.includes(`.. ${varName}`)
    ) {
      return "String";
    }

    // Check for arithmetic (likely a number)
    if (
      usage.match(
        new RegExp(`${varName}\\s*[+\\-*/%]|[+\\-*/%]\\s*${varName}`)
      )
    ) {
      return "Number";
    }
  }

  return null;
}

function extractSemanticName(expression: string, usedNames: Set<string>): string | null {
  expression = expression.replace(/--.*$/, "").trim();

  // Function calls with meaningful names
  const functionCallMatch = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
  if (functionCallMatch) {
    const funcName = functionCallMatch[1];
    const semanticName = extractFromFunctionName(funcName);
    if (semanticName && !usedNames.has(semanticName)) {
      return semanticName;
    }
  }

  // Member chain extraction
  const memberChainMatch = expression.match(
    /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/
  );
  if (memberChainMatch) {
    const chain = memberChainMatch[0];
    const parts = chain.split(".");

    for (let i = parts.length - 1; i >= Math.max(1, parts.length - 2); i--) {
      const part = parts[i];
      if (
        isValidIdentifier(part) &&
        part.length <= 30 &&
        !usedNames.has(part) &&
        !isCommonKeyword(part)
      ) {
        return part;
      }
    }
  }

  // Table constructor
  if (expression.match(/^\s*\{/)) {
    if (!usedNames.has("Config")) return "Config";
    if (!usedNames.has("Data")) return "Data";
    if (!usedNames.has("Table")) return "Table";
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
    "get",
    "create",
    "load",
    "find",
    "fetch",
    "init",
    "make",
    "build",
    "setup",
    "new",
    "spawn",
    "start",
    "begin",
    "open",
    "read",
    "write",
    "send",
    "receive",
    "request",
    "handle",
  ];

  for (const prefix of prefixes) {
    if (funcName.toLowerCase().startsWith(prefix)) {
      const remaining = funcName.substring(prefix.length);
      if (remaining && isValidIdentifier(remaining)) {
        return remaining;
      }
    }
  }

  return funcName.length <= 20 && isValidIdentifier(funcName)
    ? funcName
    : null;
}

function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

function isCommonKeyword(str: string): boolean {
  const keywords = [
    "local",
    "function",
    "return",
    "if",
    "then",
    "else",
    "end",
    "for",
    "while",
    "do",
    "break",
    "and",
    "or",
    "not",
    "nil",
    "true",
    "false",
    "in",
    "table",
    "string",
    "math",
    "io",
    "os",
    "game",
    "script",
    "self",
    "this",
    "repeat",
    "until",
    "elseif",
  ];
  return keywords.includes(str.toLowerCase());
}

export function applySemanticRenames(
  minifiedCode: string,
  semantics: VariableMapping
): string {
  let result = minifiedCode;
  for (const [boringName, semanticName] of Object.entries(semantics)) {
    // Safety checks
    if (!isValidIdentifier(boringName) || !isValidIdentifier(semanticName)) {
      continue;
    }
    if (isCommonKeyword(boringName) || isCommonKeyword(semanticName)) {
      continue;
    }
    
    // Only replace if the boring name is at least 2 chars (avoid single letter issues)
    if (boringName.length < 1) {
      continue;
    }
    
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
    hasRecursion:
      /local\s+\w+\s*=\s*function\s*\(/.test(code) &&
      /function\s*\(/m.test(code),
    hasLoops: /\b(?:for|while|repeat)\b/i.test(code),
    hasConditionals: /\b(?:if|then|else|elseif)\b/i.test(code),
    hasTableOperations: /\{|\}/g.test(code),
    hasFunctionCalls: /\w+\s*\(/g.test(code),
    hasStrings: /"[^"]*"|'[^']*'/g.test(code),
    lineCount: code.split("\n").length,
  };
}

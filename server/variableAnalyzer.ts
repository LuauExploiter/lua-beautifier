/**
 * Lua variable semantic analyzer
 * Extracts meaningful names from variable assignments
 * e.g., local v = game.Players -> v should be renamed to Players
 */

interface VariableMapping {
  [variable: string]: string;
}

export function analyzeVariableSemantics(code: string): VariableMapping {
  const mapping: VariableMapping = {};

  // Match: local/var identifier = expression
  const assignmentPattern =
    /\b(?:local|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;\n]+)/g;

  let match;
  while ((match = assignmentPattern.exec(code)) !== null) {
    const varName = match[1];
    const expression = match[2].trim();

    // Extract semantic name from the expression
    const semanticName = extractSemanticName(expression);
    if (semanticName && semanticName !== varName) {
      mapping[varName] = semanticName;
    }
  }

  return mapping;
}

function extractSemanticName(expression: string): string | null {
  // Remove trailing comments
  expression = expression.replace(/--.*$/, "").trim();

  // Chain member access: a.b.c -> use 'c' (the last member)
  // Example: game.Players -> Players, v.LocalPlayer -> LocalPlayer
  const memberChainMatch = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/);
  if (memberChainMatch) {
    const chain = memberChainMatch[0];
    const parts = chain.split(".");
    const lastPart = parts[parts.length - 1];

    // Validate the last part is a reasonable name
    if (isValidIdentifier(lastPart) && lastPart.length <= 30) {
      return lastPart;
    }
  }

  // Function calls: getSomething() -> use 'Something'
  // Example: GetPlayer() -> Player
  const functionCallMatch = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
  if (functionCallMatch) {
    const funcName = functionCallMatch[1];
    // Extract meaningful part from function name
    // Common patterns: Get*, Create*, Load* -> remove prefix
    let semanticName = funcName;
    const prefixes = ["get", "create", "load", "find", "fetch", "init"];
    prefixes.forEach((prefix) => {
      if (funcName.toLowerCase().startsWith(prefix)) {
        semanticName = funcName.substring(prefix.length);
      }
    });

    if (semanticName && semanticName.length > 0 && isValidIdentifier(semanticName)) {
      return semanticName;
    }
  }

  // Table constructors: { x = 1, y = 2 } -> Table
  if (expression.match(/^\s*\{/)) {
    return "Table";
  }

  // String literals: "name" -> Str
  if (expression.match(/^["']/)) {
    return "Str";
  }

  // Number literals
  if (expression.match(/^\d+/)) {
    return "Num";
  }

  // Boolean literals
  if (expression.match(/^(?:true|false)$/)) {
    return "Bool";
  }

  // Array/table access: arr[i] -> use array name
  const arrayAccessMatch = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\[/);
  if (arrayAccessMatch) {
    return arrayAccessMatch[1];
  }

  return null;
}

function isValidIdentifier(str: string): boolean {
  // Must start with letter or underscore, contain only alphanumerics and underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

/**
 * Apply semantic variable renaming to minified code
 * Creates a mapping of boring names to semantic names
 */
export function createSmartRenameMapping(
  originalCode: string,
  minifiedCode: string
): { [boringName: string]: string } {
  const semanticMap = analyzeVariableSemantics(originalCode);

  // Get all variable names used in original code
  const originalVars = new Set<string>();
  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;
  while ((match = varPattern.exec(originalCode)) !== null) {
    originalVars.add(match[1]);
  }

  // Create mapping from boring minified names to semantic names
  const renameMapping: { [key: string]: string } = {};

  // Track which semantic names have been used
  const usedSemanticNames = new Set<string>();

  // Generate boring variable names (a, b, c, ... aa, ab, etc)
  const boringNames = generateBoringNames(originalVars.size + 100);
  let boringIndex = 0;

  // Assign semantic names based on the mapping
  for (const [originalVar, semanticName] of Object.entries(semanticMap)) {
    // Find the minified name for this original variable
    const minifiedVarName = boringNames[boringIndex];
    if (minifiedVarName && !usedSemanticNames.has(semanticName)) {
      renameMapping[minifiedVarName] = semanticName;
      usedSemanticNames.add(semanticName);
    }
    boringIndex++;
  }

  return renameMapping;
}

/**
 * Generate variable names: a, b, c, ..., z, aa, ab, ac, ...
 */
function generateBoringNames(count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      // a-z
      names.push(String.fromCharCode(97 + i));
    } else {
      // aa, ab, ac, ..., ba, bb, ...
      const firstChar = String.fromCharCode(97 + Math.floor((i - 26) / 26));
      const secondChar = String.fromCharCode(97 + ((i - 26) % 26));
      names.push(firstChar + secondChar);
    }
  }
  return names;
}

/**
 * Post-process minified code to replace boring variable names with semantic ones
 */
export function applySemanticRenames(
  minifiedCode: string,
  semantics: VariableMapping
): string {
  let result = minifiedCode;

  // Replace each boring name with its semantic counterpart
  for (const [boringName, semanticName] of Object.entries(semantics)) {
    // Use word boundaries to avoid partial replacements
    const regex = new RegExp(`\\b${boringName}\\b`, "g");
    result = result.replace(regex, semanticName);
  }

  return result;
}

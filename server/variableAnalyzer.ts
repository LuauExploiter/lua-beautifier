/**
 * Smart Rename Engine — automatic semantic variable renaming
 * Works on ANY Lua/Luau code without external modules
 */

interface VarMap {
  [key: string]: string;
}

interface VarCount {
  number: number;
  text: number;
  callback: number;
  instance: number;
  table: number;
  list: number;
  object: number;
  unknown: number;
}

export function smartRename(code: string): string {
  const varMap = buildVariableMap(code);
  
  // Apply replacements with word boundary regex
  let result = code;
  for (const [oldName, newName] of Object.entries(varMap)) {
    const regex = new RegExp(`\\b${oldName}\\b`, "g");
    result = result.replace(regex, newName);
  }
  
  return result;
}

function buildVariableMap(code: string): VarMap {
  const varMap: VarMap = {};
  const varCount: VarCount = {
    number: 1,
    text: 1,
    callback: 1,
    instance: 1,
    table: 1,
    list: 1,
    object: 1,
    unknown: 1,
  };

  const assignRegex = /local\s+(\w+)\s*=\s*(.+?)(?=\n|$|;)/g;

  // === Semantic Classification ===
  function classify(name: string, value: string): string {
    if (!value) return "unknown";

    value = value.trim();

    if (/^Instance\.new/i.test(value)) return "instance";
    if (/^\d+(\.\d+)?$/.test(value)) return "number";
    if (/^["'].*["']$/.test(value)) return "text";
    if (/^function/i.test(value)) return "callback";
    if (/^\{.*\}$/.test(value)) return "table";
    if (/^\[.*\]$/.test(value)) return "list";

    // Contains . or : (property/method access)
    if (value.includes(".") || value.includes(":")) return "object";

    return "unknown";
  }

  // === First pass: detect variable declarations ===
  let match;
  while ((match = assignRegex.exec(code)) !== null) {
    const name = match[1];
    const value = match[2];

    const type = classify(name, value);

    let newName = "";

    switch (type) {
      case "instance": {
        const classMatch = value.match(/Instance\.new\(["'](.*)["']/);
        const className = classMatch ? classMatch[1] : "Instance";
        newName =
          className.charAt(0).toLowerCase() + className.slice(1) + varCount.instance++;
        break;
      }

      case "number":
        newName = "number" + varCount.number++;
        break;

      case "text":
        newName = "text" + varCount.text++;
        break;

      case "callback":
        newName = "callback" + varCount.callback++;
        break;

      case "table":
        newName = "table" + varCount.table++;
        break;

      case "list":
        newName = "list" + varCount.list++;
        break;

      case "object":
        newName = "object" + varCount.object++;
        break;

      default:
        newName = "value" + varCount.unknown++;
        break;
    }

    varMap[name] = newName;
  }

  return varMap;
}

/**
 * Get the variable mapping without applying it (for comparison)
 */
export function getVariableMapping(code: string): VarMap {
  return buildVariableMap(code);
}

/**
 * God-tier Smart Rename Engine — intelligent semantic variable and function renaming for Lua/Luau
 * Integrates sophisticated heuristics with clean capitalized naming
 */

interface MaskPart {
  type: "str" | "longstr" | "comment";
  text: string;
}

interface MaskData {
  masked: string;
  parts: MaskPart[];
}

interface CodeAnalysis {
  locals: Array<{ name: string; rhs: string; lineNo: number }>;
  globals: Array<{ name: string; rhs: string; lineNo: number }>;
  functions: Array<{
    name: string;
    args: string;
    start: number;
    end: number;
    rawBody: string;
    lines: string[];
  }>;
  propertyUsages: { [key: string]: Set<string> };
  lines: string[];
}

export function smartRename(code: string): string {
  const options = {
    removeComments: false,
    removePrints: false,
    solveMath: false,
    renameVariables: true,
    renameFunctions: true,
    renameGlobals: true,
    beautifyIndent: false,
  };

  // 1) Extract and mask strings & long brackets & comments
  const maskData = maskStringsAndComments(code);
  let working = maskData.masked;

  // 2) Analyze declarations/usages
  const analysis = analyzeCode(working);

  // 3) Build rename map with capitalized type names
  const renameMap = buildRenameMap(analysis, options);

  // 4) Apply renames safely
  let renamed = applyRenamesMaskSafe(working, renameMap, maskData);

  // 5) Restore strings/comments
  const restored = restoreMasked(renamed, maskData);

  return restored;
}

// ========== MASKING ==========
function maskStringsAndComments(src: string): MaskData {
  const parts: MaskPart[] = [];
  let out = "";
  let i = 0;
  const L = src.length;

  while (i < L) {
    const ch = src[i];

    // Long bracket [[ ... ]]
    if (ch === "[" && src[i + 1] === "[") {
      let j = i + 2;
      while (j < L && !(src[j] === "]" && src[j + 1] === "]")) j++;
      const slice = src.slice(i, Math.min(j + 2, L));
      parts.push({ type: "longstr", text: slice });
      out += `__MASK_LONGSTR_${parts.length - 1}__`;
      i = Math.min(j + 2, L);
      continue;
    }

    // String ' or "
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      let acc = ch;
      while (j < L) {
        const c = src[j];
        acc += c;
        if (c === "\\") {
          acc += src[j + 1] || "";
          j += 2;
          continue;
        }
        if (c === q) {
          j++;
          break;
        }
        j++;
      }
      parts.push({ type: "str", text: acc });
      out += `__MASK_STR_${parts.length - 1}__`;
      i = j;
      continue;
    }

    // Comment: --[[...]] or --...
    if (src[i] === "-" && src[i + 1] === "-") {
      if (src[i + 2] === "[" && src[i + 3] === "[") {
        let j = i + 4;
        while (j < L && !(src[j] === "]" && src[j + 1] === "]")) j++;
        const slice = src.slice(i, Math.min(j + 2, L));
        parts.push({ type: "comment", text: slice });
        out += `__MASK_COMMENT_${parts.length - 1}__`;
        i = Math.min(j + 2, L);
        continue;
      } else {
        let j = i + 2;
        while (j < L && src[j] !== "\n") j++;
        const slice = src.slice(i, j);
        parts.push({ type: "comment", text: slice });
        out += `__MASK_COMMENT_${parts.length - 1}__`;
        i = j;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return { masked: out, parts };
}

function restoreMasked(maskedText: string, maskData: MaskData): string {
  let text = maskedText;
  maskData.parts.forEach((p, idx) => {
    const key = `__MASK_${
      p.type === "str" ? "STR" : p.type === "longstr" ? "LONGSTR" : "COMMENT"
    }_${idx}__`;
    text = text.split(key).join(p.text);
  });
  return text;
}

// ========== CODE ANALYSIS ==========
function analyzeCode(code: string): CodeAnalysis {
  const locals: Array<{ name: string; rhs: string; lineNo: number }> = [];
  const globals: Array<{ name: string; rhs: string; lineNo: number }> = [];
  const functions: CodeAnalysis["functions"] = [];
  const propertyUsages: { [key: string]: Set<string> } = {};
  const lines = code.split("\n");

  // Collect function blocks
  const funcStack: Array<{
    name: string;
    start: number;
    args: string;
    lines: string[];
  }> = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // Function header
    let fm = line.match(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    const localFuncMatch = line.match(
      /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/
    );
    if (localFuncMatch) fm = localFuncMatch;

    if (fm) {
      const fname = fm[1];
      funcStack.push({
        name: fname,
        start: li,
        args: fm[2] || "",
        lines: [],
      });
      continue;
    }

    // End keyword
    if (/\bend\b/.test(line) && funcStack.length) {
      const f = funcStack.pop();
      if (f) {
        functions.push({
          name: f.name,
          args: f.args,
          start: f.start,
          end: li,
          rawBody: lines.slice(f.start + 1, li).join("\n"),
          lines: f.lines,
        });
      }
      continue;
    }

    // Track lines within functions
    if (funcStack.length) {
      funcStack[funcStack.length - 1].lines.push(line);
    }
  }

  // Local declarations & globals
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // Local declarations
    const m = line.match(
      /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*(?:=\s*(.+))?/
    );
    if (m) {
      const names = m[1].split(/\s*,\s*/);
      const rhs = m[2] ? m[2].trim() : "";
      for (const n of names) {
        locals.push({ name: n, rhs, lineNo: li });
      }
    }

    // Globals
    const gm = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (gm) {
      const name = gm[1];
      const rhs = gm[2].trim();
      globals.push({ name, rhs, lineNo: li });
    }

    // Property usages
    const propRegex = /([A-Za-z_][A-Za-z0-9_]*)\s*(?:\.|:)\s*([A-Za-z_][A-Za-z0-9_]*)/g;
    let p;
    while ((p = propRegex.exec(line)) !== null) {
      const obj = p[1],
        prop = p[2];
      propertyUsages[obj] = propertyUsages[obj] || new Set();
      propertyUsages[obj].add(prop);
    }
  }

  return { locals, globals, functions, propertyUsages, lines };
}

// ========== RENAME MAP BUILDER ==========
function buildRenameMap(
  analysis: CodeAnalysis,
  options: {
    renameVariables: boolean;
    renameFunctions: boolean;
    renameGlobals: boolean;
  }
): { [key: string]: string } {
  const map: { [key: string]: string } = {};
  const usedNames = new Set<string>();

  function uniqueName(base: string): string {
    let name = base;
    let i = 1;
    while (usedNames.has(name)) {
      name = base + i;
      i++;
    }
    usedNames.add(name);
    return name;
  }

  function inferFromRHS(
    rhs: string,
    nameHintFromProps?: Set<string>
  ): string | null {
    if (!rhs) return null;

    // game:GetService("X")
    let m = rhs.match(/game:GetService\(["']([^"']+)["']\)/);
    if (m) return m[1];

    // game.Players or workspace.Foo
    m = rhs.match(
      /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+)$/
    );
    if (m) {
      const last = m[1].split(".").pop();
      if (last && /^[A-Za-z_]\w*$/.test(last)) return last;
    }

    // Instance.new("Class")
    m = rhs.match(/Instance\.new\(["']([^"']+)["']/);
    if (m) {
      const cls = m[1];
      const uiMap: { [key: string]: string } = {
        ScreenGui: "MainGui",
        Frame: "MainFrame",
        TextLabel: "TitleLabel",
        TextButton: "ActionButton",
        ImageButton: "ImageButton",
        TextBox: "TextBox",
        UIStroke: "OutlineStroke",
        UICorner: "FrameCorners",
        ScrollingFrame: "ScrollingFrame",
        ViewportFrame: "ViewportFrame",
      };
      return uiMap[cls] || cls;
    }

    // Vector3.new / UDim2.new
    if (/Vector3\.new/.test(rhs)) return "Vector3Value";
    if (/UDim2\.new/.test(rhs)) return "UDim2Value";

    // Boolean literal
    if (/\b(true|false)\b/.test(rhs)) return "Enabled";

    // Numeric literal
    if (/^\d+(\.\d+)?$/.test(rhs)) return "Number";

    // Fallback to properties
    if (nameHintFromProps && nameHintFromProps.size) {
      const props = Array.from(nameHintFromProps);
      const prefer = [
        "LocalPlayer",
        "Character",
        "Humanoid",
        "HumanoidRootPart",
        "CurrentCamera",
        "Animator",
        "Position",
        "Velocity",
        "Size",
      ];
      for (const p of prefer) if (props.includes(p)) return p;
      return props[0];
    }

    return null;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // 1) Locals
  for (const loc of analysis.locals) {
    const old = loc.name;
    if (map[old]) continue;

    const props = analysis.propertyUsages[old];
    const inferred = inferFromRHS(loc.rhs, props);

    if (inferred) {
      map[old] = uniqueName(inferred);
      continue;
    }

    // Fallback: obfuscated patterns with CAPITALIZED types
    let m = old.match(/^(v|vu|_v)(\d+)/i);
    if (m) {
      map[old] = uniqueName("Variable" + m[2]);
      continue;
    }

    if (/^_[a-z]/.test(old)) {
      map[old] = uniqueName("Temp_" + old.replace(/^_+/, ""));
      continue;
    }

    // Already readable - just add capitalized type prefix
    map[old] = uniqueName("Value");
  }

  // 2) Globals
  for (const g of analysis.globals) {
    const old = g.name;
    if (map[old]) continue;

    const inferred = inferFromRHS(g.rhs, analysis.propertyUsages[old]);
    if (inferred) {
      map[old] = uniqueName(inferred);
    } else {
      map[old] = uniqueName("Global");
    }
  }

  // 3) Functions with CAPITALIZED type names
  for (const f of analysis.functions) {
    const old = f.name;
    if (map[old]) continue;

    const body = f.rawBody || f.lines.join("\n") || "";

    // Instance creation pattern -> Create prefix
    let mm = body.match(/Instance\.new\(["']([^"']+)["']/);
    if (mm) {
      const cls = mm[1];
      map[old] = uniqueName("Create" + capitalize(cls));
      continue;
    }

    // Signal connection pattern
    if (
      /:\s*Connect\b/.test(body) ||
      /\.Connect\b/.test(body) ||
      /Connect\(/.test(body)
    ) {
      map[old] = uniqueName("OnEvent");
      continue;
    }

    // Heartbeat pattern
    if (/Heartbeat|RenderStepped|Stepped/.test(body)) {
      map[old] = uniqueName("OnHeartbeat");
      continue;
    }

    // Generic fallback with CAPITALIZED
    map[old] = uniqueName("Function");
  }

  // Keyword collision check
  const keywords = new Set([
    "local",
    "function",
    "end",
    "if",
    "then",
    "else",
    "true",
    "false",
    "nil",
    "return",
    "for",
    "while",
    "do",
    "repeat",
    "until",
  ]);

  for (const k in map) {
    if (keywords.has(map[k])) {
      map[k] = "_" + map[k];
    }
  }

  // Protected names
  const protected_names = [
    "game",
    "workspace",
    "script",
    "require",
    "print",
    "warn",
    "Instance",
    "UDim2",
    "Vector3",
    "Color3",
  ];
  for (const pname of protected_names) {
    usedNames.add(pname);
  }

  return map;
}

// ========== APPLY RENAMES ==========
function applyRenamesMaskSafe(
  masked: string,
  renameMap: { [key: string]: string },
  maskData: MaskData
): string {
  const placeholderRegex = /__MASK_(STR|LONGSTR|COMMENT)_(\d+)__/g;

  let out = "";
  let lastIndex = 0;
  let m;

  while ((m = placeholderRegex.exec(masked)) !== null) {
    const idxStart = m.index;
    const token = m[0];
    const before = masked.slice(lastIndex, idxStart);
    out += replaceIdentifiersInSegment(before, renameMap);
    out += token;
    lastIndex = idxStart + token.length;
  }

  out += replaceIdentifiersInSegment(masked.slice(lastIndex), renameMap);
  return out;
}

function replaceIdentifiersInSegment(
  seg: string,
  renameMap: { [key: string]: string }
): string {
  if (!seg) return seg;

  const keys = Object.keys(renameMap).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return seg;

  const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`\\b(${esc.join("|")})\\b`, "g");
  return seg.replace(regex, (m, p1) => renameMap[p1] || m);
}

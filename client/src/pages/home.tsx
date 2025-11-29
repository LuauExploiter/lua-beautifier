import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Wand2, Code2, Moon, Sun, Download, Upload, Trash2, RotateCcw,
  Settings2, FileCode, Sparkles, CheckCircle2, ChevronDown, Minimize2, Maximize2,
} from "lucide-react";

const DEFAULT_CODE = `-- Paste your messy Lua code here!
local v = game.Players
local b = v.LocalPlayer
local function greet(name)
  print("Hello, " .. name .. "!")
end
greet("World")
`;

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [mode, setMode] = useState<"beautify" | "minify" | "rename">("minify");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [renameMap, setRenameMap] = useState<{ [key: string]: string }>({});

  const [options, setOptions] = useState({
    renameVariables: false,
    renameGlobals: false,
    solveMath: false,
    smartRename: false,
    removeWhitespace: true,
    removeComments: true,
    removeStrings: false,
    convertNumberFormats: true,
    compressStrings: false,
    removeBlankLines: true,
    normalizeQuotes: false,
    sortTableFields: false,
  });

  const [formatting, setFormatting] = useState({
    indentSize: 2,
    useTabs: false,
  });

  const { toast } = useToast();

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === "true");
      document.documentElement.classList.toggle("dark", savedDarkMode === "true");
    }
  }, []);

  const handleProcess = async () => {
    if (!inputCode.trim()) {
      toast({ title: "Error", description: "Please enter some Lua code", variant: "destructive" });
      return;
    }

    setHistory((prev) => [...prev.slice(-9), inputCode]);
    setIsLoading(true);

    try {
      let endpoint = mode === "beautify" ? "/beautify" : mode === "minify" ? "/minify" : "/rename";
      const body = mode === "rename" 
        ? { code: inputCode, renameMap } 
        : { code: inputCode, options: { ...options, ...formatting } };
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok) {
        if (mode === "rename" && data.varMap) {
          setRenameMap(data.varMap);
          toast({ title: "Variables Detected!", description: `Found ${Object.keys(data.varMap).length} variables to rename` });
        } else {
          setOutputCode(data.result);
          toast({
            title: `${mode === "beautify" ? "Beautified" : "Minified"} Successfully!`,
            description: mode === "minify"
              ? `Reduced by ${Math.round((1 - data.result.length / inputCode.length) * 100)}%`
              : `Formatted ${inputCode.split('\n').length} lines`,
          });
        }
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Connection Error", description: "Failed to connect", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!outputCode) return;
    await navigator.clipboard.writeText(outputCode);
    setCopied(true);
    toast({ title: "Copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    if (!outputCode) return;
    const blob = new Blob([outputCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "beautify" ? "formatted.lua" : "minified.lua";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${mode === "beautify" ? "formatted" : "minified"}.lua` });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputCode(event.target?.result as string);
      toast({ title: `Loaded ${file.name}` });
    };
    reader.readAsText(file);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle("dark", newMode);
    localStorage.setItem("darkMode", String(newMode));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  const beautifyOpts = [
    { id: "renameVariables", label: "Rename Variables", desc: "Shorten variable names" },
    { id: "smartRename", label: "Smart Rename", desc: "Semantic naming (restore minified vars)" },
    { id: "normalizeQuotes", label: "Normalize Quotes", desc: "Convert to double quotes" },
    { id: "sortTableFields", label: "Sort Table Fields", desc: "Alphabetically sort fields" },
    { id: "removeBlankLines", label: "Remove Blank Lines", desc: "Compress empty lines" },
  ];

  const minifyOpts = [
    { id: "renameVariables", label: "Rename Variables", desc: "Shorten local names" },
    { id: "smartRename", label: "Smart Rename", desc: "Semantic naming (v=game.Players→Players)" },
    { id: "renameGlobals", label: "Rename Globals", desc: "Shorten globals (risky)" },
    { id: "solveMath", label: "Solve Math", desc: "Pre-calculate expressions" },
    { id: "removeWhitespace", label: "Remove Whitespace", desc: "Strip all spaces" },
    { id: "removeComments", label: "Remove Comments", desc: "Strip comments" },
    { id: "removeStrings", label: "Remove Strings", desc: "Replace with placeholders" },
    { id: "convertNumberFormats", label: "Convert Numbers", desc: "Optimize number format" },
    { id: "compressStrings", label: "Compress Strings", desc: "Deduplicate string literals" },
  ];

  const activeOpts = mode === "beautify" ? beautifyOpts : minifyOpts;

  return (
    <motion.div className="min-h-screen bg-background" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <motion.header className="flex items-center justify-between mb-6" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 100 }}>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.5 }}>
              <Code2 className="h-10 w-10 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Lua Beautifier</h1>
              <p className="text-sm text-muted-foreground">Format & Minify Lua Code</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => history.length > 0 && setInputCode(history[history.length - 1])} disabled={history.length === 0} data-testid="button-undo">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => { setInputCode(""); setOutputCode(""); }} data-testid="button-clear">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <motion.div whileTap={{ scale: 0.95 }}>
              <Button size="icon" variant="outline" onClick={toggleDarkMode} data-testid="button-theme">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </motion.div>
          </div>
        </motion.header>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "beautify" | "minify" | "rename")} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-3">
                  <TabsTrigger value="beautify" className="gap-2">
                    <Maximize2 className="h-4 w-4" />
                    Beautify
                  </TabsTrigger>
                  <TabsTrigger value="minify" className="gap-2">
                    <Minimize2 className="h-4 w-4" />
                    Minify
                  </TabsTrigger>
                  <TabsTrigger value="rename" className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Rename
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="gap-2">
                <Settings2 className="h-4 w-4" />
                Options
                <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            </div>
          </motion.div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {activeOpts.map((opt) => (
                        <motion.div key={opt.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <Checkbox id={opt.id} checked={options[opt.id as keyof typeof options]} disabled={opt.id === "smartRename" && !options.renameVariables} onCheckedChange={(checked) => setOptions({ ...options, [opt.id]: !!checked })} data-testid={`checkbox-${opt.id}`} />
                          <div className="space-y-1">
                            <Label htmlFor={opt.id} className="cursor-pointer font-medium text-sm">
                              {opt.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </motion.div>
                      ))}

                      {mode === "beautify" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 md:col-span-2 lg:col-span-3">
                          <Label className="font-medium">Indent Size: {formatting.indentSize} spaces</Label>
                          <Slider value={[formatting.indentSize]} onValueChange={([val]) => setFormatting({ ...formatting, indentSize: val })} min={1} max={8} step={1} />
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {mode === "rename" ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Manual Renamer - Customize Variable Names</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(renameMap).length === 0 ? (
                  <p className="text-muted-foreground text-sm">First, analyze your code to detect variables (click the Rename button below)</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Object.entries(renameMap).map(([oldName, newName]) => (
                      <motion.div key={oldName} className="flex gap-2 items-center p-3 bg-muted/30 rounded-lg" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                        <span className="font-mono text-sm text-muted-foreground min-w-20">{oldName}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <input type="text" value={newName} onChange={(e) => setRenameMap({ ...renameMap, [oldName]: e.target.value })} className="flex-1 px-2 py-1 rounded border border-input bg-background text-sm" placeholder="New name" data-testid={`input-rename-${oldName}`} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Input</CardTitle>
                  </div>
                  <input type="file" accept=".lua,.txt" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <Button size="icon" variant="ghost" onClick={() => document.getElementById("file-upload")?.click()}>
                    <Upload className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <motion.div className="h-[450px] border-t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    <Editor height="100%" defaultLanguage="lua" value={inputCode} onChange={(value) => setInputCode(value || "")} theme={darkMode ? "vs-dark" : "light"} options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 16, bottom: 16 } }} />
                  </motion.div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Output</CardTitle>
                  </div>
                  {outputCode && (
                    <motion.div className="flex gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Button size="icon" variant="ghost" onClick={downloadCode} data-testid="button-download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant={copied ? "default" : "ghost"} onClick={copyToClipboard}>
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </motion.div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <motion.div className="h-[450px] border-t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <Editor height="100%" defaultLanguage="lua" value={outputCode || "// Output appears here..."} theme={darkMode ? "vs-dark" : "light"} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 16, bottom: 16 } }} />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 mt-8">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="lg" onClick={handleProcess} disabled={isLoading || !inputCode.trim()} className="px-16 py-6 text-lg font-semibold">
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    Processing...
                  </motion.div>
                ) : (
                  <div className="flex items-center gap-2">
                    {mode === "beautify" ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
                    {mode === "beautify" ? "Beautify" : "Minify"}
                  </div>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.footer className="mt-16 text-center text-sm text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            Powered by lua-format with smart analysis
          </p>
        </motion.footer>
      </div>
    </motion.div>
  );
}

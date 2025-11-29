import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Wand2, Code2, Moon, Sun, Download, Upload, Trash2, RotateCcw,
  Settings2, FileCode, Sparkles, CheckCircle2, ChevronDown, Minimize2, Maximize2, Pencil,
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
  const [mode, setMode] = useState<"minify" | "beautify">("minify");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // Beautify states
  const [detectedVars, setDetectedVars] = useState<Array<{ old: string; detected: string }>>([]);

  const [options, setOptions] = useState({
    renameVariables: false,
    renameGlobals: false,
    solveMath: false,
    removeWhitespace: true,
    removeComments: true,
    convertNumberFormats: true,
    compressStrings: false,
    removeBlankLines: true,
    normalizeQuotes: false,
    sortTableFields: false,
  });

  // Beautify specific options
  const [beautifyOptions, setBeautifyOptions] = useState({
    removeComments: false,
    removePrints: false,
    solveMath: false,
    renameVariables: true,
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

  const detectAndRename = async () => {
    if (!inputCode.trim()) {
      toast({ title: "Error", description: "Please enter code", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      let result = inputCode;
      
      // Get variable mappings if renaming is enabled
      if (beautifyOptions.renameVariables) {
        try {
          const detectResponse = await fetch("/api/detect-vars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: inputCode }),
          });
          const detectData = await detectResponse.json();
          
          // Apply variable renames
          if (detectData.variables && detectData.variables.length > 0) {
            for (const v of detectData.variables) {
              const regex = new RegExp(`\\b${v.old}\\b`, "g");
              result = result.replace(regex, v.detected);
            }
          }
        } catch (e) {
          // If detection fails, continue with just beautify
        }
      }
      
      // Apply beautify with selected options
      const response = await fetch("/beautify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: result, 
          options: beautifyOptions
        }),
      });
      
      const data = await response.json();
      if (data.result) {
        setOutputCode(data.result);
        toast({ title: "Beautified!", description: "Done" });
      } else {
        toast({ title: "Error", description: "Failed to beautify", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to process code", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!inputCode.trim()) {
      toast({ title: "Error", description: "Please enter some Lua code", variant: "destructive" });
      return;
    }

    setHistory((prev) => [...prev.slice(-9), inputCode]);

    if (mode === "beautify") {
      await detectAndRename();
    } else {
      setIsLoading(true);
      try {
        const response = await fetch("/minify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inputCode, options: { ...options, ...formatting } }),
        });

        const data = await response.json();
        if (response.ok) {
          setOutputCode(data.result);
          toast({
            title: "Minified Successfully!",
            description: `Reduced by ${Math.round((1 - data.result.length / inputCode.length) * 100)}%`,
          });
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Connection Error", description: "Failed to connect", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
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
    a.download = mode === "minify" ? "minified.lua" : "beautified.lua";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded file` });
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
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.08,
        delayChildren: 0.1,
      } 
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: "spring", 
        stiffness: 120,
        damping: 14,
      } 
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
    hover: {
      y: -2,
      transition: { type: "spring", stiffness: 300, damping: 10 },
    },
  };

  const beautifyOpts = [
    { id: "removeComments", label: "Remove Comments", desc: "Strip comment lines" },
    { id: "removePrints", label: "Remove Prints/Warns", desc: "Strip print() and warn() calls" },
    { id: "solveMath", label: "Solve Math", desc: "Pre-calculate expressions" },
    { id: "renameVariables", label: "Rename Variables", desc: "Rename variables semantically" },
  ];

  const minifyOpts = [
    { id: "renameVariables", label: "Rename Variables", desc: "Shorten local names" },
    { id: "renameGlobals", label: "Rename Globals", desc: "Shorten globals (risky)" },
    { id: "solveMath", label: "Solve Math", desc: "Pre-calculate expressions" },
    { id: "removeWhitespace", label: "Remove Whitespace", desc: "Strip all spaces" },
    { id: "removeComments", label: "Remove Comments", desc: "Strip comments" },
    { id: "convertNumberFormats", label: "Convert Numbers", desc: "Optimize number format" },
    { id: "compressStrings", label: "Compress Strings", desc: "Deduplicate string literals" },
  ];

  const activeOpts = mode === "beautify" ? beautifyOpts : minifyOpts;

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <motion.header 
          className="flex items-center justify-between mb-8 pb-4 border-b border-border/40" 
          initial={{ y: -30, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 360, scale: 1.15 }} 
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.6, type: "spring" }}
            >
              <Code2 className="h-10 w-10 text-primary" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: 0.1, type: "spring" }}
            >
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">Lua Beautifier</h1>
              <p className="text-sm text-muted-foreground">Professional Lua code formatter & minifier</p>
            </motion.div>
          </div>

          <motion.div 
            className="flex items-center gap-2" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.2 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => history.length > 0 && setInputCode(history[history.length - 1])} 
                    disabled={history.length === 0} 
                    data-testid="button-undo"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => { setInputCode(""); setOutputCode(""); }} 
                    data-testid="button-clear"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={toggleDarkMode} 
                    data-testid="button-theme"
                  >
                    {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>{darkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
            </Tooltip>
          </motion.div>
        </motion.header>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Tabs 
                  value={mode} 
                  onValueChange={(v) => { setMode(v as "minify" | "beautify"); setDetectedVars([]); }} 
                  className="w-full sm:w-auto"
                >
                  <TabsList className="grid w-full sm:w-auto grid-cols-2 gap-1">
                    <motion.div 
                      whileHover={{ scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      className="w-full"
                    >
                      <TabsTrigger value="minify" className="gap-2 w-full">
                        <Minimize2 className="h-4 w-4" />
                        Minify
                      </TabsTrigger>
                    </motion.div>
                    <motion.div 
                      whileHover={{ scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      className="w-full"
                    >
                      <TabsTrigger value="beautify" className="gap-2 w-full">
                        <Sparkles className="h-4 w-4" />
                        Beautify
                      </TabsTrigger>
                    </motion.div>
                  </TabsList>
                </Tabs>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAdvanced(!showAdvanced)} 
                  className="gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  Options
                  <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {showAdvanced && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: "auto", opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                transition={{ duration: 0.35, ease: "easeInOut" }} 
                className="overflow-hidden mb-6"
              >
                <motion.div variants={cardVariants} initial="hidden" animate="visible">
                  <Card className="border-border/60 shadow-sm">
                    <CardContent className="pt-6">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {activeOpts.map((opt, idx) => (
                          <motion.div 
                            key={opt.id} 
                            className="flex items-start space-x-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" 
                            whileHover={{ scale: 1.02, y: -2 }} 
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            <Checkbox 
                              id={opt.id} 
                              checked={mode === "beautify" ? beautifyOptions[opt.id as keyof typeof beautifyOptions] : options[opt.id as keyof typeof options]} 
                              disabled={opt.id === "smartRename" && !options.renameVariables} 
                              onCheckedChange={(checked) => mode === "beautify" ? setBeautifyOptions({ ...beautifyOptions, [opt.id]: !!checked }) : setOptions({ ...options, [opt.id]: !!checked })} 
                              data-testid={`checkbox-${opt.id}`} 
                            />
                            <div className="space-y-1">
                              <Label htmlFor={opt.id} className="cursor-pointer font-medium text-sm">
                                {opt.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {showAdvanced && mode === "beautify" && detectedVars.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: "auto", opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                transition={{ duration: 0.35 }} 
                className="overflow-hidden mb-6"
              >
                <motion.div variants={cardVariants} initial="hidden" animate="visible">
                  <Card className="border-border/60 shadow-sm bg-gradient-to-br from-muted/40 to-muted/20">
                    <CardContent className="pt-6">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        <Label className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Detected Variables & Functions
                        </Label>
                        {detectedVars.map((v, idx) => (
                          <motion.div 
                            key={v.old} 
                            className="flex gap-2 items-center text-sm p-2 bg-muted/40 rounded hover:bg-muted/60 transition-colors"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                          >
                            <span className="font-mono min-w-24 text-muted-foreground">{v.old}</span>
                            <span className="text-primary">→</span>
                            <span className="font-semibold text-primary">{v.detected}</span>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={cardVariants} whileHover="hover">
              <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
                      <FileCode className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                    <CardTitle className="text-lg">Input</CardTitle>
                  </div>
                  <input type="file" accept=".lua,.txt" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => document.getElementById("file-upload")?.click()}
                      data-testid="button-upload"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </CardHeader>
                <CardContent className="p-0">
                  <motion.div 
                    className="h-[450px] border-t" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <Editor 
                      height="100%" 
                      defaultLanguage="lua" 
                      value={inputCode} 
                      onChange={(value) => setInputCode(value || "")} 
                      theme={darkMode ? "vs-dark" : "light"} 
                      options={{ 
                        minimap: { enabled: false }, 
                        fontSize: 14, 
                        lineNumbers: "on", 
                        scrollBeyondLastLine: false, 
                        wordWrap: "on", 
                        padding: { top: 16, bottom: 16 },
                        smoothScrolling: true,
                      }} 
                    />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} whileHover="hover">
              <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                    <CardTitle className="text-lg">Output</CardTitle>
                  </div>
                  {outputCode && (
                    <motion.div 
                      className="flex gap-1" 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={downloadCode} 
                          data-testid="button-download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                        <Button 
                          size="icon" 
                          variant={copied ? "default" : "ghost"} 
                          onClick={copyToClipboard}
                          data-testid="button-copy"
                        >
                          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <motion.div 
                    className="h-[450px] border-t" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    <Editor 
                      height="100%" 
                      defaultLanguage="lua" 
                      value={outputCode || "// Output appears here..."} 
                      theme={darkMode ? "vs-dark" : "light"} 
                      options={{ 
                        readOnly: true, 
                        minimap: { enabled: false }, 
                        fontSize: 14, 
                        lineNumbers: "on", 
                        scrollBeyondLastLine: false, 
                        wordWrap: "on", 
                        padding: { top: 16, bottom: 16 },
                        smoothScrolling: true,
                      }} 
                    />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col items-center gap-6 mt-12">
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Button 
                size="lg" 
                onClick={handleProcess} 
                disabled={isLoading || !inputCode.trim()} 
                className="px-16 py-6 text-lg font-semibold gap-2"
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    Processing...
                  </motion.div>
                ) : (
                  <div className="flex items-center gap-2">
                    {mode === "minify" ? <Minimize2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    {mode === "minify" ? "Minify Code" : "Beautify Code"}
                  </div>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.footer 
          className="mt-20 text-center text-sm text-muted-foreground border-t border-border/40 pt-8" 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <p className="flex items-center justify-center gap-2">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
              <Sparkles className="h-4 w-4" />
            </motion.div>
            Powered by lua-format with advanced semantic analysis
          </p>
        </motion.footer>
      </div>
    </motion.div>
  );
}

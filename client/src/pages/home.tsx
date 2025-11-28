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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Wand2,
  Code2,
  Moon,
  Sun,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Settings2,
  FileCode,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Minimize2,
  Maximize2,
} from "lucide-react";

const DEFAULT_CODE = `-- Paste your messy Lua code here!
-- Click Beautify to format it nicely

local function greet(name)
local message="Hello, "..name.."!"
print(message)
return message
end

local function calculate(a,b)
local sum=a+b
local product=a*b
return sum,product
end

greet("World")
local s,p=calculate(10,20)
print("Sum:",s,"Product:",p)
`;

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [mode, setMode] = useState<"beautify" | "minify">("beautify");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const [options, setOptions] = useState({
    renameVariables: false,
    renameGlobals: false,
    solveMath: false,
    smartRename: false,
  });

  const [formatting, setFormatting] = useState({
    indentSize: 2,
    useTabs: false,
  });

  const { toast } = useToast();

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      const isDark = savedDarkMode === "true";
      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    }
  }, []);

  const handleProcess = async () => {
    if (!inputCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter some Lua code",
        variant: "destructive",
      });
      return;
    }

    setHistory((prev) => [...prev.slice(-9), inputCode]);
    setIsLoading(true);

    try {
      const endpoint = mode === "beautify" ? "/beautify" : "/minify";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: inputCode, 
          options: {
            ...options,
            ...formatting,
          }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setOutputCode(data.result);
        const action = mode === "beautify" ? "Beautified" : "Minified";
        toast({
          title: `${action} Successfully!`,
          description: mode === "beautify" 
            ? `Formatted ${inputCode.split('\n').length} lines of code`
            : `Reduced ${inputCode.length} → ${data.result.length} chars`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to process code",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!outputCode) return;
    await navigator.clipboard.writeText(outputCode);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
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
      const content = event.target?.result as string;
      setInputCode(content);
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

  const clearAll = () => {
    setInputCode("");
    setOutputCode("");
    toast({ title: "Cleared" });
  };

  const undoLast = () => {
    if (history.length > 0) {
      setInputCode(history[history.length - 1]);
      setHistory((prev) => prev.slice(0, -1));
      toast({ title: "Restored previous code" });
    }
  };

  const stats = {
    inputLines: inputCode.split("\n").length,
    inputChars: inputCode.length,
    outputLines: outputCode.split("\n").length,
    outputChars: outputCode.length,
    reduction: outputCode && inputCode
      ? Math.round((1 - outputCode.length / inputCode.length) * 100)
      : 0,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <motion.div
      className="min-h-screen bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <motion.header
          className="flex items-center justify-between mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <Code2 className="h-10 w-10 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Lua Beautifier
              </h1>
              <p className="text-sm text-muted-foreground">
                Format & Minify Lua Code
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={undoLast}
                  disabled={history.length === 0}
                  data-testid="button-undo"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={clearAll}
                  data-testid="button-clear"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear All</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="icon"
                variant="outline"
                onClick={toggleDarkMode}
                data-testid="button-theme-toggle"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={darkMode ? "dark" : "light"}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {darkMode ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Button>
            </motion.div>
          </div>
        </motion.header>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "beautify" | "minify")} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="beautify" className="gap-2" data-testid="tab-beautify">
                    <Maximize2 className="h-4 w-4" />
                    Beautify
                  </TabsTrigger>
                  <TabsTrigger value="minify" className="gap-2" data-testid="tab-minify">
                    <Minimize2 className="h-4 w-4" />
                    Minify
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="gap-2"
                data-testid="button-toggle-options"
              >
                <Settings2 className="h-4 w-4" />
                Options
                <motion.div
                  animate={{ rotate: showAdvanced ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            </div>
          </motion.div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden mb-6"
              >
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Optimization
                        </h3>
                        <div className="space-y-3">
                          {[
                            {
                              id: "renameVariables",
                              label: "Rename Variables",
                              desc: "Shorten local variable names",
                            },
                            {
                              id: "smartRename",
                              label: "Smart Rename",
                              desc: "Use semantic names (v=game.Players → Players)",
                              minifyOnly: true,
                            },
                            {
                              id: "renameGlobals",
                              label: "Rename Globals",
                              desc: "Shorten global names (risky)",
                            },
                            {
                              id: "solveMath",
                              label: "Solve Math",
                              desc: "Pre-calculate constant expressions",
                            },
                          ]
                            .filter((opt) => !("minifyOnly" in opt) || mode === "minify")
                            .map((opt) => (
                              <motion.div
                                key={opt.id}
                                className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                              >
                                <Checkbox
                                  id={opt.id}
                                  checked={options[opt.id as keyof typeof options]}
                                  disabled={
                                    opt.id === "smartRename" && !options.renameVariables
                                  }
                                  onCheckedChange={(checked) =>
                                    setOptions({ ...options, [opt.id]: !!checked })
                                  }
                                  data-testid={`checkbox-${opt.id}`}
                                />
                                <div className="space-y-1">
                                  <Label htmlFor={opt.id} className="cursor-pointer font-medium">
                                    {opt.label}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </div>

                      {mode === "beautify" && (
                        <div className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Code2 className="h-4 w-4" />
                            Formatting
                          </h3>
                          <div className="space-y-6 p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="font-medium">Use Tabs</Label>
                                <p className="text-xs text-muted-foreground">
                                  Use tabs instead of spaces
                                </p>
                              </div>
                              <Switch
                                checked={formatting.useTabs}
                                onCheckedChange={(checked) =>
                                  setFormatting({ ...formatting, useTabs: checked })
                                }
                                data-testid="switch-use-tabs"
                              />
                            </div>

                            {!formatting.useTabs && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <Label className="font-medium">
                                    Indent Size: {formatting.indentSize} spaces
                                  </Label>
                                </div>
                                <Slider
                                  value={[formatting.indentSize]}
                                  onValueChange={([val]) =>
                                    setFormatting({ ...formatting, indentSize: val })
                                  }
                                  min={1}
                                  max={8}
                                  step={1}
                                  data-testid="slider-indent-size"
                                />
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Input</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {stats.inputLines} lines
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <input
                    type="file"
                    accept=".lua,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => document.getElementById("file-upload")?.click()}
                        data-testid="button-upload"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload File</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <motion.div
                  className="h-[450px] border-t"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
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
                      fontFamily: "JetBrains Mono, monospace",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      padding: { top: 16, bottom: 16 },
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                    }}
                  />
                </motion.div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Output</CardTitle>
                  {outputCode && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Badge variant="secondary" className="ml-2">
                        {stats.outputLines} lines
                      </Badge>
                    </motion.div>
                  )}
                </div>
                {outputCode && (
                  <motion.div
                    className="flex gap-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={downloadCode}
                          data-testid="button-download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={copied ? "default" : "ghost"}
                          onClick={copyToClipboard}
                          data-testid="button-copy-output"
                        >
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={copied ? "check" : "copy"}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              {copied ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <motion.div
                  className="h-[450px] border-t"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Editor
                    height="100%"
                    defaultLanguage="lua"
                    value={outputCode || "-- Formatted code will appear here..."}
                    theme={darkMode ? "vs-dark" : "light"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: "JetBrains Mono, monospace",
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

          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center gap-4 mt-8"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                onClick={handleProcess}
                disabled={isLoading || !inputCode.trim()}
                className="px-16 py-6 text-lg font-semibold shadow-lg"
                data-testid="button-process"
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Wand2 className="h-5 w-5" />
                      </motion.div>
                      Processing...
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      {mode === "beautify" ? (
                        <>
                          <Wand2 className="h-5 w-5" />
                          Beautify Code
                        </>
                      ) : (
                        <>
                          <Minimize2 className="h-5 w-5" />
                          Minify Code
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>

            {outputCode && mode === "minify" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-6 text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.inputChars}</span>
                  <span>→</span>
                  <span className="font-medium text-primary">{stats.outputChars}</span>
                  <span>characters</span>
                  {stats.reduction > 0 && (
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {stats.reduction}% smaller
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        <motion.footer
          className="mt-16 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            Powered by lua-format
          </p>
        </motion.footer>
      </div>
    </motion.div>
  );
}

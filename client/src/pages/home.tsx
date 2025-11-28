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
  Zap,
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
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const DEFAULT_CODE = `-- Welcome to Luamin!
-- Paste your Lua code here and click Minify

local function greet(name)
    local message = "Hello, " .. name .. "!"
    print(message)
    return message
end

local function calculate(a, b)
    local sum = a + b
    local product = a * b
    return sum, product
end

-- Call the functions
greet("World")
local s, p = calculate(10, 20)
print("Sum:", s, "Product:", p)
`;

export default function Home() {
  const [inputCode, setInputCode] = useState(DEFAULT_CODE);
  const [outputCode, setOutputCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState("minify");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const [options, setOptions] = useState({
    renameVariables: true,
    renameGlobals: false,
    solveMath: false,
    removeComments: true,
    removeWhitespace: true,
    shortenNumbers: true,
    optimizeStrings: false,
    inlineLocals: false,
  });

  const [formatting, setFormatting] = useState({
    indentSize: 2,
    useTabs: false,
    maxLineLength: 80,
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

  const handleMinify = async () => {
    if (!inputCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter some Lua code to minify",
        variant: "destructive",
      });
      return;
    }

    setHistory((prev) => [...prev.slice(-9), inputCode]);
    setIsLoading(true);

    try {
      const response = await fetch("/minify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode, options }),
      });

      const data = await response.json();

      if (response.ok) {
        setOutputCode(data.result);
        toast({
          title: "Minified Successfully",
          description: `Reduced ${inputCode.length} → ${data.result.length} chars (${Math.round((1 - data.result.length / inputCode.length) * 100)}% smaller)`,
        });
      } else {
        toast({
          title: "Minification Error",
          description: data.error || "Failed to minify code",
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
    a.download = "minified.lua";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded minified.lua" });
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
    reduction: outputCode
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
                Luamin
              </h1>
              <p className="text-sm text-muted-foreground">
                Lua Code Minifier & Optimizer
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
          <motion.div variants={itemVariants}>
            <Card className="mb-6 overflow-hidden">
              <CardHeader
                className="pb-3 cursor-pointer"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Options
                  </CardTitle>
                  <motion.div
                    animate={{ rotate: showAdvanced ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                </div>
              </CardHeader>

              <AnimatePresence>
                <motion.div
                  initial={false}
                  animate={{
                    height: showAdvanced ? "auto" : 0,
                    opacity: showAdvanced ? 1 : 0,
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <CardContent className="pt-0">
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger value="basic">Basic</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        <TabsTrigger value="formatting">Formatting</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            {
                              id: "renameVariables",
                              label: "Rename Variables",
                              desc: "Shorten local variable names",
                            },
                            {
                              id: "removeComments",
                              label: "Remove Comments",
                              desc: "Strip all comments",
                            },
                            {
                              id: "removeWhitespace",
                              label: "Remove Whitespace",
                              desc: "Eliminate unnecessary spaces",
                            },
                            {
                              id: "shortenNumbers",
                              label: "Shorten Numbers",
                              desc: "Optimize number formats",
                            },
                          ].map((opt) => (
                            <motion.div
                              key={opt.id}
                              className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Checkbox
                                id={opt.id}
                                checked={
                                  options[opt.id as keyof typeof options] as boolean
                                }
                                onCheckedChange={(checked) =>
                                  setOptions({ ...options, [opt.id]: !!checked })
                                }
                                data-testid={`checkbox-${opt.id}`}
                              />
                              <div className="space-y-1">
                                <Label
                                  htmlFor={opt.id}
                                  className="cursor-pointer font-medium"
                                >
                                  {opt.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {opt.desc}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="advanced">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            {
                              id: "renameGlobals",
                              label: "Rename Globals",
                              desc: "Shorten global names (risky)",
                            },
                            {
                              id: "solveMath",
                              label: "Solve Math",
                              desc: "Pre-calculate constants",
                            },
                            {
                              id: "optimizeStrings",
                              label: "Optimize Strings",
                              desc: "Deduplicate string literals",
                            },
                            {
                              id: "inlineLocals",
                              label: "Inline Locals",
                              desc: "Inline single-use variables",
                            },
                          ].map((opt) => (
                            <motion.div
                              key={opt.id}
                              className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Checkbox
                                id={opt.id}
                                checked={
                                  options[opt.id as keyof typeof options] as boolean
                                }
                                onCheckedChange={(checked) =>
                                  setOptions({ ...options, [opt.id]: !!checked })
                                }
                                data-testid={`checkbox-${opt.id}`}
                              />
                              <div className="space-y-1">
                                <Label
                                  htmlFor={opt.id}
                                  className="cursor-pointer font-medium"
                                >
                                  {opt.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {opt.desc}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="formatting">
                        <div className="space-y-6">
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

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">
                                Indent Size: {formatting.indentSize}
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
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">
                                Max Line Length: {formatting.maxLineLength}
                              </Label>
                            </div>
                            <Slider
                              value={[formatting.maxLineLength]}
                              onValueChange={([val]) =>
                                setFormatting({ ...formatting, maxLineLength: val })
                              }
                              min={40}
                              max={200}
                              step={10}
                              data-testid="slider-max-line"
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </motion.div>
              </AnimatePresence>

              {!showAdvanced && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(options)
                      .filter(([, v]) => v)
                      .map(([key]) => (
                        <motion.div
                          key={key}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Badge variant="secondary" className="capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </Badge>
                        </motion.div>
                      ))}
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setShowAdvanced(true)}
                    >
                      + Configure
                    </Badge>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>

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
                    {stats.inputLines} lines • {stats.inputChars} chars
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
                        onClick={() =>
                          document.getElementById("file-upload")?.click()
                        }
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
                      className="flex items-center gap-2"
                    >
                      <Badge
                        variant={stats.reduction > 0 ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {stats.reduction > 0 ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {stats.reduction}% smaller
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
                      <TooltipContent>
                        {copied ? "Copied!" : "Copy"}
                      </TooltipContent>
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
                    value={outputCode || "// Minified code will appear here..."}
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
                onClick={handleMinify}
                disabled={isLoading || !inputCode.trim()}
                className="px-16 py-6 text-lg font-semibold shadow-lg"
                data-testid="button-minify"
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
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                      >
                        <Zap className="h-5 w-5" />
                      </motion.div>
                      Minifying...
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-5 w-5" />
                      Minify Code
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>

            {outputCode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-6 text-sm text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.inputChars}</span>
                  <span>→</span>
                  <span className="font-medium text-primary">
                    {stats.outputChars}
                  </span>
                  <span>characters</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.inputLines}</span>
                  <span>→</span>
                  <span className="font-medium text-primary">
                    {stats.outputLines}
                  </span>
                  <span>lines</span>
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
            Powered by luamin
          </p>
        </motion.footer>
      </div>
    </motion.div>
  );
}

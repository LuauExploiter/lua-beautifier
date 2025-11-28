import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Zap, Code2, Moon, Sun } from "lucide-react";

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
  const [options, setOptions] = useState({
    renameVariables: true,
    renameGlobals: false,
    solveMath: false,
  });
  const { toast } = useToast();

  const handleMinify = async () => {
    if (!inputCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter some Lua code to minify",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/minify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setOutputCode(data.result);
        toast({
          title: "Success",
          description: `Minified! Reduced from ${inputCode.length} to ${data.result.length} characters`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to minify code",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
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
    toast({
      title: "Copied!",
      description: "Minified code copied to clipboard",
    });
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const compressionRatio = outputCode
    ? Math.round((1 - outputCode.length / inputCode.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Code2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Luamin</h1>
              <p className="text-sm text-muted-foreground">Lua Code Minifier</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={toggleDarkMode}
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="renameVariables"
                  checked={options.renameVariables}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, renameVariables: !!checked })
                  }
                  data-testid="checkbox-rename-variables"
                />
                <Label htmlFor="renameVariables" className="cursor-pointer">
                  Rename local variables
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="renameGlobals"
                  checked={options.renameGlobals}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, renameGlobals: !!checked })
                  }
                  data-testid="checkbox-rename-globals"
                />
                <Label htmlFor="renameGlobals" className="cursor-pointer">
                  Rename globals
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="solveMath"
                  checked={options.solveMath}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, solveMath: !!checked })
                  }
                  data-testid="checkbox-solve-math"
                />
                <Label htmlFor="solveMath" className="cursor-pointer">
                  Solve constant math
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Input Code</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] border-t">
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
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Output Code</CardTitle>
              {outputCode && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {compressionRatio}% smaller
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyToClipboard}
                    data-testid="button-copy-output"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] border-t">
                <Editor
                  height="100%"
                  defaultLanguage="lua"
                  value={outputCode}
                  theme={darkMode ? "vs-dark" : "light"}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    padding: { top: 16, bottom: 16 },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center mt-6">
          <Button
            size="lg"
            onClick={handleMinify}
            disabled={isLoading}
            className="px-12"
            data-testid="button-minify"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⚡</span>
                Minifying...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Minify Code
              </>
            )}
          </Button>
        </div>

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>Powered by luamin</p>
        </footer>
      </div>
    </div>
  );
}

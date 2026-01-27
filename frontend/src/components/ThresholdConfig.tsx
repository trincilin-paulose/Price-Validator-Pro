import { useState } from 'react';
import { PriceThreshold } from '@/types/price';
import { DEFAULT_THRESHOLDS } from '@/utils/priceValidation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings2, RotateCcw, Key, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfigProps {
  thresholds: PriceThreshold;
  onThresholdsChange: (thresholds: PriceThreshold) => void;
}

export function ThresholdConfig({ thresholds, onThresholdsChange }: ThresholdConfigProps) {
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('openai_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');

  const handleChange = (key: keyof PriceThreshold, value: number) => {
    const updated = { ...localThresholds, [key]: value };
    setLocalThresholds(updated);
    onThresholdsChange(updated);
  };

  const handleReset = () => {
    setLocalThresholds(DEFAULT_THRESHOLDS);
    onThresholdsChange(DEFAULT_THRESHOLDS);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setApiKeyStatus('unchecked');
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('API key is required');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      toast.error('Invalid OpenAI API key format', {
        description: 'OpenAI API keys should start with "sk-"',
      });
      setApiKeyStatus('invalid');
      return;
    }

    sessionStorage.setItem('openai_api_key', apiKey);
    setApiKeyStatus('valid');
    toast.success('OpenAI API key saved successfully', {
      description: 'Your API key is stored securely in session storage',
    });
  };

  const handleClearApiKey = () => {
    sessionStorage.removeItem('openai_api_key');
    setApiKey('');
    setApiKeyStatus('unchecked');
    toast.success('API key cleared');
  };

  return (
    <div className="space-y-6">
      {/* API Key Configuration Card */}
      {/* <Card className="shadow-card animate-fade-in border-primary/20">
        <CardHeader className="pb-4 bg-primary/5">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">OpenAI API Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure your OpenAI API key for ChatGPT-powered price extraction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Alert className="border-primary/20 bg-primary/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm">
              Your OpenAI API key is required to fetch real competitor prices directly from websites using ChatGPT.
              The key is stored securely in your browser's session storage.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="openai-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="pr-10"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button onClick={handleSaveApiKey} className="px-4">
                Save Key
              </Button>
              {apiKey && (
                <Button variant="outline" onClick={handleClearApiKey}>
                  Clear
                </Button>
              )}
            </div>
            {apiKeyStatus === 'valid' && (
              <p className="text-sm text-success flex items-center gap-1 mt-1">
                <CheckCircle className="h-4 w-4" />
                API key is configured and ready
              </p>
            )}
            {apiKeyStatus === 'invalid' && (
              <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="h-4 w-4" />
                Invalid API key format
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Getting your API key:</strong>
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.openai.com/api-keys</a></li>
              <li>Sign in or create an OpenAI account</li>
              <li>Create a new API key</li>
              <li>Copy and paste it here</li>
            </ol>
          </div>

          <Alert className="bg-info/5 border-info/20">
            <AlertTriangle className="h-4 w-4 text-info" />
            <AlertDescription className="text-sm">
              Alternatively, set the environment variable <code className="bg-muted px-2 py-1 rounded text-xs font-mono">VITE_OPENAI_API_KEY</code> for production deployments.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card> */}

      {/* Pricing Thresholds Card */}
      <Card className="shadow-card animate-fade-in">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Validation Thresholds</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          <CardDescription>
            Configure pricing thresholds to customize validation rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minDiscount">Min Discount (%)</Label>
                  <span className="text-sm font-medium text-primary">{localThresholds.minDiscount}%</span>
                </div>
                <Slider
                  id="minDiscount"
                  value={[localThresholds.minDiscount]}
                  onValueChange={([v]) => handleChange('minDiscount', v)}
                  min={0}
                  max={30}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxDiscount">Max Discount (%)</Label>
                  <span className="text-sm font-medium text-primary">{localThresholds.maxDiscount}%</span>
                </div>
                <Slider
                  id="maxDiscount"
                  value={[localThresholds.maxDiscount]}
                  onValueChange={([v]) => handleChange('maxDiscount', v)}
                  min={20}
                  max={80}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minMargin">Min Profit Margin (%)</Label>
                  <span className="text-sm font-medium text-primary">{localThresholds.minMargin}%</span>
                </div>
                <Slider
                  id="minMargin"
                  value={[localThresholds.minMargin]}
                  onValueChange={([v]) => handleChange('minMargin', v)}
                  min={5}
                  max={1}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxMargin">Max Profit Margin (%)</Label>
                  <span className="text-sm font-medium text-primary">{localThresholds.maxMargin}%</span>
                </div>
                <Slider
                  id="maxMargin"
                  value={[localThresholds.maxMargin]}
                  onValueChange={([v]) => handleChange('maxMargin', v)}
                  min={1}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowPrice">Low Price Threshold ($)</Label>
                <Input
                  id="lowPrice"
                  type="number"
                  value={localThresholds.lowPriceThreshold}
                  onChange={(e) => handleChange('lowPriceThreshold', parseFloat(e.target.value) || 0)}
                  min={0}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="highPrice">High Price Threshold ($)</Label>
                <Input
                  id="highPrice"
                  type="number"
                  value={localThresholds.highPriceThreshold}
                  onChange={(e) => handleChange('highPriceThreshold', parseFloat(e.target.value) || 0)}
                  min={0}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

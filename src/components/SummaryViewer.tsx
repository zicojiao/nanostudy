/// <reference types="dom-chromium-ai" />
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~components/ui/card";
import { Button } from "~components/ui/button";
import { Badge } from "~components/ui/badge";
import { FileText, Loader2, Sparkles, Copy } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Progress } from "~components/ui/progress";
import { Textarea } from "~components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~components/ui/select";

export const SummaryViewer: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [summaryType, setSummaryType] = useState<"key-points" | "tldr" | "teaser" | "headline">("key-points");
  const [summaryLength, setSummaryLength] = useState<"short" | "medium" | "long">("medium");
  const [summarizer, setSummarizer] = useState<any>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkAvailability();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('selectedText', (result) => {
        if (result.selectedText) {
          setInputText(result.selectedText);
          chrome.storage.local.remove('selectedText');
        }
      });
      const handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local' && changes.selectedText && changes.selectedText.newValue) {
          setInputText(changes.selectedText.newValue);
          chrome.storage.local.remove('selectedText');
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  useEffect(() => {
    // Reset summarizer when type or length changes
    if (summarizer) {
      setSummarizer(null);
      setSummary("");
    }
  }, [summaryType, summaryLength, summarizer]);

  const checkAvailability = async () => {
    try {
      if (!('Summarizer' in self)) {
        setIsAvailable(false);
        setStatus("Summarizer API is not available in this browser.");
        return;
      }
      const availability = await Summarizer.availability();
      setIsAvailable(availability === 'available' || availability === 'downloadable' || availability === 'downloading');
      if (availability === 'unavailable') {
        setStatus("Summarizer API is not available. Check your browser settings.");
      }
    } catch (error) {
      setIsAvailable(false);
      setStatus("Failed to check Summarizer API availability.");
    }
  };

  const createSummarizer = async () => {
    if (!('Summarizer' in self)) {
      setStatus("Summarizer API is not supported.");
      return null;
    }

    try {
      if (!navigator.userActivation.isActive) {
        setStatus("Please interact with the page first (click, type, etc.) to activate the API.");
        return null;
      }

      const availability = await Summarizer.availability();
      if (availability === 'unavailable') {
        setStatus("Summarizer API is not available.");
        return null;
      }

      const newSummarizer = await Summarizer.create({
        type: summaryType,
        format: 'markdown',
        length: summaryLength,
        sharedContext: 'This is educational content for students. Focus on learning value and clarity.',
        monitor(m: any) {
          m.addEventListener('downloadprogress', (e: any) => {
            const progress = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setDownloadProgress(progress);
          });
        }
      });

      return newSummarizer;
    } catch (error: any) {
      setStatus("Failed to create summarizer: " + error.message);
      return null;
    }
  };

  const handleGenerateSummary = async () => {
    if (!inputText.trim()) {
      setStatus("Please enter some text to summarize");
      return;
    }

    setSummary("");
    setIsProcessing(true);
    setDownloadProgress(0);
    setStatus("Initializing Summarizer API...");

    try {
      // Create summarizer if not exists or if config changed
      // Always recreate to ensure correct type/length configuration
      let currentSummarizer = await createSummarizer();
      if (!currentSummarizer) {
        setIsProcessing(false);
        return;
      }
      setSummarizer(currentSummarizer);

      setStatus("Generating summary...");
      
      // Use streaming summarization for real-time feedback
      const stream = currentSummarizer.summarizeStreaming(inputText, {
        context: 'This is educational content. Focus on key learning points and concepts.'
      });

      let accumulatedText = "";
      let lastFullText = "";
      const reader = stream.getReader();
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            // Stream ended - ensure we display the final result
            if (accumulatedText && accumulatedText.trim()) {
              setSummary(accumulatedText);
            }
            break;
          }
          
          if (value && typeof value === 'string') {
            // Check if this is a cumulative chunk (contains previous content) or incremental
            if (value.includes(lastFullText) && value.length > lastFullText.length) {
              // Cumulative: contains previous content plus new content
              accumulatedText = value;
              lastFullText = value;
            } else if (lastFullText && value.startsWith(lastFullText)) {
              // Also cumulative: new chunk starts with previous
              accumulatedText = value;
              lastFullText = value;
            } else {
              // Incremental: just new text, append it
              accumulatedText += value;
              lastFullText = accumulatedText;
            }
            
            // Always update display with accumulated text
            if (accumulatedText && accumulatedText.trim()) {
              setSummary(accumulatedText);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      // Set final result
      const finalResult = accumulatedText;

      // Ensure final result is set
      if (finalResult && finalResult.trim()) {
        setSummary(finalResult);
        setStatus("Summary generated successfully!");
        console.log("Summary generated, length:", finalResult.length);
      } else {
        setStatus("Generated summary is empty. Please try again.");
        console.error("Summarizer returned empty result. Final result:", finalResult);
        setSummary(""); // Clear empty result
      }
      setDownloadProgress(100);
    } catch (error: any) {
      console.error("Summary generation error:", error);
      setStatus("Error: " + (error.message || "Failed to generate summary"));
      setDownloadProgress(0);
      setSummary(""); // Clear any partial results
    } finally {
      setIsProcessing(false);
      setTimeout(() => setDownloadProgress(0), 2000);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Summary
            <Badge variant="outline">Chrome Built-in AI</Badge>
          </CardTitle>
          <CardDescription>
            Transform complex knowledge into clear summaries using Chrome's Summarizer API
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {/* Summary Type and Length Selection */}
          <div className="flex gap-2 mb-3">
            <Select value={summaryType} onValueChange={(value: any) => setSummaryType(value)} disabled={isProcessing}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key-points">Key Points</SelectItem>
                <SelectItem value="tldr">TL;DR</SelectItem>
                <SelectItem value="teaser">Teaser</SelectItem>
                <SelectItem value="headline">Headline</SelectItem>
              </SelectContent>
            </Select>
            <Select value={summaryLength} onValueChange={(value: any) => setSummaryLength(value)} disabled={isProcessing}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Length" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            className="w-full border border-slate-200/60 rounded-xl p-3 min-h-[150px] mb-2 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Paste text here to summarize..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isProcessing}
          />
          <div className="flex gap-2 mb-2">
            <Button onClick={handleGenerateSummary} disabled={isProcessing || !inputText.trim() || isAvailable === false} className="flex-1">
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Generate Summary</>
              )}
            </Button>
          </div>
          {status && <div className="text-xs text-slate-500 my-3">{status}</div>}
          {(downloadProgress > 0 && downloadProgress < 100) && (
            <div className="mb-2">
              <div className="text-xs text-slate-500 mb-1">Downloading model... {downloadProgress}%</div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
          {summary ? (
            <div className="space-y-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(summary)}
                  className="absolute top-2 right-2 h-6 px-2 z-10"
                  title="Copy to Clipboard"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <div className="prose prose-sm max-w-none p-5 bg-gradient-to-br from-slate-50/80 to-white rounded-xl border border-slate-200/60 custom-scrollbar max-h-96 overflow-y-auto shadow-inner">
                  <ReactMarkdown
                    // remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-semibold text-slate-900 mb-3 leading-tight">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-medium text-slate-800 mb-2 leading-tight">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-medium text-slate-700 mb-2 leading-tight">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-slate-700 mb-3 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 ml-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 ml-2">{children}</ol>,
                      li: ({ children }) => <li className="text-sm text-slate-700 leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="font-medium text-slate-900">{children}</strong>,
                      em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3">{children}</blockquote>,
                      code: ({ children }) => <code className="bg-slate-200 px-1 py-0.5 rounded text-xs font-mono text-slate-800">{children}</code>,
                      pre: ({ children }) => <pre className="bg-slate-800 text-slate-100 p-3 rounded-md text-xs overflow-x-auto my-3">{children}</pre>,
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-slate-500">
              <p className="text-sm">Select text on any webpage and right click 'Generate Summary' to begin.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

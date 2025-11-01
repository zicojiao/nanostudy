/// <reference types="dom-chromium-ai" />
import React, { useState, useEffect } from "react"
import "~main.css"
import { Button } from "~components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~components/ui/card"
import { Badge } from "~components/ui/badge"
import { Separator } from "~components/ui/separator"
import { FileText, Brain, Settings, AlertCircle, CheckCircle2, Loader2, Languages, MessageCircle } from "lucide-react"
import { sendToBackground } from "@plasmohq/messaging"

import { QuizViewer } from "~components/QuizViewer"
import { TranslatorViewer } from "~components/TranslatorViewer"
import { AskAIViewer } from "~components/AskAIViewer"
import { SummaryViewer } from "~components/SummaryViewer"

const menuItems = [
  {
    key: "askai",
    label: "Ask AI",
    icon: MessageCircle,
    description: "AI-powered Q&A Assistant"
  },
  {
    key: "summary",
    label: "Summary",
    icon: FileText,
    description: "Content Summary & Analysis"
  },
  {
    key: "quiz",
    label: "Quiz",
    icon: Brain,
    description: "Interactive Quiz Generator"
  },
  {
    key: "translator",
    label: "Translator",
    icon: Languages,
    description: "AI-powered Translation"
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    description: "Personalization Settings"
  },
]

const Sidepanel = () => {
  const [active, setActive] = useState("askai")
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)

  // Check AI availability and set up storage listener on component mount
  useEffect(() => {
    checkAIStatus()

    // Listen for storage changes (when user uses context menu)
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.selectedText && changes.selectedText.newValue) {
        setActive("summary");
      } else if (changes.quizText && changes.quizText.newValue) {
        setActive("quiz");
      } else if (changes.translateText && changes.translateText.newValue) {
        setActive("translator");
      } else if (changes.askaiText && changes.askaiText.newValue) {
        setActive("askai");
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    // Cleanup listener on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const checkAIStatus = async () => {
    try {
      const result = await sendToBackground({
        name: "nanostudy",
        body: { type: "checkAIStatus" }
      })
      setAiAvailable(result.available)
    } catch (error) {
      console.error("Error checking AI status:", error)
      setAiAvailable(false)
    }
  }

  const contentMap = {
    askai: (
      <AskAIViewer />
    ),
    summary: (
      <SummaryViewer />
    ),
    quiz: (
      <QuizViewer />
    ),
    translator: (
      <TranslatorViewer />
    ),
    settings: (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </CardTitle>
          <CardDescription>
            AI status and configuration options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* AI Status */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                {aiAvailable === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                ) : aiAvailable ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">Chrome Built-in AI</span>
              </div>
              <Badge variant={aiAvailable ? "default" : "destructive"}>
                {aiAvailable === null ? "Checking..." : aiAvailable ? "Available" : "Unavailable"}
              </Badge>
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <p>• Powered by Chrome's Built-in AI</p>
              <p>• Requires Chrome 138+ with AI features enabled</p>
              <p>• All processing happens locally for privacy</p>
            </div>

            <Button onClick={checkAIStatus} variant="outline" className="w-full">
              Refresh AI Status
            </Button>
          </div>
        </CardContent>
      </Card>
    ),
  }

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Sidebar */}
      <div className="flex flex-col w-16 bg-white/80 backdrop-blur-sm border-r border-slate-200/60 shadow-lg shadow-slate-900/5 py-6">
        <div className="flex flex-col space-y-2 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <div key={item.key} className="relative">
                {isActive && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                )}
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="icon"
                  className={`h-12 w-12 p-0 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                      : "hover:bg-accent hover:scale-105 text-slate-600 hover:text-primary"
                  }`}
                  onClick={() => setActive(item.key)}
                  title={item.description}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>
            )
          })}
        </div>
        <Separator className="my-6" />
        <div className="flex-1" />
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-2xl h-full flex flex-col gap-6">
          {contentMap[active as keyof typeof contentMap]}
        </div>
      </div>
    </div>
  )
}

export default Sidepanel

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "~components/ui/card";
import { Textarea } from "~components/ui/textarea";
import { Button } from "~components/ui/button";
import { Progress } from "~components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "~components/ui/alert";
import { Badge } from "~components/ui/badge";
import { Skeleton } from "~components/ui/skeleton";
import { Loader2, AlertCircle, CheckCircle2, Download, MessageCircle, Image as ImageIcon, X, Camera } from "lucide-react";
import ReactMarkdown from 'react-markdown';

const SYSTEM_PROMPT = "You are a helpful and patient AI teacher. Answer the user's questions in a clear and concise way.";
const DEFAULT_TOP_K = 1;
const DEFAULT_TEMPERATURE = 0.2;

interface MessagePart {
  type: 'text' | 'image';
  value: string | File;
}

interface MultimodalMessage {
  role: string;
  content: string | MessagePart[];
}

export const AskAIViewer: React.FC = () => {
  const [messages, setMessages] = useState<MultimodalMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<'checking' | 'ready' | 'downloading' | 'unavailable'>('checking');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [multimodalSupported, setMultimodalSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    // Use requestAnimationFrame to batch scroll updates and reduce flickering
    const scrollTimer = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); // Use "auto" instead of "smooth" for less flickering
    });
    return () => cancelAnimationFrame(scrollTimer);
  }, [messages]);
  
  // Separate effect for streaming content to avoid excessive scrolling
  useEffect(() => {
    if (streaming && streamedContent) {
      // Use requestAnimationFrame for smooth scrolling during streaming
      const scrollRafId = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
      return () => cancelAnimationFrame(scrollRafId);
    }
  }, [streamedContent, streaming]);

  // Read askaiText from storage on mount and listen for changes
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('askaiText', (result) => {
        if (result.askaiText) {
          setInput(result.askaiText);
          chrome.storage.local.remove('askaiText');
        }
      });
      const handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local' && changes.askaiText && changes.askaiText.newValue) {
          setInput(changes.askaiText.newValue);
          chrome.storage.local.remove('askaiText');
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  // Listen for screenshot messages
  useEffect(() => {
    let isHandling = false; // Prevent duplicate handling
    
    const handler = (msg: any, sender: any, sendResponse: any) => {
      if (msg?.type === "nanostudy-cropped-image" && msg.dataUrl) {
        // Prevent duplicate handling
        if (isHandling) {
          console.log('Already handling screenshot, ignoring duplicate');
          return;
        }
        isHandling = true;
        
        // Convert data URL to File object for Chrome Prompt API
        const dataUrl = msg.dataUrl;
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            setSelectedImage(file);
            setImagePreview(dataUrl);
            setInput(""); // Clear input, but don't auto-send
            // Reset handling flag after a delay
            setTimeout(() => {
              isHandling = false;
            }, 1000);
          })
          .catch(err => {
            console.error('Error processing screenshot:', err);
            isHandling = false;
          });
      }
    };
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handler);
      return () => {
        chrome.runtime.onMessage.removeListener(handler);
        isHandling = false;
      };
    }
  }, []); // Remove dependencies to prevent re-registration

  // Check model availability and create session
  useEffect(() => {
    let isMounted = true;
    setModelStatus('checking');
    setError(null);
    setSession(null);
    setDownloadProgress(0);
    setStreaming(false);
    setStreamedContent("");
    (async () => {
      try {
        if (!('LanguageModel' in window)) {
          setModelStatus('unavailable');
          setError('Prompt API is not available in this browser.');
          return;
        }
        // Check availability with multimodal support
        const availabilityOptions = {
          expectedInputs: [{ type: 'image' }] as any
        };
        const availability = await LanguageModel.availability(availabilityOptions);
        if (availability === 'unavailable') {
          setModelStatus('unavailable');
          setError('Prompt API is not available. Check your browser settings.');
          return;
        }
        if (availability === 'downloading') {
          setModelStatus('downloading');
        } else {
          setModelStatus('ready');
        }
        
        // Check if multimodal is available based on availability result
        // availability can be: 'available', 'downloadable', 'downloading', or 'unavailable'
        const isMultimodalAvailable = availability === 'available' || availability === 'downloadable';
        
        // Try to create session with multimodal support if available
        let newSession;
        if (isMultimodalAvailable) {
          try {
            newSession = await LanguageModel.create({
              initialPrompts: [
                { role: "system", content: SYSTEM_PROMPT }
              ],
              topK: DEFAULT_TOP_K,
              temperature: DEFAULT_TEMPERATURE,
              expectedInputs: [{ type: 'image' }] as any,
              monitor(monitor: any) {
                monitor.addEventListener("downloadprogress", (e: any) => {
                  const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                  setDownloadProgress(percent);
                });
              }
            });
            setMultimodalSupported(true);
            console.log('✅ Multimodal session created successfully');
          } catch (e) {
            // If creation fails even though availability says it's available, log and fallback
            console.warn('⚠️ Multimodal creation failed despite availability check, falling back to text-only mode:', e);
            try {
              newSession = await LanguageModel.create({
                initialPrompts: [
                  { role: "system", content: SYSTEM_PROMPT }
                ],
                topK: DEFAULT_TOP_K,
                temperature: DEFAULT_TEMPERATURE,
                monitor(monitor: any) {
                  monitor.addEventListener("downloadprogress", (e: any) => {
                    const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                    setDownloadProgress(percent);
                  });
                }
              });
              setMultimodalSupported(false);
            } catch (fallbackError) {
              throw fallbackError;
            }
          }
        } else {
          // Multimodal not available, create text-only session
          newSession = await LanguageModel.create({
            initialPrompts: [
              { role: "system", content: SYSTEM_PROMPT }
            ],
            topK: DEFAULT_TOP_K,
            temperature: DEFAULT_TEMPERATURE,
            monitor(monitor: any) {
              monitor.addEventListener("downloadprogress", (e: any) => {
                const percent = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                setDownloadProgress(percent);
              });
            }
          });
          setMultimodalSupported(false);
          console.log('ℹ️ Creating text-only session (multimodal not available)');
        }
        if (isMounted) {
          setSession(newSession);
          setModelStatus('ready');
        }
      } catch (e) {
        setModelStatus('unavailable');
        setError('Failed to initialize the model.');
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle screenshot initiation
  const handleInitiateScreenshot = async () => {
    console.log("initiateScreenshot");
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Send message to background script
        chrome.runtime.sendMessage(
          {
            type: "initiateScreenshot"
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending screenshot message:', chrome.runtime.lastError.message);
              setError('Failed to initiate screenshot. Please try again.');
            } else {
              console.log('✅ Screenshot initiated:', response);
            }
          }
        );
      } else {
        console.error('Chrome runtime not available');
        setError('Chrome runtime not available');
      }
    } catch (error) {
      console.error('Error initiating screenshot:', error);
      setError('Failed to initiate screenshot. Please try again.');
    }
  };

  // Handle image icon click
  const handleImageIconClick = () => {
    if (!loading && modelStatus === 'ready') {
      fileInputRef.current?.click();
    }
  };

  // Send message to AI (streaming)
  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || !session) return;
    setLoading(true);
    setError(null);
    setStreaming(true);
    setStreamedContent("");

    // Prepare user message
    const hasImage = selectedImage && multimodalSupported;
    const imageFile = selectedImage; // Save reference before clearing
    let userMessage: MultimodalMessage;
    
    if (hasImage) {
      // Multimodal message with image
      const textContent = input.trim() || 'Analyze this image';
      userMessage = {
        role: "user",
        content: [
          { type: 'text', value: textContent },
          { type: 'image', value: imageFile }
        ]
      };
      setMessages([...messages, userMessage]);
      
      // Append image to session first (for multimodal)
      try {
        console.log('Appending image with text:', textContent);
        await session.append([{
          role: 'user',
          content: [
            { type: 'text', value: textContent },
            { type: 'image', value: imageFile }
          ]
        }]);
        console.log('✅ Image appended successfully');
      } catch (e) {
        console.error('❌ Failed to append image:', e);
        setError('Failed to process image. Please try again.');
        setLoading(false);
        setStreaming(false);
        return;
      }
      
      // Clear image after appending
      removeImage();
    } else {
      // Text-only message
      userMessage = { role: "user", content: input };
      setMessages([...messages, userMessage]);
    }

    // For multimodal, if image was appended, the image is already in the session
    // We can send the same text prompt or an empty prompt
    const userInput = input.trim() || '';
    setInput("");
    
    try {
      // Use promptStreaming for streaming output
      // If image was appended, we can send the same text or just send it again
      // According to the API docs, after append() we can call prompt() with the question
      const promptText = hasImage ? (userInput || 'Analyze this image') : userInput;
      console.log('Sending prompt:', promptText || '(after image append)');
      const stream = session.promptStreaming(promptText, {
        outputLanguage: 'en'
      });
      let result = '';
      let previousChunk = '';
      let rafId: number | null = null;
      
      const scheduleUpdate = (content: string) => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          setStreamedContent(content);
          rafId = null;
        });
      };
      
      for await (const chunk of stream) {
        // Chrome Prompt API: chunk is cumulative, so diff it
        const newChunk = chunk.startsWith(previousChunk) ? chunk.slice(previousChunk.length) : chunk;
        result += newChunk;
        previousChunk = chunk;
        
        // Use requestAnimationFrame for smooth updates without blocking
        // This ensures updates happen at display refresh rate (usually 60fps)
        scheduleUpdate(result);
      }
      
      // Cancel any pending update and set final content immediately
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      setStreamedContent(result);
      
      // Wait a bit before adding to messages to avoid flickering
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Add final assistant message only (user message was already added above)
      setMessages(prev => [...prev, { role: "assistant", content: result }]);
      setStreamedContent("");
    } catch (e) {
      setError('AI failed to respond. Please try again.');
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  // Send on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Markdown renderer - simple and safe like reference code
  const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    if (!content || typeof content !== 'string') {
      return null;
    }
    
    return (
      <ReactMarkdown
        components={{
          h1: ({ children }) => children ? <h1 className="text-lg font-semibold text-slate-900 mb-2">{children}</h1> : null,
          h2: ({ children }) => children ? <h2 className="text-base font-medium text-slate-800 mb-2">{children}</h2> : null,
          h3: ({ children }) => children ? <h3 className="text-sm font-medium text-slate-700 mb-1">{children}</h3> : null,
          p: ({ children }) => children ? <p className="text-sm text-slate-700 mb-2 leading-relaxed">{children}</p> : null,
          ul: ({ children }) => children ? <ul className="list-disc list-inside ml-1 mb-2 space-y-1">{children}</ul> : null,
          ol: ({ children }) => children ? <ol className="list-decimal list-inside ml-1 mb-2 space-y-1">{children}</ol> : null,
          li: ({ children }) => children ? <li className="text-sm text-slate-700">{children}</li> : null,
          strong: ({ children }) => children ? <strong className="font-semibold text-slate-900">{children}</strong> : null,
          em: ({ children }) => children ? <em className="italic text-slate-700">{children}</em> : null,
          blockquote: ({ children }) => children ? <blockquote className="border-l-4 border-slate-300 pl-3 italic text-slate-600 my-2">{children}</blockquote> : null,
          code: ({ children }) => children ? <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">{children}</code> : null,
          pre: ({ children }) => children ? <pre className="bg-slate-800 text-slate-100 p-3 rounded-md text-xs overflow-x-auto mb-2">{children}</pre> : null,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  // Message bubble component
  const MessageBubble = React.memo(({ role, content }: MultimodalMessage) => {
    const isMultimodal = Array.isArray(content);
    
    return (
      <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[80%] rounded-2xl text-sm shadow-sm ${
          role === 'user' 
            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md' 
            : 'bg-white border border-slate-200/60 text-slate-800 rounded-bl-md shadow-slate-900/5'
        }`}>
          {isMultimodal ? (
            <div className="px-4 py-3 space-y-2">
              {content.map((part, idx) => {
                if (part.type === 'image') {
                  const imageUrl = typeof part.value === 'string' ? part.value : URL.createObjectURL(part.value as File);
                  return (
                    <div key={idx} className="rounded-lg overflow-hidden mb-2">
                      <img src={imageUrl} alt="Uploaded" className="max-w-full h-auto" />
                    </div>
                  );
                } else {
                  const textContent = part.value as string;
                  return (
                    <div key={idx}>
                      {role === 'assistant' ? (
                        <MarkdownRenderer content={textContent} />
                      ) : (
                        <p className="leading-relaxed whitespace-pre-wrap">{textContent}</p>
                      )}
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="px-4 py-3">
              {role === 'assistant' ? (
                <MarkdownRenderer content={typeof content === 'string' ? content : ''} />
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Memo comparison: only re-render if role or content actually changed
    if (prevProps.role !== nextProps.role) return false;
    if (typeof prevProps.content === 'string' && typeof nextProps.content === 'string') {
      return prevProps.content === nextProps.content;
    }
    if (Array.isArray(prevProps.content) && Array.isArray(nextProps.content)) {
      if (prevProps.content.length !== nextProps.content.length) return false;
      return prevProps.content.every((item, idx) => {
        const nextItem = nextProps.content[idx];
        if (typeof item === 'string' || typeof nextItem === 'string') {
          return item === nextItem;
        }
        return item.type === nextItem.type && item.value === nextItem.value;
      });
    }
    return false;
  });

  return (
    <Card className="w-full h-[90vh] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          AI Tutor
          <Badge variant="outline">Chrome Built-in AI</Badge>
        </CardTitle>
        <CardDescription>
          AI-powered Q&A Tutor
        </CardDescription>
      </CardHeader>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          {modelStatus === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-slate-500 px-4 pt-2"><Loader2 className="animate-spin h-4 w-4" /> Checking model availability...</div>
          )}
          {modelStatus === 'downloading' && (
            <div className="space-y-2 px-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Download className="h-3 w-3" />
                Downloading language model... {downloadProgress}%
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
          {modelStatus === 'unavailable' && (
            <Alert variant="destructive" className="my-2 mx-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Model unavailable</AlertTitle>
              <AlertDescription>{error || 'Prompt API is not available in this browser.'}</AlertDescription>
            </Alert>
          )}
          {modelStatus === 'ready' && (
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 px-4 py-4 bg-gradient-to-b from-slate-50/50 to-white">
              {messages.length === 0 && !streaming && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageCircle className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500 text-sm">Start a conversation with AI Tutor</p>
                  <p className="text-slate-400 text-xs mt-2">Ask questions or upload images for analysis</p>
                  {!multimodalSupported && (
                    <p className="text-slate-300 text-xs mt-1">Multimodal (image) support requires Chrome Canary with Origin Trial</p>
                  )}
                </div>
              )}
              {messages.map((msg, idx) => (
                <MessageBubble key={`msg-${idx}-${msg.role}-${typeof msg.content === 'string' ? msg.content.substring(0, 20) : 'multimodal'}`} role={msg.role} content={msg.content} />
              ))}
              {/* Streaming output */}
              {streaming && streamedContent && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm bg-white border border-slate-200/60 text-slate-800 shadow-sm">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => children ? <h1 className="text-lg font-semibold text-slate-900 mb-2">{children}</h1> : null,
                        h2: ({ children }) => children ? <h2 className="text-base font-medium text-slate-800 mb-2">{children}</h2> : null,
                        h3: ({ children }) => children ? <h3 className="text-sm font-medium text-slate-700 mb-1">{children}</h3> : null,
                        p: ({ children }) => children ? <p className="text-sm text-slate-700 mb-2 leading-relaxed">{children}</p> : null,
                        ul: ({ children }) => children ? <ul className="list-disc list-inside ml-1 mb-2 space-y-1">{children}</ul> : null,
                        ol: ({ children }) => children ? <ol className="list-decimal list-inside ml-1 mb-2 space-y-1">{children}</ol> : null,
                        li: ({ children }) => children ? <li className="text-sm text-slate-700">{children}</li> : null,
                        strong: ({ children }) => children ? <strong className="font-semibold text-slate-900">{children}</strong> : null,
                        em: ({ children }) => children ? <em className="italic text-slate-700">{children}</em> : null,
                        blockquote: ({ children }) => children ? <blockquote className="border-l-4 border-slate-300 pl-3 italic text-slate-600 my-2">{children}</blockquote> : null,
                        code: ({ children }) => children ? <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">{children}</code> : null,
                        pre: ({ children }) => children ? <pre className="bg-slate-800 text-slate-100 p-3 rounded-md text-xs overflow-x-auto mb-2">{children}</pre> : null,
                      }}
                    >
                      {streamedContent}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {streaming && !streamedContent && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm bg-white border border-slate-200/60 text-slate-800 shadow-sm">
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>
      </div>
      <CardFooter className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm flex flex-col gap-2 p-4">
        {/* Image preview */}
        {imagePreview && (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="rounded-lg max-h-20 max-w-20 object-contain border border-slate-200" />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        {/* Button row for screenshot and upload */}
        <div className="flex items-center gap-2">
          {multimodalSupported && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleInitiateScreenshot}
                disabled={loading || modelStatus !== 'ready'}
                title="Take Screenshot"
                className="flex-shrink-0"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleImageIconClick}
                disabled={loading || modelStatus !== 'ready'}
                title="Upload Image"
                className="flex-shrink-0"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            disabled={loading || modelStatus !== 'ready'}
          />
        </div>
        {/* Input area */}
        <div className="flex gap-2 w-full items-center">
          <Textarea
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            placeholder="Type your question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || modelStatus !== 'ready'}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !selectedImage) || !session || modelStatus !== 'ready'}
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Send"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}; 
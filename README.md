# NanoStudy – Offline AI Learning Assistant

NanoStudy is a Chrome extension powered by Chrome's built-in Gemini Nano AI for offline learning.

## Problem Statement

Approximately 2.6 billion people—32% of the world's population—lack internet access ([ITU, 2024](https://www.itu.int/en/mediacentre/Pages/PR-2024-11-27-facts-and-figures.aspx)). In South Asia and Sub-Saharan Africa, 88-90% of children have no connectivity ([UNICEF, 2020](https://www.unicefusa.org/stories/two-thirds-worlds-school-age-children-have-no-internet-home)). NanoStudy enables these students to use AI-powered learning assistance powered by Chrome's Built-in AI (Gemini Nano) even without internet connectivity.

**The Problem**: Students in low-connectivity regions are denied access to modern AI-powered educational tools that could transform their learning experience.

**The Solution**: NanoStudy provides complete offline AI learning assistance using Chrome's built-in AI APIs, ensuring accessibility regardless of connectivity.

---

## Key Features

- **AI Tutor (Multimodal)**: Interactive Q&A assistant with multimodal image support—upload images or capture screenshots for visual learning analysis
- **Knowledge Summarization**: Transform complex content into structured summaries with key concepts and learning focus
- **AI Translation**: Translate web content into 20+ languages using Chrome's Translator API—completely offline
- **Quiz Generation**: Generate comprehension-based quizzes from any learning material

---

## Prerequisites

Ensure your system meets the requirements for Chrome's built-in AI. See the [official requirements documentation](https://developer.chrome.com/docs/ai/get-started#requirements) for details.

---

## Installation

### Step 1: Enable Chrome Built-in AI Features

Follow the [official Chrome Built-in AI documentation](https://developer.chrome.com/docs/ai/get-started) to enable the required flags and set up your environment.

### Step 2: Install the Extension

1. Clone the repository:
   ```bash
   git clone https://github.com/zicojiao/nanostudy.git
   cd nanostudy
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm run dev    # for development
   pnpm build      # for production
   ```

4. Load the extension:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `build/chrome-mv3-dev` (dev) or `build/chrome-mv3-prod` (production)

---

## Usage

### AI Tutor

Open the AI Tutor tab to chat with Gemini Nano. Ask questions directly or use selected text from webpages as context. Supports multimodal input—upload images or capture screenshots for visual learning analysis. Perfect for homework help and learning guidance.

### AI Summary

Select content you want to summarize, right-click and choose "Generate Summary". Review the structured summary with overview, key concepts, and learning focus in the sidepanel.

### AI Translator

Select text on any webpage, right-click and choose "Translate Selection". The translation appears in the sidepanel automatically. Supports 20+ languages with easy language swapping.

### Quiz Generator

Paste content in the Quiz tab, click "Generate Quiz", and test your understanding with AI-generated questions. Get instant feedback with educational explanations.

---

## Chrome built-in AI APIs Used

NanoStudy leverages the following Chrome Built-in AI APIs:

- **Prompt API**: Powers two core features:
  - Interactive quiz generation from learning materials
  - Text-based and multimodal Q&A assistance with image input support
- **Summarizer API**: Generates concise summaries in multiple formats (key-points, TL;DR, teaser, headline) with adjustable lengths
- **Translator API**: Enables offline translation across 20+ language pairs

---

## Built With

- [Plasmo](https://www.plasmo.com/) - Browser extension framework
- React 18 + TypeScript
- Tailwind CSS + Radix UI
- Chrome Built-in Gemini Nano (Translator API + Summarizer API + Prompt API)
- React Markdown with KaTeX

---

## Privacy & Security

All AI processing happens locally using Chrome's built-in Gemini Nano. No data is sent to external servers, no tracking, and everything stays on your device.

---

## License

MIT License

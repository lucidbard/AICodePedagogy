# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Digging into AI: An Archaeological Python Adventure" - an educational web game teaching Python programming through an archaeological narrative. Designed for the DHSI 2025 course "Digital Humanities Programming Pedagogy in the Age of AI."

**Stack:** Vanilla JavaScript/HTML5/CSS3 with Skulpt.js (in-browser Python interpreter) and optional LLM integration (Ollama/OpenAI/Anthropic).

## Development Commands

```bash
# Run tests (Node.js with jsdom)
npm test

# Browser-based visual testing
npm run test:browser

# Start local dev server
npm run test:serve   # or: python3 -m http.server 8000

# Access points after starting server:
# Landing page: http://localhost:8000/index.html
# Main app: http://localhost:8000/app.html
# Test runner: http://localhost:8000/test-runner.html
```

No build step required - changes are immediately live in the browser.

## Architecture

### Three-Layer System

1. **Narrative/UI Layer** - Story updates, Dr. Rodriguez character reactions, reference panels, excavation layer metaphor
2. **Code Execution Layer** - Single-cell (Stage 1) and multi-cell (Stages 2-9) editors with Skulpt Python execution
3. **Validation/Content Layer** - Flexible output matching, JSON-based curriculum, localStorage persistence

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Project landing page (GitHub Pages) |
| `app.html` | Main game UI structure |
| `script.js` | Core game logic (3,000+ lines) - stage loading, code execution, validation |
| `game-content.json` | Educational curriculum - stages, challenges, validation rules, narrative |
| `llm-integration.js` | Multi-provider AI integration (Ollama, OpenAI, Anthropic, WebGPU) |
| `style.css` | All styling |

### Multi-Cell Execution Model

Stages 2-9 use accumulated execution (like Jupyter notebooks):
- `successfulCellExecutions` tracks completed cells per stage
- `getAccumulatedCode()` combines all successful cell code before running current cell
- Variables persist across cells within a stage

### Validation System (3-strategy fallback)

```javascript
flexibleOutputMatch(output, expected):
  1. Direct substring matching (case-insensitive)
  2. Numeric extraction with tolerance
  3. Pattern-based regex matching
```

Cell validation also uses `validation.codePatterns` and `validation.outputPatterns` from game-content.json.

## Content Structure (game-content.json)

```json
{
  "stages": [{
    "id": 1,
    "story": "HTML narrative",
    "challenge": "Task description",
    "starterCode": "# Code with TODO comments",
    "validation": {
      "codePatterns": ["regex patterns for code"],
      "outputPatterns": ["regex patterns for output"],
      "requiredNumbers": [42],
      "requiredText": ["expected phrases"]
    },
    "hints": ["Progressive hints"],
    "cells": [/* multi-cell stages only */]
  }]
}
```

## Testing Considerations

- Always test both single-cell (Stage 1) and multi-cell (Stages 2-9) flows
- Test Skulpt CDN fallback behavior (primary CDN failure should load from cdnjs)
- Verify localStorage persistence across page reloads
- LLM features are optional and should degrade gracefully when unavailable

## Key Patterns

- **Async everywhere:** Skulpt execution, LLM calls, and game initialization are all async
- **Error isolation:** Cell failures don't break subsequent cells
- **Narrative integration:** Code execution results update story context via `showInlineNarrative()`
- **Progressive unlocking:** `unlockNextLayer()` reveals excavation layers as students progress

## Dependencies

All loaded via CDN (no npm install for runtime):
- Skulpt 0.11.1 (Python interpreter)
- CodeMirror 5.65.16 (code editor)
- Google Fonts (Roboto)

Dev dependencies (for testing): jsdom, node-fetch

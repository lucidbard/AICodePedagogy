# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-12-02

### Session 3: LLM Model Evaluation & Prompt Engineering

#### Model Evaluation Methodology
- **Systematic model comparison**: Tested 5 candidate models (qwen2.5:1.5b, llama3.2:1b, llama3.2:3b, deepcoder:1.5b, gemma3) against actual game use cases
- **Test case design**: Created 6 test cases covering hints, debugging, and explanations for different stages
- **Evaluation scripts**: Added `scripts/evaluate-models.js` for model comparison and `scripts/e2e-prompt-test.js` for end-to-end prompt validation

#### Model Selection: Qwen 2.5 Coder 1.5B
- **Upgraded from Granite 350M** to Qwen 2.5 Coder 1.5B for better response quality
- **Best performance**: Correct error diagnosis, pedagogically appropriate hints, fast responses (~588ms avg)
- **Deployment**: Model cached on jtm.io server with Hugging Face fallback
- **Size**: ~1.3GB download with q4f16 quantization

#### Prompt Engineering Improvements
- **Debug prompt**: Added common Python error patterns to improve accuracy
  - "EOL while scanning string literal" = missing closing quote
  - "IndentationError" = wrong spacing/tabs
  - "NameError" = variable not defined or typo
- **Hint prompt**: Added explicit rules to prevent giving away answers
  - "Do NOT give the complete code solution"
  - "Do NOT write out the exact line they should type"
  - "Ask guiding questions, point to concepts, suggest what to think about"

#### Response Post-Processing
- **Hint filtering**: Added `filterHintResponse()` to strip complete code solutions from hint responses
- **Code block detection**: Removes multi-line code blocks containing complete print statements, for loops, or function definitions
- **Inline code filtering**: Catches "try this: `print(x)`" patterns and replaces with encouragement to try themselves

#### Technical Changes
- Updated `queryOllama()`, `queryWebGPU()`, `queryOpenAI()`, `queryAnthropic()` to pass query type through to `formatResponse()`
- Updated `formatResponse(response, queryType)` to apply hint filtering when type is 'hint'
- Updated WebGPU config to use `onnx-community/Qwen2.5-Coder-1.5B-Instruct`
- Updated modal text in index.html to reflect new model name and size

### Files Modified
- `llm-integration.js` - Model config, prompt improvements, response filtering
- `index.html` - Updated AI modal text for new model
- `scripts/evaluate-models.js` - New file for model comparison
- `scripts/e2e-prompt-test.js` - New file for prompt validation

### Documentation Created
- `docs/LLM_MODEL_EVALUATION.md` - Methodology for model evaluation and selection

---

## [Previous] - 2025-12-01

### Session 2: Layout Refinements & Persistence

#### Dynamic Chat Panel Layout
- **Conditional chat panel**: Chat panel is hidden by default (`display: none`)
- **Full-width code editor**: When chat is inactive, code panel takes full width
- **50/50 split on chat activation**: When AI chat starts, workspace splits into two equal columns
- **Fixed game-area grid**: Changed from 3-column (`1fr 2fr 1fr`) to single column to prevent layout issues

#### Reference Panel Improvements
- **Fixed as bottom drawer**: Reference panel is now `position: fixed` at bottom
- **Collapsible**: Click header to expand/collapse
- **Overflow fixes**: Added `box-sizing: border-box` and proper max-heights

#### localStorage Persistence
- **LLM toggle state**: AI Assistant enabled/disabled now persists across page reloads
- **Provider selection**: Ollama/OpenAI/Anthropic choice is saved
- **Model selection**: Selected model persists across sessions

### Files Modified
- `style.css` - Dynamic grid layout, reference panel fixes, removed 3-column game-area
- `script.js` - Added `.active` and `.has-chat` class toggling for chat panel
- `llm-integration.js` - Added `enabled` to saved preferences, restore toggle state on load

---

### Session 1: UI/UX Improvements & Deployment

#### UI Layout Changes
- **Dedicated chat panel**: Dr. Rodriguez chat now has its own column with more room for conversations
- **Horizontal footer settings**: AI assistant settings (provider, API key, model) now display in a single horizontal row
- **Compact chat buttons**: Shortened button labels ("🔍 Hint", "❌ Error", "📖 Story") for better fit

#### Narrative Display Fix
- **Fixed prose vs dialogue display**: Narrative prose now displays without quote marks (`📜 Text...`), while character dialogue uses proper attribution (`💬 **Dr. Rodriguez:** "Quote..."`)

#### LLM Integration Improvements
- **Auto-select default model**: When connecting to Ollama, automatically selects the best available model
  - Prefers smaller/faster models suitable for hints (llama3.2:3b, mistral, gemma2, etc.)
  - Falls back to first available if no preferred model found
- **Fixed queryCharacterHint**: Now correctly calls provider-specific methods (queryOllama, queryOpenAI, queryAnthropic)
- **Fixed Ollama URL for remote sites**: Sites like jtm.io now correctly try http://localhost:11434 (browser's localhost)
- **Fixed chat auto-scroll**: Changed scrollIntoView from `block: 'nearest'` to `block: 'end'` for proper scrolling

#### Bug Fixes
- **Fixed corrupted vendor files**: Replaced 404 HTML files with proper content
  - `python-hint.min.js` - Created working Python hint addon
  - Font files (roboto-*.woff2) - Re-downloaded correct files
- **Fixed SVG viewBox**: Corrected stop-icon viewBox from "0 24 24" to "0 0 24 24"

#### Deployment
- Deployed to jtm.io/codepedagogy

### Files Modified (Session 1)
- `index.html` - Added chat-panel column
- `style.css` - Horizontal footer, chat panel styles
- `script.js` - Fixed narrative display, moved chat to dedicated panel
- `llm-integration.js` - Auto-select model, fixed Ollama URL, scroll fixes
- `vendor/` - Fixed corrupted files

---

## [Previous] - 2025-11-30

### Session: Narrative & Exercise Improvements

This session focused on improving the narrative structure, pedagogical scaffolding, and exercise design based on a comprehensive analysis of the game content.

#### Narrative Enhancements

##### Secret Society & Antagonist Introduction (Stages 2-3)
- **Moved secret society reveal earlier**: The Keepers of Alexandria are now introduced in Stage 2's completion segment instead of later stages
- **Added antagonist element**: Marcus Vale and The Prometheus Collective (Vale Archives International) provide a concrete threat starting in Stage 2
- **Added `antagonistInfo` metadata** to `game-content.json` with organization details, leader info, and motivation

##### ARIA AI Assistant Character
- **Designed new AI character**: ARIA (Archaeological Research Intelligence Assistant) introduced at Stage 4
- **Added `aiAssistantInfo` metadata** with personality, backstory, and voice examples
- **Progressive capability unlock**:
  - Stages 4-6: hints, error_explanation, code_suggestions
  - Stages 7-8: + code_modification
  - Stage 9: full_collaboration
- **Added `ariaIntroduction` to Stage 4** with introductory message

##### Dr. Rodriguez Character Arc (Stages 6-9)
- **Stage 6**: Added photograph scene - Dr. Rodriguez shares photo of herself with grandmother from 30 years ago
- **Stage 7**: Added emotional backstory - grandmother's 40-year quest mapping locations by hand, passing before GPS could confirm her work
- **Stage 8**: Added locket reveal - papyrus fragment with "Build your own bridges, Elena" message
- **Stage 9**: Added personal reflection on the 5-year journey, gratitude to the player

#### Pedagogical Improvements

##### Conceptual Scaffolding
- **Stage 2**: Named "accumulation pattern" explicitly in Task 2 instruction and starter code comments
- **Stage 4**: Added detailed min/max pattern explanation with key insight about using separate `if` statements (not `elif`)
- **Stage 6**: Enhanced string methods intro with `.startswith()`, `.endswith()`, `in`, `.split()` examples and boolean logic section
- **Stage 7**: Added percentage math conceptual intro with formula, examples, `round()` function, parallel lists explanation, and `sum()` function
- **Stage 8**: Added string replacement intro with `.replace()` chaining and `.capitalize()` usage

##### Validation Loosening (Stages 2-8)
Made validation more flexible to accept alternative correct solutions:
- Added `flexible: true` flag to validation objects
- Simplified `codePatterns` to essential structural checks (function definitions, loops)
- Made `outputPatterns` case-insensitive with OR alternatives
- Removed overly strict regex patterns that required exact output formatting
- Added `requiredNumbers` arrays for key numeric outputs

##### Hint Restructuring (All Stages)
Changed hints from directive statements to exploratory questions:

**Before (directive):**
```
"Use len(fragment_lengths) to count the fragments"
```

**After (exploratory):**
```
"Python has a built-in function that tells you how many items are in a list. What might that function be called?"
```

Key changes by stage:
- **Stage 1**: Questions about data types, pattern matching, concatenation
- **Stage 2**: Questions about accumulation, loop variables, counting operations
- **Stage 3**: Questions about string comparison, counter incrementing
- **Stage 4**: Questions about min/max initialization, comparison operators, if structure
- **Stage 5**: Questions about word comparison, maximum tracking
- **Stage 6**: Questions about substring checking, word splitting, nested loops
- **Stage 7**: Questions about sum function, parallel list access, percentage formula
- **Stage 8**: Questions about character counting, replacement chaining, capitalization
- **Stage 9**: Questions that prompt review of previously learned techniques

#### CSS Quick Wins (style.css)

- Added CSS custom properties for colors, spacing, and touch targets
- Fixed accessibility contrast issues (changed `.cell-header` color from #5f6368 to #3c4043)
- Added focus states to buttons
- Removed duplicate `.code-editor` rule
- Improved mobile touch targets (44px minimum)

#### Content Fixes (game-content.json)

- Fixed typo: "Archaelogical" → "Archaeological"
- Completed placeholder code for Stages 4-9 with full solutions

### Files Modified

- `game-content.json` - All narrative and exercise changes
- `style.css` - CSS variables, accessibility fixes, touch targets
- `docs/AI_TUTOR_DESIGN.md` - Created (AI tutor design document)
- `CLAUDE.md` - Created (development guidance)

### Design Documents Created

- `docs/AI_TUTOR_DESIGN.md` - Comprehensive design for agentic AI tutor features with 5-phase implementation plan

### Session Transcript

Full conversation transcript available at: `docs/transcripts/2025-11-30-narrative-exercise-improvements.md`

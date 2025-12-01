# AI Tutor Design: Agentic Code Assistance

## Overview

This document proposes an integrated AI tutor system for "Digging into AI" that progressively increases LLM assistance through the game, culminating in a full agentic chat interface where the AI can modify code on behalf of the student.

## Design Philosophy

### Progressive AI Scaffolding

The AI assistance should mirror Dr. Rodriguez's role in the narrative:
- **Early stages (1-3)**: Hints only - like a mentor pointing in the right direction
- **Middle stages (4-6)**: Hints + error explanation + code suggestions
- **Late stages (7-8)**: Full chat with code modification proposals
- **Final stage (9)**: AI as collaborative partner, can write code sections

This progression:
1. Builds student independence early
2. Provides safety net when difficulty spikes
3. Models real-world AI-assisted development
4. Teaches students HOW to work with AI tools

### Narrative Integration

The AI tutor IS Dr. Rodriguez (or her "AI research assistant"). This maintains immersion:
- Character voice in all responses
- Awareness of narrative path and choices
- References to story context in hints
- Unlocking AI capabilities tied to story progression

---

## Phase 1: Enhanced Context (Current → Improved)

### Problem
Current LLM context is shallow:
- Doesn't include validation rules
- Doesn't track attempt history
- Doesn't know which cells passed/failed

### Solution
Expand `gatherContext()` to include:

```javascript
{
  // Current context (keep)
  stage: { title, story, challenge, data },
  currentCode: string | cellArray,
  lastOutput: string,
  hasError: boolean,

  // NEW: Validation awareness
  validation: {
    codePatterns: ["def\\s+find_date_range"],
    outputPatterns: ["Date range.*\\d+.*to.*\\d+"],
    requiredNumbers: [150, 380],
    requiredText: ["Date range", "Time span"]
  },

  // NEW: Attempt history
  attempts: [
    { code: "...", output: "...", passed: false, timestamp: Date },
    { code: "...", output: "...", passed: false, timestamp: Date }
  ],

  // NEW: Multi-cell state
  cellStates: [
    { index: 0, passed: true, code: "...", output: "..." },
    { index: 1, passed: false, code: "...", error: "..." }
  ],

  // NEW: Accumulated code context
  accumulatedCode: "# All successful cell code combined\n...",

  // NEW: Student struggle indicators
  struggleMetrics: {
    attemptsOnCurrentCell: 5,
    hintsViewed: 2,
    timeSpentMinutes: 12,
    commonErrors: ["IndentationError", "NameError"]
  }
}
```

### Implementation
- Modify `gatherContext()` in llm-integration.js
- Add attempt tracking to `runCellCode()` / `runPythonCode()`
- Store struggle metrics in `playerTracker`

---

## Phase 2: Intelligent Hint Generation

### Problem
Current hints are static (from game-content.json) or generic LLM responses.

### Solution
Three-tier hint system:

**Tier 1: Conceptual Hints** (Always available)
- "Think about what pattern you need to find the smallest value"
- Generated from LLM with strict "no code" instruction

**Tier 2: Structural Hints** (After 2+ failed attempts)
- "You'll need a loop that checks each date against your current minimum"
- Mentions structures but not syntax

**Tier 3: Code Scaffolds** (After 4+ failed attempts or explicit request)
- "Try starting with: `oldest = dates[0]`"
- Partial code that requires completion

### Prompt Template
```
You are Dr. Rodriguez's AI research assistant helping a student with Python.

CONTEXT:
- Stage: ${stage.title}
- Challenge: ${stage.challenge}
- Student's code: ${currentCode}
- Attempt count: ${struggleMetrics.attemptsOnCurrentCell}
- Common errors seen: ${struggleMetrics.commonErrors}

VALIDATION REQUIREMENTS (the student needs to achieve):
- Code must include: ${validation.codePatterns}
- Output must include: ${validation.requiredText}

HINT TIER: ${tierLevel} (1=conceptual, 2=structural, 3=scaffold)

Generate a ${tierLevel === 1 ? 'conceptual hint without code' :
            tierLevel === 2 ? 'structural hint mentioning needed constructs' :
            'partial code scaffold they can build from'}.

Stay in character as Dr. Rodriguez's assistant. Reference the archaeological context.
```

---

## Phase 3: Code Suggestion System

### Problem
Students get stuck and need more than hints - they need to see what correct code looks like.

### Solution
"Suggest Fix" button that:
1. Analyzes current code and error
2. Generates corrected version
3. Shows DIFF view (not just replacement)
4. Requires student to APPLY or MODIFY

### UI Design
```
┌─────────────────────────────────────────────────┐
│ 🔧 Dr. Rodriguez's AI suggests a fix:           │
├─────────────────────────────────────────────────┤
│ Your code:                                      │
│   for date in dates:                            │
│ -     if date < oldest:                         │
│ +     if date < oldest_date:                    │
│           oldest_date = date                    │
│                                                 │
│ Explanation: You're comparing to 'oldest' but   │
│ the variable is named 'oldest_date'. Variable   │
│ names must match exactly in Python!             │
│                                                 │
│ [Apply Fix] [Modify First] [Dismiss]            │
└─────────────────────────────────────────────────┘
```

### Implementation
```javascript
async suggestCodeFix(cellIndex) {
  const context = this.gatherEnhancedContext(cellIndex);

  const prompt = `
    The student's code has an issue. Generate a corrected version.

    THEIR CODE:
    ${context.currentCode}

    ERROR/OUTPUT:
    ${context.lastOutput}

    VALIDATION RULES:
    - Must match: ${context.validation.codePatterns}
    - Must output: ${context.validation.requiredText}

    Respond in JSON format:
    {
      "correctedCode": "the full corrected code",
      "explanation": "brief explanation of what was wrong",
      "changes": [
        {"line": 3, "was": "if date < oldest:", "now": "if date < oldest_date:"}
      ]
    }
  `;

  const response = await this.queryLLM(prompt);
  return this.parseCodeSuggestion(response);
}
```

### Pedagogical Safeguards
- Show diff, not just replacement (student sees what changed)
- Require explanation reading before "Apply"
- Track how many fixes were applied vs. modified
- Adjust hint tier based on fix dependency

---

## Phase 4: Agentic Chat Interface (Stages 7-9)

### Concept
Full conversational interface where the AI can:
1. Answer questions about the code
2. Propose modifications
3. Apply modifications with approval
4. Execute and validate
5. Iterate based on results

### Unlock Mechanism
- Available after Stage 6 completion
- Narrative justification: "Dr. Rodriguez has given you access to her advanced AI research tools"
- Optional: Student can enable/disable

### Chat UI Design
```
┌─────────────────────────────────────────────────┐
│ 🤖 AI Research Assistant          [Stage 7]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Dr. R's AI] Welcome back! I see you're working│
│ on geographic distribution analysis. Your      │
│ calculate_site_statistics function is close,   │
│ but the percentage calculation needs work.     │
│                                                 │
│ [You] Can you help me fix the percentage?      │
│                                                 │
│ [Dr. R's AI] Of course! I notice you're        │
│ dividing by `total` but you haven't defined    │
│ it yet in the function. Here's what I suggest: │
│                                                 │
│ ┌─ Proposed Change ─────────────────────────┐  │
│ │ def calculate_site_statistics(sites, counts):│
│ │     total_fragments = sum(counts)  # ADD   │  │
│ │     site_statistics = []                   │  │
│ │     for i in range(len(sites)):            │  │
│ │         pct = (counts[i]/total_fragments)*100│ │
│ │ ...                                        │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ [Apply to Cell 1] [Modify] [Explain More]      │
│                                                 │
├─────────────────────────────────────────────────┤
│ Type a message...                    [Send]    │
└─────────────────────────────────────────────────┘
```

### Agentic Loop Architecture
```
┌──────────────────────────────────────────────────────┐
│                    AGENTIC LOOP                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────┐     ┌─────────────┐     ┌───────────┐  │
│  │ Student │────>│ Parse Intent│────>│  Route    │  │
│  │ Message │     │             │     │           │  │
│  └─────────┘     └─────────────┘     └─────┬─────┘  │
│                                            │        │
│       ┌────────────────────────────────────┼────┐   │
│       │                                    │    │   │
│       v                                    v    v   │
│  ┌─────────┐     ┌─────────────┐    ┌──────────┐   │
│  │ Question│     │ Code Change │    │ Execute  │   │
│  │ Answer  │     │ Request     │    │ Request  │   │
│  └────┬────┘     └──────┬──────┘    └────┬─────┘   │
│       │                 │                 │        │
│       v                 v                 v        │
│  ┌─────────┐     ┌─────────────┐    ┌──────────┐   │
│  │ Generate│     │ Generate    │    │ Run Cell │   │
│  │ Response│     │ Code + Diff │    │ Code     │   │
│  └────┬────┘     └──────┬──────┘    └────┬─────┘   │
│       │                 │                 │        │
│       │                 v                 v        │
│       │          ┌─────────────┐    ┌──────────┐   │
│       │          │ Show Diff   │    │ Show     │   │
│       │          │ + Approval  │    │ Output   │   │
│       │          └──────┬──────┘    └────┬─────┘   │
│       │                 │                 │        │
│       │      [User Approves]              │        │
│       │                 │                 │        │
│       │                 v                 │        │
│       │          ┌─────────────┐          │        │
│       │          │ Apply to    │          │        │
│       │          │ Cell Editor │          │        │
│       │          └──────┬──────┘          │        │
│       │                 │                 │        │
│       v                 v                 v        │
│  ┌─────────────────────────────────────────────┐   │
│  │           Display in Chat History           │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Implementation: AgenticChatController

```javascript
class AgenticChatController {
  constructor(llmIntegration, cellManager) {
    this.llm = llmIntegration;
    this.cells = cellManager;
    this.conversationHistory = [];
    this.pendingAction = null;
  }

  async processMessage(userMessage) {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    // Classify intent
    const intent = await this.classifyIntent(userMessage);

    switch (intent.type) {
      case 'question':
        return this.handleQuestion(userMessage);

      case 'code_help':
        return this.handleCodeHelp(userMessage, intent.cellIndex);

      case 'apply_change':
        return this.applyPendingChange();

      case 'run_code':
        return this.executeCell(intent.cellIndex);

      case 'explain_error':
        return this.explainLastError();

      default:
        return this.handleGeneral(userMessage);
    }
  }

  async handleCodeHelp(message, cellIndex) {
    const context = this.gatherFullContext(cellIndex);

    const response = await this.llm.query(`
      You are Dr. Rodriguez's AI assistant. The student needs help with their code.

      CONVERSATION HISTORY:
      ${this.formatHistory()}

      CURRENT MESSAGE: ${message}

      CELL ${cellIndex} CODE:
      ${context.cellCode}

      VALIDATION REQUIREMENTS:
      ${JSON.stringify(context.validation)}

      LAST OUTPUT/ERROR:
      ${context.lastOutput}

      If code changes are needed, respond with:
      1. Brief explanation
      2. Code block with the suggested change (wrapped in \`\`\`python)
      3. Ask if they want to apply it

      Stay in character. Reference the archaeological investigation.
    `);

    // Parse response for code blocks
    const codeBlock = this.extractCodeBlock(response);

    if (codeBlock) {
      this.pendingAction = {
        type: 'code_change',
        cellIndex,
        newCode: codeBlock,
        explanation: response
      };
    }

    return {
      message: response,
      hasAction: !!codeBlock,
      actionType: codeBlock ? 'code_change' : null
    };
  }

  async applyPendingChange() {
    if (!this.pendingAction || this.pendingAction.type !== 'code_change') {
      return { message: "No pending changes to apply." };
    }

    const { cellIndex, newCode } = this.pendingAction;

    // Apply to editor
    this.cells.setCellCode(cellIndex, newCode);

    // Execute to validate
    const result = await this.cells.executeCell(cellIndex);

    // Clear pending
    this.pendingAction = null;

    if (result.passed) {
      return {
        message: "Changes applied and validated! The cell now passes. Great work!",
        success: true
      };
    } else {
      return {
        message: `Changes applied, but there's still an issue:\n\n${result.error || result.output}\n\nWould you like me to help further?`,
        success: false
      };
    }
  }
}
```

### Tool Calling for Agentic Models

For models that support tool calling (Claude, GPT-4), define tools:

```javascript
const agentTools = [
  {
    name: "read_cell_code",
    description: "Read the current code in a specific cell",
    parameters: {
      cellIndex: { type: "integer", description: "Cell number (0-indexed)" }
    }
  },
  {
    name: "modify_cell_code",
    description: "Propose a modification to cell code (requires user approval)",
    parameters: {
      cellIndex: { type: "integer" },
      newCode: { type: "string" },
      explanation: { type: "string" }
    }
  },
  {
    name: "execute_cell",
    description: "Run a cell and get the output",
    parameters: {
      cellIndex: { type: "integer" }
    }
  },
  {
    name: "get_validation_rules",
    description: "Get the expected patterns/outputs for current challenge",
    parameters: {}
  },
  {
    name: "get_hint",
    description: "Get a progressive hint for the current challenge",
    parameters: {
      tier: { type: "integer", description: "1=conceptual, 2=structural, 3=code" }
    }
  }
];
```

---

## Phase 5: AI Collaborative Mode (Stage 9)

### Concept
For the final stage, the AI can actively participate in writing the report:
- Student describes what they want
- AI writes code sections
- Student reviews, modifies, runs
- True pair programming experience

### Example Interaction
```
Student: "Help me create the language distribution section"

AI: "I'll create a loop that calculates percentages for each language.
Here's what I'm adding to your report:

```python
# Language distribution
print("\n--- LANGUAGE DISTRIBUTION ---")
total_lang = sum(language_counts)
for i in range(len(languages)):
    pct = round((language_counts[i] / total_lang) * 100, 1)
    print(f"  {languages[i]}: {language_counts[i]} ({pct}%)")
```

This uses the parallel lists pattern from Stage 7. Should I apply this?"
```

### Pedagogical Justification
- Stage 9 is synthesis, not learning new concepts
- AI assistance models real-world development
- Student still must understand and approve code
- Teaches "prompt engineering" for code generation

---

## Narrative Integration Points

### Stage 1-3: "Dr. Rodriguez guides you"
- Hints are her direct guidance
- AI is her "note-taking system" (passive)

### Stage 4-6: "Dr. Rodriguez introduces her research tools"
- AI assistant is explicitly introduced
- Code suggestions unlock
- Narrative: "I've been working on an AI system to help analyze fragments..."

### Stage 7-8: "Full access to the AI lab"
- Chat interface unlocks
- Agentic capabilities available
- Narrative: "You've proven yourself. Here's full access to my AI research assistant."

### Stage 9: "Collaborative revelation"
- AI as partner, not just tool
- Can write code sections together
- Narrative: "Together with the AI, we'll compile our final findings."

---

## Technical Requirements

### Model Requirements for Agentic Features

| Feature | Minimum Model | Recommended |
|---------|--------------|-------------|
| Enhanced hints | Any LLM | llama3, mistral |
| Code suggestions | Code-capable LLM | codellama, deepseek-coder |
| Agentic chat | Instruction-following | llama3-70b, mixtral |
| Tool calling | Tool-capable | Claude 3, GPT-4 |

### Ollama Considerations
- Most users will use Ollama (local)
- Need fallbacks for smaller models
- Consider: Model capability detection
- Graceful degradation if model can't handle agentic loop

### API Additions

```javascript
// New methods for AgenticChatController
class CellManager {
  getCellCode(index)           // Read cell content
  setCellCode(index, code)     // Update cell (with undo history)
  executeCell(index)           // Run and get result
  getCellOutput(index)         // Get last output
  getCellValidation(index)     // Get validation rules
  getAccumulatedCode(upTo)     // Get all successful cell code
}

class ConversationManager {
  addMessage(role, content)    // Add to history
  getHistory(limit)            // Get recent messages
  clearHistory()               // Reset conversation
  exportHistory()              // Save for analysis
}
```

---

## Success Metrics

### Learning Outcomes
- Students complete stages with fewer failed attempts
- Time-to-completion decreases for difficult stages
- Student confidence (self-reported) increases

### AI Interaction Quality
- % of AI suggestions that are applied
- % of applied suggestions that pass validation
- Student modification rate (do they tweak AI code?)

### Engagement
- Chat messages sent per stage
- Time spent in chat vs. direct coding
- Feature adoption rate

---

## Implementation Phases

### Phase 1 (2-3 days): Enhanced Context
- Expand gatherContext() with validation rules
- Add attempt tracking
- Store struggle metrics

### Phase 2 (3-4 days): Intelligent Hints
- Implement three-tier hint system
- Create tier-specific prompts
- Add UI for hint tier selection

### Phase 3 (4-5 days): Code Suggestions
- Implement suggestCodeFix()
- Create diff view UI
- Add apply/modify/dismiss flow

### Phase 4 (1-2 weeks): Agentic Chat
- Build AgenticChatController
- Create chat UI component
- Implement tool calling (for supported models)
- Add conversation persistence

### Phase 5 (3-4 days): Collaborative Mode
- Extend Stage 9 for AI collaboration
- Add "write this section" capability
- Create pair programming UX

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Students over-rely on AI | Progressive unlock; track dependency metrics |
| AI generates wrong code | Always require validation before "pass" |
| Model too slow (local) | Streaming responses; timeout fallbacks |
| Privacy (code sent to API) | Default to Ollama; clear API warnings |
| Breaks learning objectives | Require explanation reading; modify-before-apply option |

---

## Appendix: Sample Prompts

### Tier 1 Hint (Conceptual)
```
You are helping a student learn Python through an archaeological adventure.
They are stuck on finding the minimum and maximum dates in a list.

DO NOT provide any code. Give only a conceptual hint about the APPROACH.
Think about: What would you need to keep track of as you look through each item?

Respond as Dr. Rodriguez's AI assistant. Be encouraging. 1-2 sentences max.
```

### Tier 3 Hint (Scaffold)
```
The student has tried 5 times and needs more direct help.
Provide a partial code scaffold they can complete.

Challenge: Find oldest and newest dates in a list.
Their attempts show they understand loops but not the comparison pattern.

Give them the STRUCTURE with blanks or comments for them to fill:
- Show the initialization pattern
- Show the loop structure
- Leave the comparison logic for them

Stay in character as Dr. Rodriguez's AI.
```

### Agentic Code Fix
```
You are an AI assistant that can modify code cells in a Python notebook.

CURRENT CELL CODE:
```python
def find_date_range(dates):
    oldest = dates[0]
    newest = dates[0]
    for date in dates:
        if date < oldest
            oldest = date
    return oldest, newest
```

ERROR: SyntaxError: expected ':'

VALIDATION REQUIRES:
- Pattern: `if\s+date\s+<\s+oldest`
- Output must include both oldest (150) and newest (380) dates

Respond with:
1. What's wrong (brief)
2. The corrected code in a python code block
3. Ask if student wants to apply the fix

Stay in character.
```

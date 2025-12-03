# LLM Model Evaluation Methodology

This document describes the methodology used to evaluate and select language models for the in-browser AI assistant in "Digging into AI."

## Overview

The AI assistant helps students with Python programming through hints, debugging assistance, and concept explanations. Selecting the right model requires balancing:

1. **Response quality** - Pedagogically appropriate, accurate answers
2. **Model size** - Must run in-browser via WebGPU (~1-2GB limit)
3. **Response speed** - Interactive experience requires fast responses
4. **Hint discipline** - Hints must guide without giving away answers

## Evaluation Methodology

### Step 1: Candidate Model Selection

We identified browser-compatible models with ONNX exports and q4f16 quantization:

| Model | Size (q4f16) | Notes |
|-------|--------------|-------|
| IBM Granite 3.3B | ~1.6GB | Tool-calling capable |
| Qwen 2.5 Coder 1.5B | ~1.3GB | Coding-focused |
| Llama 3.2 1B | ~1.0GB | General purpose |
| Llama 3.2 3B | ~2.0GB | Larger variant |
| DeepCoder 1.5B | ~1.3GB | Code-specialized |

### Step 2: Test Case Design

We created test cases matching actual game use cases from `llm-integration.js`:

```javascript
// scripts/evaluate-models.js - Model comparison tests
// scripts/e2e-prompt-test.js - End-to-end prompt validation
```

**Test Case Categories:**

1. **Hint Tests** - Verify hints guide without giving complete answers
   - Stage 1: Basic print hint
   - Stage 5: Loop hint
   - Stage 7: Function definition hint

2. **Debug Tests** - Verify accurate error diagnosis
   - Stage 2: Missing quote syntax error
   - Stage 5: Indentation error

3. **Explain Tests** - Verify beginner-friendly explanations
   - Stage 3: Variable concepts

**Evaluation Criteria per Test:**

```javascript
{
  name: 'Stage 2: Missing Quote Debug',
  type: 'debug',
  context: {
    stage: 'Stage 2: Data Fragments',
    challenge: 'Create a variable to store the artifact name',
    currentCode: 'artifact_name = "Golden Scarab\nprint(artifact_name)',
    lastOutput: 'SyntaxError: EOL while scanning string literal',
    hasError: true
  },
  criteria: [
    'Should identify missing closing quote',
    'Should explain string literals need quotes',
    'Should NOT say uppercase is the problem'
  ]
}
```

### Step 3: Local Model Testing via Ollama

Rather than downloading large ONNX files for each candidate, we tested via Ollama which runs the same model architectures:

```bash
# Pull candidate models
ollama pull llama3.2:1b
ollama pull llama3.2:3b
ollama pull qwen2.5:1.5b
ollama pull deepcoder:1.5b
```

Run evaluation:
```bash
node scripts/evaluate-models.js
```

### Step 4: Evaluation Results

| Model | Avg Response Time | Hint Quality | Debug Accuracy | Issues |
|-------|-------------------|--------------|----------------|--------|
| qwen2.5:1.5b | 588ms | ✓ Good | ✓ Correct | None |
| llama3.2:3b | 1200ms | ✓ Good | ✗ Wrong | Misidentified syntax errors |
| llama3.2:1b | 400ms | ⚠ Basic | ⚠ Partial | Too terse |
| deepcoder:1.5b | 600ms | ✗ Poor | ✗ Wrong | Hallucinated Python rules, `<think>` tags |

**Key Findings:**

1. **qwen2.5:1.5b** performed best overall:
   - Correctly identified "EOL while scanning string literal" as missing quote
   - Gave pedagogically appropriate hints without complete solutions
   - Fast response times suitable for interactive use

2. **llama3.2:3b** failed on debug accuracy:
   - Said "extra line break" instead of "missing quote" for syntax error
   - Not fixable with prompting - model limitation

3. **deepcoder:1.5b** was unreliable:
   - Included visible `<think>` reasoning tags in output
   - Hallucinated non-existent Python rules
   - Even with thinking tags stripped, answers were wrong

### Step 5: Prompt Engineering

After selecting qwen2.5:1.5b, we validated prompts against actual use cases:

**Initial Issues Found:**
1. Debug responses sometimes gave wrong diagnosis
2. Hint responses sometimes included complete code solutions

**Prompt Improvements:**

```javascript
// Debug prompt - added common error patterns
case 'debug':
  return aiAssistantPrompt + `
Help debug their code. Look carefully at the error message and the code.

DEBUGGING STEPS:
1. Read the error message carefully - what does it say?
2. Look at the EXACT line where the error occurs
3. Identify the SPECIFIC problem (missing quote, wrong indentation, typo, etc.)
4. Explain clearly what's wrong and how to fix it

Common Python errors:
- "EOL while scanning string literal" = missing closing quote
- "IndentationError" = wrong spacing/tabs
- "NameError" = variable not defined or typo
...`;
```

```javascript
// Hint prompt - explicit rules against giving answers
case 'hint':
  return aiAssistantPrompt + `
Give a helpful hint to guide them toward the solution.

IMPORTANT RULES:
- Do NOT give the complete code solution
- Do NOT write out the exact line they should type
- Instead: Ask guiding questions, point to concepts, suggest what to think about
- Keep it to 2-3 sentences maximum

Be encouraging and help them discover the answer themselves.`;
```

### Step 6: Response Post-Processing

As defense-in-depth, we added response filtering to catch any complete code that slips through:

```javascript
filterHintResponse(response) {
  // Remove code blocks containing complete statements
  const codeBlockRegex = /```(?:python)?\n([\s\S]*?)```/g;

  filtered = filtered.replace(codeBlockRegex, (match, code) => {
    const hasCompleteStatement = (
      /print\s*\([^)]+\)/.test(code) ||          // print statements
      /for\s+\w+\s+in\s+.+:\s*\n\s+/.test(code) || // for loops with body
      /def\s+\w+\s*\([^)]*\):\s*\n\s+/.test(code)  // function definitions
    );

    if (hasCompleteStatement && code.trim().split('\n').length > 1) {
      return '\n\n*Try writing the code yourself based on the hints above!*\n\n';
    }
    return match;
  });

  // Also filter inline "try this: `code`" patterns
  filtered = filtered.replace(
    /(?:try|run|type|write|use)\s+(?:this|it)?:?\s*`([^`]+)`/gi,
    (match, code) => {
      if (/print\s*\(|for\s+\w+\s+in|def\s+\w+/.test(code)) {
        return 'try writing it yourself!';
      }
      return match;
    }
  );

  return filtered;
}
```

## Final Model Selection

**Selected Model:** Qwen 2.5 Coder 1.5B Instruct

**ONNX Source:** `onnx-community/Qwen2.5-Coder-1.5B-Instruct`

**Quantization:** q4f16 (~1.3GB download)

**Deployment:**
- Primary: Cached on jtm.io server (`/var/www/codepedagogy/models/qwen2.5-coder-1.5b/`)
- Fallback: Hugging Face Hub (automatic via Transformers.js)

## Files

| File | Purpose |
|------|---------|
| `scripts/evaluate-models.js` | Compare multiple models against test cases |
| `scripts/e2e-prompt-test.js` | Test actual prompts from llm-integration.js |
| `llm-integration.js` | Production LLM integration with filtering |

## Future Improvements

1. **Memory-based model selection** - Use `navigator.deviceMemory` to offer larger models on capable devices
2. **Automated regression testing** - Run e2e-prompt-test.js in CI
3. **Model update process** - Re-run evaluation when new ONNX models become available
4. **User feedback integration** - Track which hints actually helped vs. confused students

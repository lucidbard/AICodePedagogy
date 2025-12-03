#!/usr/bin/env node
/**
 * Model Evaluation Script for AICodePedagogy
 * Tests multiple Ollama models against our use cases
 */

const OLLAMA_URL = 'http://host.docker.internal:11434';

// Models to test (these have ONNX-web equivalents for browser)
const MODELS_TO_TEST = [
  'llama3.2:1b',      // ~1.3GB in browser
  'llama3.2:3b',      // ~2GB in browser
  'qwen2.5:1.5b',     // ~1GB in browser
  'deepcoder:1.5b',   // Coding-focused
  'gemma3:latest',    // 4B model for comparison
];

// Test cases based on actual game prompts
const TEST_CASES = [
  {
    name: 'hint_basic_print',
    type: 'hint',
    context: {
      stage: 'Stage 1: First Contact',
      challenge: 'Use the print() function to display the artifact message',
      currentCode: '# TODO: Print the message\nmessage = "Hello from the ancient database"',
      lastOutput: '',
      hasError: false
    },
    expectedBehavior: 'Should give a hint about using print() without giving the answer'
  },
  {
    name: 'debug_syntax_error',
    type: 'debug',
    context: {
      stage: 'Stage 2: Variables',
      challenge: 'Create a variable and print it',
      currentCode: 'artifact_name = "Golden Scarab\nprint(artifact_name)',
      lastOutput: 'SyntaxError: EOL while scanning string literal',
      hasError: true
    },
    expectedBehavior: 'Should identify the missing closing quote'
  },
  {
    name: 'explain_variables',
    type: 'explain',
    context: {
      stage: 'Stage 2: Variables',
      challenge: 'Learn about Python variables',
      currentCode: 'x = 42\nname = "artifact"',
      lastOutput: '',
      hasError: false
    },
    expectedBehavior: 'Should explain what variables are and how assignment works'
  },
  {
    name: 'hint_loop',
    type: 'hint',
    context: {
      stage: 'Stage 5: Loops',
      challenge: 'Use a for loop to iterate through the artifact list',
      currentCode: 'artifacts = ["vase", "coin", "scroll"]\n# TODO: Print each artifact',
      lastOutput: '',
      hasError: false
    },
    expectedBehavior: 'Should hint about for loops and iteration without full solution'
  },
  {
    name: 'debug_indentation',
    type: 'debug',
    context: {
      stage: 'Stage 5: Loops',
      challenge: 'Fix the loop code',
      currentCode: 'for item in artifacts:\nprint(item)',
      lastOutput: 'IndentationError: expected an indented block',
      hasError: true
    },
    expectedBehavior: 'Should explain indentation is required after for:'
  },
  {
    name: 'hint_function',
    type: 'hint',
    context: {
      stage: 'Stage 7: Functions',
      challenge: 'Create a function to calculate artifact age',
      currentCode: '# TODO: Define a function called calculate_age\n# It should take current_year and discovery_year as parameters',
      lastOutput: '',
      hasError: false
    },
    expectedBehavior: 'Should hint about def keyword and parameters'
  }
];

// Build prompt (matches llm-integration.js buildPrompt function)
function buildPrompt(type, context) {
  const codeContext = `
CURRENT TASK:
Stage: ${context.stage}
Challenge: ${context.challenge}

Current code:
${context.currentCode}

${context.lastOutput ? `Output: ${context.lastOutput}` : ''}
${context.hasError ? '(Error in last execution)' : ''}
`;

  const aiAssistantPrompt = `You are an AI coding assistant, helping a learner with Python programming.

ROLE:
- You're a coding companion, like Claude Code or GitHub Copilot
- Be helpful, clear, and encouraging
- Focus on teaching and building understanding
- Give practical, actionable guidance

CAPABILITIES:
- Provide hints and explanations
- Help debug by identifying issues
- Explain concepts clearly
- Guide them toward solutions without giving complete answers

${codeContext}`;

  switch (type) {
    case 'hint':
      return aiAssistantPrompt + `
Give a helpful hint to guide them toward the solution. Don't give the complete answer—help them think through the problem. Be encouraging and suggest what to focus on next. Keep your response to 2-3 sentences.`;

    case 'debug':
      return aiAssistantPrompt + `
Help debug their code:
1. Identify the issue clearly
2. Explain what's going wrong and why
3. Guide them toward the fix

Be supportive—errors are learning opportunities. Keep response concise.`;

    case 'explain':
      return aiAssistantPrompt + `
Explain the Python concepts involved in this challenge:
1. What concepts are being practiced
2. How they work in Python
3. Why they're useful

Keep it clear and beginner-friendly. 3-4 sentences max.`;

    default:
      return aiAssistantPrompt + `Provide helpful guidance for this programming challenge.`;
  }
}

// Query Ollama
async function queryOllama(model, prompt) {
  const startTime = Date.now();

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200  // Keep responses short
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;

    return {
      success: true,
      response: data.response,
      elapsed_ms: elapsed,
      tokens: data.eval_count || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      elapsed_ms: Date.now() - startTime
    };
  }
}

// Check which models are available
async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    return data.models.map(m => m.name);
  } catch (error) {
    console.error('Failed to get models:', error.message);
    return [];
  }
}

// Run evaluation
async function runEvaluation() {
  console.log('='.repeat(80));
  console.log('MODEL EVALUATION FOR AICODEPEDAGOGY');
  console.log('='.repeat(80));
  console.log();

  const availableModels = await getAvailableModels();
  const modelsToTest = MODELS_TO_TEST.filter(m =>
    availableModels.some(am => am.startsWith(m.split(':')[0]))
  );

  console.log(`Available test models: ${modelsToTest.join(', ')}`);
  console.log(`Test cases: ${TEST_CASES.length}`);
  console.log();

  const results = {};

  for (const model of modelsToTest) {
    // Check if exact model or base name matches
    const exactMatch = availableModels.find(am => am === model);
    const baseMatch = availableModels.find(am => am.startsWith(model.split(':')[0]));
    const modelToUse = exactMatch || baseMatch;

    if (!modelToUse) {
      console.log(`Skipping ${model} - not installed`);
      continue;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`TESTING: ${modelToUse}`);
    console.log('='.repeat(80));

    results[modelToUse] = [];

    for (const testCase of TEST_CASES) {
      console.log(`\n--- ${testCase.name} (${testCase.type}) ---`);

      const prompt = buildPrompt(testCase.type, testCase.context);
      const result = await queryOllama(modelToUse, prompt);

      if (result.success) {
        console.log(`Time: ${result.elapsed_ms}ms | Tokens: ${result.tokens}`);
        console.log(`Response:\n${result.response.substring(0, 500)}${result.response.length > 500 ? '...' : ''}`);
        console.log(`\nExpected: ${testCase.expectedBehavior}`);
      } else {
        console.log(`ERROR: ${result.error}`);
      }

      results[modelToUse].push({
        testCase: testCase.name,
        ...result
      });

      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  for (const [model, tests] of Object.entries(results)) {
    const successful = tests.filter(t => t.success);
    const avgTime = successful.length > 0
      ? Math.round(successful.reduce((a, t) => a + t.elapsed_ms, 0) / successful.length)
      : 0;
    const avgTokens = successful.length > 0
      ? Math.round(successful.reduce((a, t) => a + (t.tokens || 0), 0) / successful.length)
      : 0;

    console.log(`\n${model}:`);
    console.log(`  Success: ${successful.length}/${tests.length}`);
    console.log(`  Avg response time: ${avgTime}ms`);
    console.log(`  Avg tokens: ${avgTokens}`);
  }
}

// Run it
runEvaluation().catch(console.error);

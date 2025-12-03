#!/usr/bin/env node
/**
 * End-to-End Prompt Evaluation
 * Tests actual prompts from llm-integration.js against qwen2.5:1.5b
 */

const OLLAMA_URL = 'http://host.docker.internal:11434';
const MODEL = 'qwen2.5:1.5b';

// Exact prompts from llm-integration.js buildPrompt()
function buildPrompt(type, context) {
  const codeContext = `
CURRENT TASK:
Stage: ${context.stage}
Challenge: ${context.challenge}

Current code:
${context.currentCode}

${context.lastOutput ? 'Output: ' + context.lastOutput : ''}
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
Give a helpful hint to guide them toward the solution.

IMPORTANT RULES:
- Do NOT give the complete code solution
- Do NOT write out the exact line they should type
- Instead: Ask guiding questions, point to concepts, suggest what to think about
- Keep it to 2-3 sentences maximum

Be encouraging and help them discover the answer themselves.`;

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

Guide them to fix it themselves. Be supportive—errors are learning opportunities!`;

    case 'explain':
      return aiAssistantPrompt + `
Explain the Python concepts involved in this challenge:
1. What concepts are being practiced
2. How they work in Python
3. Why they're useful

Keep it clear and beginner-friendly.`;

    default:
      return aiAssistantPrompt;
  }
}

async function queryOllama(prompt) {
  const start = Date.now();
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 300 }
    })
  });
  const data = await response.json();
  return { text: data.response, time: Date.now() - start };
}

const testCases = [
  {
    name: 'Stage 1: Basic Print Hint',
    type: 'hint',
    context: {
      stage: 'Stage 1: First Contact',
      challenge: 'Use the print() function to display the artifact message stored in the variable.',
      currentCode: '# The ancient message has been decoded into this variable\nmessage = "Greetings from the Library of Alexandria"\n\n# TODO: Display the message using print()',
      lastOutput: '',
      hasError: false
    },
    criteria: ['Should mention print()', 'Should NOT give print(message) directly', 'Should be encouraging']
  },
  {
    name: 'Stage 2: Missing Quote Debug',
    type: 'debug',
    context: {
      stage: 'Stage 2: Data Fragments',
      challenge: 'Create a variable to store the artifact name and print it.',
      currentCode: 'artifact_name = "Golden Scarab\nprint(artifact_name)',
      lastOutput: 'SyntaxError: EOL while scanning string literal',
      hasError: true
    },
    criteria: ['Should identify missing closing quote', 'Should explain string literals need quotes', 'Should NOT say uppercase is the problem']
  },
  {
    name: 'Stage 3: Variable Explanation',
    type: 'explain',
    context: {
      stage: 'Stage 3: Cataloging Artifacts',
      challenge: 'Learn how to store data in variables.',
      currentCode: 'artifact_count = 42\nsite_name = "Alexandria"\nprint(artifact_count)\nprint(site_name)',
      lastOutput: '42\nAlexandria',
      hasError: false
    },
    criteria: ['Should explain what variables are', 'Should mention assignment operator', 'Should be beginner-friendly']
  },
  {
    name: 'Stage 5: Loop Hint',
    type: 'hint',
    context: {
      stage: 'Stage 5: Processing Collections',
      challenge: 'Use a for loop to print each artifact in the collection.',
      currentCode: 'artifacts = ["ancient scroll", "clay tablet", "bronze mirror"]\n\n# TODO: Use a for loop to print each artifact',
      lastOutput: '',
      hasError: false
    },
    criteria: ['Should hint about for loops', 'Should NOT give complete for loop code', 'Should mention iteration']
  },
  {
    name: 'Stage 5: Indentation Debug',
    type: 'debug',
    context: {
      stage: 'Stage 5: Processing Collections',
      challenge: 'Fix the loop to print all artifacts.',
      currentCode: 'artifacts = ["scroll", "tablet", "mirror"]\nfor item in artifacts:\nprint(item)',
      lastOutput: 'IndentationError: expected an indented block',
      hasError: true
    },
    criteria: ['Should identify missing indentation', 'Should explain Python uses indentation for blocks', 'Should suggest adding spaces/tab']
  },
  {
    name: 'Stage 7: Function Hint',
    type: 'hint',
    context: {
      stage: 'Stage 7: Creating Tools',
      challenge: 'Create a function called calculate_age that takes current_year and discovery_year as parameters.',
      currentCode: '# TODO: Define the calculate_age function\n# It should subtract discovery_year from current_year',
      lastOutput: '',
      hasError: false
    },
    criteria: ['Should mention def keyword', 'Should hint about parameters', 'Should NOT give complete function']
  }
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('END-TO-END PROMPT EVALUATION: qwen2.5:1.5b');
  console.log('Testing actual prompts from llm-integration.js');
  console.log('='.repeat(80));

  const results = [];

  for (const tc of testCases) {
    console.log('\n' + '─'.repeat(80));
    console.log('TEST: ' + tc.name + ' (' + tc.type + ')');
    console.log('─'.repeat(80));

    const prompt = buildPrompt(tc.type, tc.context);
    const result = await queryOllama(prompt);

    console.log('Time: ' + result.time + 'ms');
    console.log('\nRESPONSE:\n' + result.text);
    console.log('\nCRITERIA TO CHECK:');
    tc.criteria.forEach(c => console.log('  • ' + c));

    results.push({
      name: tc.name,
      type: tc.type,
      response: result.text,
      time: result.time,
      criteria: tc.criteria
    });

    // Brief pause
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION COMPLETE');
  console.log('='.repeat(80));

  return results;
}

runTests().catch(console.error);

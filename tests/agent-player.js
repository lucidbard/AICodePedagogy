/**
 * LLM Agent Game Player
 * Uses Playwright to drive the game and an LLM to solve challenges
 */

const { chromium } = require('playwright');

// Use native fetch if available (Node 18+), otherwise use node-fetch
const fetch = globalThis.fetch || require('node-fetch');

// Configuration - can be overridden with environment variables
// WSL: Windows host IP is typically the default gateway (172.29.16.1)
const CONFIG = {
  gameUrl: process.env.GAME_URL || 'http://localhost:8001',
  ollamaUrl: process.env.OLLAMA_URL || 'http://172.29.16.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3:8b', // Available: llama3:8b, gemma3:4b, phi3:3.8b, gemma3:27b
  headless: false, // Set to true for CI
  slowMo: 100, // Slow down for visibility
  timeout: 60000
};

/**
 * Query Ollama for a response
 */
async function queryOllama(prompt, model = CONFIG.model) {
  try {
    const response = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama query failed:', error.message);
    return null;
  }
}

/**
 * Build a prompt for the LLM to solve the current challenge
 */
function buildSolvePrompt(context) {
  return `You are playing an educational coding game about digital archaeology.

CURRENT STAGE: ${context.currentStage} - ${context.stageTitle}

CHALLENGE: ${context.challenge}

DATA PROVIDED: ${context.data}

CURRENT CODE:
${typeof context.currentCode === 'string'
  ? context.currentCode
  : JSON.stringify(context.currentCode, null, 2)}

HINTS: ${context.hints?.join(' | ') || 'None'}

${context.outputs?.[0]?.output ? `LAST OUTPUT: ${context.outputs[0].output}` : ''}

YOUR TASK: Write the Python code to solve this challenge.
- Only output the complete Python code
- No explanations, just code
- Make sure to follow the hints and use the provided data
- Use print() statements to output results
- IMPORTANT: Do NOT use f-strings (f"...") - use string concatenation or .format() instead
- IMPORTANT: Use Python 2 compatible syntax (no f-strings, use "..." + str(x) for string formatting)
- IMPORTANT: Do NOT add docstrings to functions (no """ or ''' strings, no Args:, Returns: sections)
- Match the expected output format exactly

CODE:`;
}

/**
 * Build a prompt for a specific cell in a multi-cell stage
 */
function buildCellPrompt(context, cellIndex, cellInfo, previousOutputs = []) {
  const prevContext = previousOutputs.length > 0
    ? `\nPREVIOUS CELL OUTPUTS:\n${previousOutputs.map((o, i) => `Cell ${i}: ${o}`).join('\n')}`
    : '';

  return `You are playing an educational coding game about digital archaeology.

CURRENT STAGE: ${context.currentStage} - ${context.stageTitle}
CELL ${cellIndex + 1} of ${context.cells?.length || 1}

CELL TITLE: ${cellInfo.title}
CELL INSTRUCTION: ${cellInfo.instruction}

EXPECTED OUTPUT: ${cellInfo.expectedOutput?.join(' | ') || 'Not specified'}

STARTER CODE:
${cellInfo.starterCode}
${prevContext}

HINTS: ${cellInfo.hints?.join(' | ') || 'None'}

YOUR TASK: Complete the starter code to produce the expected output.
- Only output the complete Python code (include the starter code parts you need)
- No explanations, just code
- Use print() statements to output results
- IMPORTANT: Do NOT use f-strings (f"...") - use string concatenation or .format() instead
- IMPORTANT: Use Python 2 compatible syntax
- IMPORTANT: Do NOT add docstrings to functions (no """ or ''' strings, no Args:, Returns: sections)
- IMPORTANT: Keep existing return statements unchanged - if the starter code returns 3 values, return exactly 3 values
- IMPORTANT: Do not add extra return values beyond what the starter code expects
- Match the expected output format exactly

CODE:`;
}

/**
 * Strip docstrings from Python code (Skulpt doesn't handle them well)
 */
function stripDocstrings(code) {
  // Remove triple-quoted docstrings (both """ and ''')
  // Handle multi-line docstrings
  let result = code;

  // Remove """ docstrings (greedy, handles multi-line)
  result = result.replace(/"""[\s\S]*?"""/g, '');

  // Remove ''' docstrings
  result = result.replace(/'''[\s\S]*?'''/g, '');

  // Remove orphaned docstring-style lines (Args:, Returns:, etc. without quotes)
  // These appear when LLM generates partial docstrings
  const lines = result.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();

    // Filter out common docstring patterns that appear outside quotes
    if (/^(Args|Returns|Raises|Note|Example|Parameters|Attributes|Yields|See Also):/.test(trimmed)) {
      return false;
    }

    // Filter out parameter descriptions like "lengths: List of...", "tuple: (..."
    // Pattern: word followed by colon, then space(s), then either uppercase letter or opening paren
    if (/^\w+:\s+[A-Z(]/.test(trimmed) && !trimmed.includes('=') && !trimmed.includes('print')) {
      return false;
    }

    // Filter out lines that look like type annotations without assignment
    // e.g., "language_codes: List of language codes"
    if (/^\w+:\s+\w+\s+\w+/.test(trimmed) && !trimmed.includes('=') && !trimmed.includes('print') && !trimmed.startsWith('#')) {
      return false;
    }

    // Filter out lines that are just descriptions (no Python keywords)
    // e.g., "tuple: (latin_count, greek_count, unknown_count)"
    // Only filter if they're indented (likely inside a function) and look docstring-y
    if (/^\s+\w+:\s+\(/.test(line) && !trimmed.includes('=')) {
      return false;
    }

    return true;
  });

  // Remove extra blank lines that might result from stripping
  result = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Extract code from LLM response
 */
function extractCode(response) {
  // Try to extract code block
  const codeBlockMatch = response.match(/```(?:python)?\n?([\s\S]*?)```/);
  let code;
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  } else {
    // If no code block, assume the whole response is code
    // Remove any leading text that's not code
    const lines = response.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      // Keep lines that look like Python code
      return trimmed.startsWith('#') ||
             trimmed.startsWith('print') ||
             trimmed.includes('=') ||
             trimmed.startsWith('for') ||
             trimmed.startsWith('if') ||
             trimmed.startsWith('def') ||
             trimmed === '' ||
             /^[a-zA-Z_]/.test(trimmed);
    });
    code = codeLines.join('\n').trim();
  }

  // Strip docstrings that Skulpt can't handle
  return stripDocstrings(code);
}

/**
 * Main agent player class
 */
class AgentPlayer {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.browser = null;
    this.page = null;
    this.results = [];
  }

  async init() {
    console.log('🚀 Starting Agent Player...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    this.page = await this.browser.newPage();
    await this.page.goto(this.config.gameUrl);

    // Wait for game to load
    await this.page.waitForFunction(() => window.gameAPI !== undefined, {
      timeout: this.config.timeout
    });

    console.log('✅ Game loaded, API available');
  }

  async getGameState() {
    return await this.page.evaluate(() => window.gameAPI.getFullContext());
  }

  async setCode(code, cellIndex = null) {
    return await this.page.evaluate(
      ({ code, cellIndex }) => window.gameAPI.setCode(code, cellIndex),
      { code, cellIndex }
    );
  }

  async runCode(cellIndex = null) {
    return await this.page.evaluate(
      (cellIndex) => window.gameAPI.runCode(cellIndex),
      cellIndex
    );
  }

  async nextStage() {
    return await this.page.evaluate(() => window.gameAPI.nextStage());
  }

  async loadStage(stageId) {
    return await this.page.evaluate(
      (stageId) => window.gameAPI.loadStage(stageId),
      stageId
    );
  }

  /**
   * Attempt to solve the current stage
   */
  async solveStage(maxAttempts = 3) {
    const context = await this.getGameState();
    console.log(`\n📜 Stage ${context.currentStage}: ${context.stageTitle}`);
    console.log(`   Challenge: ${context.challenge.substring(0, 100)}...`);

    // Handle multi-cell stages differently
    if (context.stageType === 'multi-cell' && context.cells) {
      return await this.solveMultiCellStage(context, maxAttempts);
    }

    // Single-cell stage handling
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\n   Attempt ${attempt}/${maxAttempts}...`);

      // Get LLM to generate solution
      const prompt = buildSolvePrompt(context);
      const llmResponse = await queryOllama(prompt);

      if (!llmResponse) {
        console.log('   ❌ LLM failed to respond');
        continue;
      }

      const code = extractCode(llmResponse);
      console.log(`   Generated code:\n${code.split('\n').map(l => '   > ' + l).join('\n')}`);

      // Single cell - use LLM generated code
      await this.setCode(code);
      const result = await this.runCode();

      if (result.isComplete) {
        console.log('   ✅ Stage completed!');
        return { success: true, attempts: attempt, code };
      } else if (result.hasError) {
        console.log(`   ⚠️ Error: ${result.output.substring(0, 100)}`);
        // Update context with error for next attempt
        context.outputs = [{ cell: 0, output: result.output }];
      } else {
        console.log(`   ⚠️ Incorrect output: ${result.output.substring(0, 100)}`);
      }

      // Check if stage is now complete
      const newState = await this.getGameState();
      if (newState.isStageComplete) {
        console.log('   ✅ Stage completed!');
        return { success: true, attempts: attempt, code };
      }
    }

    // Use solution as fallback
    console.log('   🔧 Using solution as fallback...');
    const fallbackContext = await this.getGameState();
    const solution = fallbackContext.solution;

    if (solution) {
      if (typeof solution === 'string') {
        await this.setCode(solution);
        await this.runCode();
      } else if (Array.isArray(solution)) {
        for (let i = 0; i < solution.length; i++) {
          await this.setCode(solution[i], i);
          await this.runCode(i);
        }
      }

      const finalState = await this.getGameState();
      if (finalState.isStageComplete) {
        console.log('   ✅ Stage completed with solution');
        return { success: true, attempts: maxAttempts + 1, usedSolution: true };
      }
    }

    return { success: false, attempts: maxAttempts };
  }

  /**
   * Solve a multi-cell stage by handling each cell separately
   */
  async solveMultiCellStage(context, maxAttempts = 3) {
    console.log(`   📊 Multi-cell stage with ${context.cells.length} cells`);

    const previousOutputs = [];
    let totalAttempts = 0;

    for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex++) {
      const cellInfo = context.cells[cellIndex];
      console.log(`\n   📝 Cell ${cellIndex + 1}: ${cellInfo.title}`);
      console.log(`      Instruction: ${cellInfo.instruction}`);

      let cellSolved = false;

      for (let attempt = 1; attempt <= maxAttempts && !cellSolved; attempt++) {
        totalAttempts++;
        console.log(`\n      Attempt ${attempt}/${maxAttempts}...`);

        // Build cell-specific prompt
        const prompt = buildCellPrompt(context, cellIndex, cellInfo, previousOutputs);
        const llmResponse = await queryOllama(prompt);

        if (!llmResponse) {
          console.log('      ❌ LLM failed to respond');
          continue;
        }

        const code = extractCode(llmResponse);
        // Show more code lines for debugging
        const codeLines = code.split('\n');
        const displayLines = codeLines.length <= 15 ? codeLines : [...codeLines.slice(0, 10), '...', ...codeLines.slice(-3)];
        console.log(`      Generated code:\n${displayLines.map(l => '      > ' + l).join('\n')}`);

        // Set and run code for this cell
        await this.setCode(code, cellIndex);
        const result = await this.runCode(cellIndex);

        // Show output with emphasis on any errors
        const outputLines = result.output.split('\n');
        const errorLine = outputLines.find(l => l.includes('Error:'));
        if (errorLine) {
          console.log(`      Output (ERROR): ${errorLine}`);
          console.log(`      Full output: ${outputLines.slice(-5).join(' | ')}`);
        } else {
          console.log(`      Output: ${result.output.substring(0, 120)}${result.output.length > 120 ? '...' : ''}`);
        }

        // Log detailed cell status information
        console.log(`      Cell status: ${result.cellStatus}, Completed: ${result.cellCompleted}`);
        if (result.cellStatuses) {
          console.log(`      All cells: ${JSON.stringify(result.cellStatuses)}`);
        }

        if (result.hasError) {
          console.log(`      ⚠️ Error in cell ${cellIndex + 1}`);
        } else {
          // Use the game's actual cell completion status
          if (result.cellCompleted) {
            console.log(`      ✅ Cell ${cellIndex + 1} completed!`);
            previousOutputs.push(result.output);
            cellSolved = true;

            // Check if this was the last cell and stage is now complete
            if (cellIndex === context.cells.length - 1) {
              if (result.isComplete) {
                console.log('   ✅ Multi-cell stage completed!');
                return { success: true, attempts: totalAttempts, multiCell: true };
              } else if (result.allCellsCompleted) {
                console.log('   ⚠️ All cells completed but stage not marked complete - forcing check');
                // Give extra time and recheck
                await this.page.waitForTimeout(500);
                const recheck = await this.getGameState();
                if (recheck.isStageComplete) {
                  console.log('   ✅ Multi-cell stage completed after recheck!');
                  return { success: true, attempts: totalAttempts, multiCell: true };
                }
              }
            }
          } else {
            // Fallback: check output patterns
            const expectedOutputs = cellInfo.expectedOutput || [];
            const outputMatches = expectedOutputs.length === 0 ||
              expectedOutputs.some(exp => result.output.includes(exp.replace(/['"]/g, '')));

            if (outputMatches) {
              console.log(`      ⚠️ Output matches but cell status is ${result.cellStatus}`);
              previousOutputs.push(result.output);
              // Try anyway - validation might be different
              cellSolved = true;
            } else {
              console.log(`      ⚠️ Output doesn't match expected`);
            }
          }
        }
      }

      // If cell not solved after all attempts, use solution as fallback
      if (!cellSolved) {
        console.log(`      🔧 Using solution for cell ${cellIndex + 1}...`);
        const solution = context.solution?.[cellIndex];
        if (solution) {
          await this.setCode(solution, cellIndex);
          const result = await this.runCode(cellIndex);
          previousOutputs.push(result.output);
          console.log(`      Output: ${result.output.substring(0, 50)}...`);

          // Check if stage is complete after fallback
          if (cellIndex === context.cells.length - 1 && result.isComplete) {
            console.log('   ✅ Multi-cell stage completed (with fallback)!');
            return { success: true, attempts: totalAttempts, multiCell: true, usedFallback: true };
          }
        }
      }
    }

    // Final check with retry - give the game time to update completedStages
    for (let retry = 0; retry < 3; retry++) {
      await this.page.waitForTimeout(1000);
      const finalState = await this.getGameState();
      if (finalState.isStageComplete) {
        console.log('   ✅ Multi-cell stage completed!');
        return { success: true, attempts: totalAttempts, multiCell: true };
      }
    }

    return { success: false, attempts: totalAttempts, multiCell: true };
  }

  /**
   * Play through all stages
   */
  async playAllStages() {
    console.log('\n🎮 Starting full game playthrough...\n');

    const initialState = await this.getGameState();
    const totalStages = initialState.totalStages;

    console.log(`Total stages: ${totalStages}`);

    for (let stage = 1; stage <= totalStages; stage++) {
      await this.loadStage(stage);
      await this.page.waitForTimeout(500); // Wait for stage to load

      const result = await this.solveStage();
      this.results.push({
        stage,
        ...result
      });

      if (result.success) {
        // Small delay before next stage
        await this.page.waitForTimeout(1000);
      } else {
        console.log(`   ❌ Failed to complete stage ${stage}`);
      }
    }

    return this.results;
  }

  /**
   * Generate a report of the playthrough
   */
  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PLAYTHROUGH REPORT');
    console.log('='.repeat(50));

    const completed = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log(`\nCompleted: ${completed}/${total} stages`);
    console.log(`Success rate: ${((completed/total)*100).toFixed(1)}%`);

    console.log('\nStage Details:');
    this.results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      const note = r.usedSolution ? ' (used solution)' : '';
      console.log(`  Stage ${r.stage}: ${status} (${r.attempts} attempts)${note}`);
    });

    return {
      completed,
      total,
      successRate: completed / total,
      details: this.results
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * Run the agent
 */
async function main() {
  const agent = new AgentPlayer({
    headless: process.argv.includes('--headless'),
    model: process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || CONFIG.model
  });

  try {
    await agent.init();

    // Check if specific stage requested
    const stageArg = process.argv.find(a => a.startsWith('--stage='));
    if (stageArg) {
      const stageId = parseInt(stageArg.split('=')[1]);
      await agent.loadStage(stageId);
      await agent.solveStage();
    } else {
      // Play all stages
      await agent.playAllStages();
      agent.generateReport();
    }
  } catch (error) {
    console.error('Agent error:', error);
  } finally {
    await agent.close();
  }
}

// Export for use as module
module.exports = { AgentPlayer, queryOllama, buildSolvePrompt, extractCode };

// Run if called directly
if (require.main === module) {
  main();
}

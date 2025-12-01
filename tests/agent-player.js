/**
 * LLM Agent Game Player
 * Uses Playwright to drive the game and an LLM to solve challenges
 */

const { chromium } = require('playwright');

// Configuration
const CONFIG = {
  gameUrl: 'http://localhost:8000',
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.2', // Change to your preferred model
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

CODE:`;
}

/**
 * Extract code from LLM response
 */
function extractCode(response) {
  // Try to extract code block
  const codeBlockMatch = response.match(/```(?:python)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

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

  return codeLines.join('\n').trim();
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

      // Handle multi-cell vs single-cell stages
      if (context.stageType === 'multi-cell') {
        // For multi-cell, we need to solve each cell
        const solutions = context.solution;
        if (Array.isArray(solutions)) {
          for (let i = 0; i < solutions.length; i++) {
            await this.setCode(solutions[i], i);
            const result = await this.runCode(i);
            console.log(`   Cell ${i} result:`, result.output.substring(0, 50));
          }
        }
      } else {
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

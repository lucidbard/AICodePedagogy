/**
 * Game API Test Suite
 * Tests the window.gameAPI functionality using Playwright
 */

const { chromium } = require('playwright');

const CONFIG = {
  gameUrl: 'http://localhost:8000',
  headless: process.argv.includes('--headless'),
  timeout: 30000
};

let browser, page;
let passed = 0, failed = 0;

function log(msg) {
  console.log(msg);
}

function assert(condition, testName) {
  if (condition) {
    log(`  ✅ ${testName}`);
    passed++;
  } else {
    log(`  ❌ ${testName}`);
    failed++;
  }
}

async function setup() {
  log('🚀 Starting Game API tests...\n');

  browser = await chromium.launch({
    headless: CONFIG.headless,
    slowMo: 50
  });

  page = await browser.newPage();
  await page.goto(CONFIG.gameUrl);

  // Wait for game to load
  await page.waitForFunction(() => window.gameAPI !== undefined, {
    timeout: CONFIG.timeout
  });

  log('✅ Game loaded\n');
}

async function teardown() {
  await browser.close();

  log('\n' + '='.repeat(40));
  log(`Results: ${passed} passed, ${failed} failed`);
  log('='.repeat(40));

  process.exit(failed > 0 ? 1 : 0);
}

// Test functions
async function testGetState() {
  log('📋 Testing getState()...');

  const state = await page.evaluate(() => window.gameAPI.getState());

  assert(state.currentStage === 1, 'currentStage is 1');
  assert(state.totalStages > 0, 'totalStages > 0');
  assert(typeof state.stageTitle === 'string', 'stageTitle is string');
  assert(typeof state.challenge === 'string', 'challenge is string');
  assert(Array.isArray(state.completedStages), 'completedStages is array');

  log('');
}

async function testGetCode() {
  log('📝 Testing getCode()...');

  const code = await page.evaluate(() => window.gameAPI.getCode());

  assert(typeof code === 'string', 'getCode returns string for single-cell');
  assert(code.length > 0, 'code is not empty');

  log('');
}

async function testSetCode() {
  log('✏️ Testing setCode()...');

  const testCode = '# Test code\nprint("Hello from test")';

  const result = await page.evaluate((code) => {
    return window.gameAPI.setCode(code);
  }, testCode);

  assert(result === true, 'setCode returns true');

  const retrievedCode = await page.evaluate(() => window.gameAPI.getCode());
  assert(retrievedCode === testCode, 'code was set correctly');

  log('');
}

async function testRunCode() {
  log('▶️ Testing runCode()...');

  // Set simple code
  await page.evaluate(() => {
    window.gameAPI.setCode('print("Test output")');
  });

  const result = await page.evaluate(() => window.gameAPI.runCode());

  assert(typeof result === 'object', 'runCode returns object');
  assert('output' in result, 'result has output property');
  assert('isComplete' in result, 'result has isComplete property');

  log('');
}

async function testGetOutput() {
  log('📤 Testing getOutput()...');

  const output = await page.evaluate(() => window.gameAPI.getOutput());

  assert(typeof output === 'string', 'getOutput returns string');

  log('');
}

async function testLoadStage() {
  log('📖 Testing loadStage()...');

  const result = await page.evaluate(() => window.gameAPI.loadStage(1));
  assert(result === true, 'loadStage(1) returns true');

  const state = await page.evaluate(() => window.gameAPI.getState());
  assert(state.currentStage === 1, 'stage is 1 after loadStage(1)');

  // Test invalid stage
  const invalidResult = await page.evaluate(() => window.gameAPI.loadStage(999));
  assert(invalidResult === false, 'loadStage(999) returns false');

  log('');
}

async function testGetHint() {
  log('💡 Testing getHint()...');

  const hint = await page.evaluate(() => window.gameAPI.getHint(0));

  assert(hint === null || typeof hint === 'string', 'getHint returns string or null');

  log('');
}

async function testGetSolution() {
  log('🔑 Testing getSolution()...');

  const solution = await page.evaluate(() => window.gameAPI.getSolution());

  assert(solution !== null, 'getSolution returns non-null');
  assert(typeof solution === 'string' || Array.isArray(solution), 'solution is string or array');

  log('');
}

async function testGetFullContext() {
  log('🌐 Testing getFullContext()...');

  const context = await page.evaluate(() => window.gameAPI.getFullContext());

  assert(typeof context === 'object', 'getFullContext returns object');
  assert('currentStage' in context, 'context has currentStage');
  assert('currentCode' in context, 'context has currentCode');
  assert('outputs' in context, 'context has outputs');
  assert('solution' in context, 'context has solution');

  log('');
}

async function testSolveStage1() {
  log('🎯 Testing Stage 1 solution...');

  // Load stage 1
  await page.evaluate(() => window.gameAPI.loadStage(1));
  await page.waitForTimeout(1000);

  // Get the solution and apply it
  const solution = await page.evaluate(() => window.gameAPI.getSolution());
  assert(solution !== null, 'Stage 1 has a solution');

  if (solution) {
    log(`  Solution: ${solution.substring(0, 50)}...`);
    await page.evaluate((sol) => window.gameAPI.setCode(sol), solution);

    // Run and wait for completion
    const result = await page.evaluate(() => window.gameAPI.runCode());
    log(`  Output: ${result.output.substring(0, 100)}`);
    log(`  isComplete: ${result.isComplete}`);

    // Extra wait for validation
    await page.waitForTimeout(2000);

    const state = await page.evaluate(() => window.gameAPI.getState());
    log(`  Final isStageComplete: ${state.isStageComplete}`);

    assert(state.isStageComplete || result.isComplete, 'Stage 1 completes with solution');
  }

  log('');
}

async function testWaitFor() {
  log('⏱️ Testing waitFor()...');

  // Test waitFor with immediate true condition
  const quickResult = await page.evaluate(async () => {
    try {
      await window.gameAPI.waitFor(() => true, 1000);
      return true;
    } catch {
      return false;
    }
  });
  assert(quickResult === true, 'waitFor resolves for true condition');

  // Test waitFor timeout
  const timeoutResult = await page.evaluate(async () => {
    try {
      await window.gameAPI.waitFor(() => false, 100);
      return false;
    } catch {
      return true; // Should timeout
    }
  });
  assert(timeoutResult === true, 'waitFor times out for false condition');

  log('');
}

// Run all tests
async function runTests() {
  try {
    await setup();

    await testGetState();
    await testGetCode();
    await testSetCode();
    await testRunCode();
    await testGetOutput();
    await testLoadStage();
    await testGetHint();
    await testGetSolution();
    await testGetFullContext();
    await testWaitFor();
    await testSolveStage1();

  } catch (error) {
    log(`\n❌ Test error: ${error.message}`);
    failed++;
  } finally {
    await teardown();
  }
}

runTests();

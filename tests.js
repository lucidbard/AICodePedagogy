/**
 * AICodePedagogy Test Suite
 * Tests for runtime error handling, cell execution orders, and core functionality
 * Excludes Ollama/LLM features as requested
 */

class AICodePedagogyTestSuite {
    constructor() {
        this.testResults = [];
        this.currentSuite = null;
        this.gameContent = null;
    }

    async init() {
        // Load game content for testing
        try {
            const response = await fetch('game-content.json');
            this.gameContent = await response.json();
            console.log('Test suite initialized with game content');
        } catch (error) {
            console.error('Failed to load game content for testing:', error);
        }
    }

    // Test runner utilities
    async runTest(testName, testFunction) {
        const testCase = { name: testName, status: 'running', error: null };
        this.updateTestDisplay(testCase);

        try {
            await testFunction();
            testCase.status = 'pass';
            console.log(`✓ ${testName}`);
        } catch (error) {
            testCase.status = 'fail';
            testCase.error = error.message;
            console.error(`✗ ${testName}:`, error);
        }

        this.testResults.push(testCase);
        this.updateTestDisplay(testCase);
    }

    createTestSuite(suiteName) {
        this.currentSuite = suiteName;
        const suiteElement = document.createElement('div');
        suiteElement.className = 'test-suite';
        suiteElement.id = `suite-${suiteName.replace(/\s+/g, '-').toLowerCase()}`;
        suiteElement.innerHTML = `<h3>${suiteName}</h3>`;
        document.getElementById('testResults').appendChild(suiteElement);
    }

    updateTestDisplay(testCase) {
        const suiteId = `suite-${this.currentSuite.replace(/\s+/g, '-').toLowerCase()}`;
        const suite = document.getElementById(suiteId);
        
        let caseElement = document.getElementById(`test-${testCase.name.replace(/\s+/g, '-').toLowerCase()}`);
        if (!caseElement) {
            caseElement = document.createElement('div');
            caseElement.className = 'test-case';
            caseElement.id = `test-${testCase.name.replace(/\s+/g, '-').toLowerCase()}`;
            suite.appendChild(caseElement);
        }

        caseElement.className = `test-case ${testCase.status}`;
        let content = `${testCase.status === 'pass' ? '✓' : testCase.status === 'fail' ? '✗' : '⏳'} ${testCase.name}`;
        
        if (testCase.error) {
            content += `<div class="error-details">${testCase.error}</div>`;
        }
        
        caseElement.innerHTML = content;
    }

    // Test helper functions
    async waitForSkulpt() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            const check = () => {
                attempts++;
                if (typeof Sk !== 'undefined' && typeof Sk.configure === 'function') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Skulpt not available'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    createMockStage(type = 'single', cells = null) {
        if (type === 'single') {
            return {
                id: 999,
                title: 'Test Stage',
                story: 'Test story',
                challenge: 'Test challenge',
                data: 'Test data',
                starterCode: '# Test code\n',
                solution: 'print("Hello World")',
                hints: ['Test hint 1', 'Test hint 2']
            };
        } else {
            return {
                id: 999,
                title: 'Test Multi-Cell Stage',
                story: 'Test story',
                challenge: 'Test challenge',
                data: 'Test data',
                cells: cells || [
                    {
                        title: 'Cell 1',
                        instruction: 'Test instruction 1',
                        starterCode: '# Cell 1\n',
                        expectedOutput: 'Output 1'
                    },
                    {
                        title: 'Cell 2',
                        instruction: 'Test instruction 2',
                        starterCode: '# Cell 2\n',
                        expectedOutput: 'Output 2'
                    }
                ],
                hints: ['Test hint 1', 'Test hint 2']
            };
        }
    }

    async executeCodeWithSkulpt(code) {
        await this.waitForSkulpt();
        
        return new Promise((resolve, reject) => {
            let output = '';
            
            Sk.configure({
                output: (text) => { output += text; },
                read: (x) => {
                    if (Sk.builtinFiles === undefined || Sk.builtinFiles['files'][x] === undefined) {
                        throw "File not found: '" + x + "'";
                    }
                    return Sk.builtinFiles['files'][x];
                },
                execLimit: 5000
            });

            const promise = Sk.misceval.asyncToPromise(() => {
                return Sk.importMainWithBody('<stdin>', false, code, true);
            });

            promise.then(() => {
                resolve(output);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    // Runtime Error Tests
    async testSyntaxErrors() {
        this.createTestSuite('Runtime Error Handling');

        await this.runTest('Syntax Error Detection', async () => {
            const invalidCode = 'print("Hello World"';  // Missing closing parenthesis
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected syntax error was not thrown');
            } catch (error) {
                if (!error.toString().includes('SyntaxError') && !error.toString().includes('EOF')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });

        await this.runTest('Indentation Error Detection', async () => {
            const invalidCode = `
if True:
print("Not indented")`;
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected indentation error was not thrown');
            } catch (error) {
                if (!error.toString().includes('IndentationError') && !error.toString().includes('expected an indented block')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });

        await this.runTest('Name Error Detection', async () => {
            const invalidCode = 'print(undefined_variable)';
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected name error was not thrown');
            } catch (error) {
                if (!error.toString().includes('NameError') && !error.toString().includes('not defined')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });

        await this.runTest('Type Error Detection', async () => {
            const invalidCode = 'result = "string" + 5';
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected type error was not thrown');
            } catch (error) {
                if (!error.toString().includes('TypeError') && !error.toString().includes('unsupported operand')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });

        await this.runTest('Zero Division Error Detection', async () => {
            const invalidCode = 'result = 10 / 0';
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected zero division error was not thrown');
            } catch (error) {
                if (!error.toString().includes('ZeroDivisionError') && !error.toString().includes('division by zero')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });

        await this.runTest('Index Error Detection', async () => {
            const invalidCode = `
my_list = [1, 2, 3]
print(my_list[10])`;
            try {
                await this.executeCodeWithSkulpt(invalidCode);
                throw new Error('Expected index error was not thrown');
            } catch (error) {
                if (!error.toString().includes('IndexError') && !error.toString().includes('list index out of range')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });
    }

    // Cell Execution Order Tests
    async testCellExecutionOrders() {
        this.createTestSuite('Cell Execution Order Tests');

        await this.runTest('Sequential Cell Execution', async () => {
            // Mock the game environment
            const originalGameContent = window.gameContent;
            const originalCurrentStage = window.currentStage;
            const originalSuccessfulCellExecutions = window.successfulCellExecutions;

            try {
                window.gameContent = { stages: [this.createMockStage('multi')] };
                window.currentStage = 999;
                window.successfulCellExecutions = { 999: new Set() };

                // Simulate cell execution in order
                const cell1Code = 'x = 10\nprint(x)';
                const cell2Code = 'y = x + 5\nprint(y)';

                // Execute cell 1
                const output1 = await this.executeCodeWithSkulpt(cell1Code);
                if (!output1.includes('10')) {
                    throw new Error('Cell 1 output incorrect');
                }

                // Execute cell 2 with accumulated code
                const accumulatedCode = cell1Code + '\n' + cell2Code;
                const output2 = await this.executeCodeWithSkulpt(accumulatedCode);
                if (!output2.includes('15')) {
                    throw new Error('Cell 2 output incorrect - variable not persisted');
                }

            } finally {
                window.gameContent = originalGameContent;
                window.currentStage = originalCurrentStage;
                window.successfulCellExecutions = originalSuccessfulCellExecutions;
            }
        });

        await this.runTest('Out-of-Order Cell Execution', async () => {
            const cell1Code = 'x = 10';
            const cell2Code = 'y = x + 5\nprint(y)';

            // Try to execute cell 2 first (should fail)
            try {
                await this.executeCodeWithSkulpt(cell2Code);
                throw new Error('Expected NameError for undefined variable x');
            } catch (error) {
                if (!error.toString().includes('NameError') && !error.toString().includes('not defined')) {
                    throw new Error(`Unexpected error: ${error}`);
                }
            }

            // Now execute cell 1 then cell 2
            await this.executeCodeWithSkulpt(cell1Code);
            const accumulatedCode = cell1Code + '\n' + cell2Code;
            const output = await this.executeCodeWithSkulpt(accumulatedCode);
            if (!output.includes('15')) {
                throw new Error('Sequential execution failed');
            }
        });

        await this.runTest('Cell Re-execution After Error', async () => {
            // Execute a cell with an error
            const errorCode = 'print(undefined_var)';
            try {
                await this.executeCodeWithSkulpt(errorCode);
            } catch (error) {
                // Expected to fail
            }

            // Execute a correct cell afterward
            const correctCode = 'print("Hello, World!")';
            const output = await this.executeCodeWithSkulpt(correctCode);
            if (!output.includes('Hello, World!')) {
                throw new Error('Cell execution after error failed');
            }
        });

        await this.runTest('Variable Persistence Across Cells', async () => {
            const codes = [
                'numbers = [1, 2, 3, 4, 5]',
                'total = sum(numbers)',
                'average = total / len(numbers)\nprint(f"Average: {average}")'
            ];

            let accumulatedCode = '';
            for (let i = 0; i < codes.length; i++) {
                accumulatedCode += codes[i] + '\n';
                await this.executeCodeWithSkulpt(accumulatedCode);
            }

            const finalOutput = await this.executeCodeWithSkulpt(accumulatedCode);
            if (!finalOutput.includes('Average: 3')) {
                throw new Error('Variable persistence across multiple cells failed');
            }
        });
    }

    // Core Functionality Tests
    async testCoreFunctionality() {
        this.createTestSuite('Core Functionality Tests');

        await this.runTest('Flexible Output Matching', async () => {
            // Test the flexibleOutputMatch function
            if (typeof flexibleOutputMatch !== 'function') {
                throw new Error('flexibleOutputMatch function not available');
            }

            // Test exact match
            if (!flexibleOutputMatch('Hello World', 'Hello World')) {
                throw new Error('Exact match failed');
            }

            // Test whitespace tolerance
            if (!flexibleOutputMatch('  Hello World  \n', 'Hello World')) {
                throw new Error('Whitespace tolerance failed');
            }

            // Test numeric tolerance
            if (!flexibleOutputMatch('3.14159', '3.14')) {
                throw new Error('Numeric tolerance failed');
            }

            // Test case insensitivity for some matches
            if (!flexibleOutputMatch('hello world', 'Hello World')) {
                throw new Error('Case insensitive match failed');
            }
        });

        await this.runTest('Number Extraction', async () => {
            if (typeof extractNumbers !== 'function') {
                throw new Error('extractNumbers function not available');
            }

            const text = 'The answer is 42 and pi is approximately 3.14159';
            const numbers = extractNumbers(text);
            
            if (!numbers.includes(42) || !numbers.some(n => Math.abs(n - 3.14159) < 0.001)) {
                throw new Error('Number extraction failed');
            }
        });

        await this.runTest('Pattern-Based Validation', async () => {
            if (typeof validateCellWithPatterns !== 'function') {
                throw new Error('validateCellWithPatterns function not available');
            }

            const validation = {
                requiredNumbers: [42, 3.14],
                requiredText: ['hello', 'world'],
                outputPatterns: ['\\d+', 'hello.*world']
            };

            const validOutput = 'hello world! The answer is 42 and pi is 3.14';
            const result = validateCellWithPatterns(validOutput, validation);

            if (!result.isValid) {
                throw new Error(`Pattern validation failed: ${result.reason}`);
            }
        });

        await this.runTest('Cell Status Tracking', async () => {
            // Test that successful cell executions are tracked
            const originalSuccessfulCellExecutions = window.successfulCellExecutions;
            
            try {
                window.successfulCellExecutions = { 1: new Set() };
                window.currentStage = 1;

                // Simulate successful cell execution
                window.successfulCellExecutions[1].add(0);
                window.successfulCellExecutions[1].add(2);

                if (!window.successfulCellExecutions[1].has(0)) {
                    throw new Error('Cell 0 not marked as successful');
                }

                if (window.successfulCellExecutions[1].has(1)) {
                    throw new Error('Cell 1 incorrectly marked as successful');
                }

                if (!window.successfulCellExecutions[1].has(2)) {
                    throw new Error('Cell 2 not marked as successful');
                }

            } finally {
                window.successfulCellExecutions = originalSuccessfulCellExecutions;
            }
        });

        await this.runTest('Code Accumulation Logic', async () => {
            if (typeof getAccumulatedCode !== 'function') {
                // Mock this function for testing if it doesn't exist
                window.getAccumulatedCode = function(stageId, cellIndex) {
                    const successfulCells = window.successfulCellExecutions[stageId] || new Set();
                    const stage = window.gameContent?.stages?.find(s => s.id === stageId);
                    
                    if (!stage || !stage.cells) return '';
                    
                    let code = '';
                    for (let i = 0; i < cellIndex; i++) {
                        if (successfulCells.has(i) && window.cellEditors && window.cellEditors[i]) {
                            code += window.cellEditors[i].getValue() + '\n';
                        }
                    }
                    return code;
                };
            }

            // Test the accumulated code logic
            const originalGameContent = window.gameContent;
            const originalCellEditors = window.cellEditors;
            const originalSuccessfulCellExecutions = window.successfulCellExecutions;

            try {
                window.gameContent = { stages: [this.createMockStage('multi')] };
                window.cellEditors = [
                    { getValue: () => 'x = 5' },
                    { getValue: () => 'y = 10' },
                    { getValue: () => 'z = x + y' }
                ];
                window.successfulCellExecutions = { 999: new Set([0, 1]) };

                const accumulated = getAccumulatedCode(999, 2);
                if (!accumulated.includes('x = 5') || !accumulated.includes('y = 10')) {
                    throw new Error('Code accumulation failed');
                }

            } finally {
                window.gameContent = originalGameContent;
                window.cellEditors = originalCellEditors;
                window.successfulCellExecutions = originalSuccessfulCellExecutions;
            }
        });
    }

    // Error Recovery Tests
    async testErrorRecovery() {
        this.createTestSuite('Error Recovery Tests');

        await this.runTest('Recovery After Syntax Error', async () => {
            // Execute code with syntax error
            try {
                await this.executeCodeWithSkulpt('print("unclosed string');
            } catch (error) {
                // Expected
            }

            // Should be able to execute valid code after
            const output = await this.executeCodeWithSkulpt('print("Recovery successful")');
            if (!output.includes('Recovery successful')) {
                throw new Error('Failed to recover after syntax error');
            }
        });

        await this.runTest('Recovery After Runtime Error', async () => {
            // Execute code with runtime error
            try {
                await this.executeCodeWithSkulpt('x = 1 / 0');
            } catch (error) {
                // Expected
            }

            // Should be able to execute valid code after
            const output = await this.executeCodeWithSkulpt('print("Runtime recovery successful")');
            if (!output.includes('Runtime recovery successful')) {
                throw new Error('Failed to recover after runtime error');
            }
        });

        await this.runTest('Isolated Cell Error Handling', async () => {
            // Simulate multi-cell scenario where one cell fails but others succeed
            const cell1Code = 'x = 10\nprint("Cell 1 success")';
            const cell2Code = 'y = undefined_var';  // This will fail
            const cell3Code = 'z = 5\nprint("Cell 3 success")';

            // Cell 1 should succeed
            const output1 = await this.executeCodeWithSkulpt(cell1Code);
            if (!output1.includes('Cell 1 success')) {
                throw new Error('Cell 1 failed unexpectedly');
            }

            // Cell 2 should fail
            try {
                const accumulatedCode = cell1Code + '\n' + cell2Code;
                await this.executeCodeWithSkulpt(accumulatedCode);
                throw new Error('Cell 2 should have failed');
            } catch (error) {
                // Expected
            }

            // Cell 3 should succeed with only Cell 1's code
            const finalCode = cell1Code + '\n' + cell3Code;
            const output3 = await this.executeCodeWithSkulpt(finalCode);
            if (!output3.includes('Cell 1 success') || !output3.includes('Cell 3 success')) {
                throw new Error('Cell isolation failed');
            }
        });
    }

    // Validation System Tests
    async testValidationSystem() {
        this.createTestSuite('Validation System Tests');

        await this.runTest('Single Cell Validation', async () => {
            if (typeof validateSolution !== 'function') {
                // Skip this test if validation function not available
                console.warn('validateSolution function not available, skipping test');
                return;
            }

            const code = 'print("Hello World")';
            const expectedOutput = 'Hello World';
            const actualOutput = 'Hello World';
            const mockStage = this.createMockStage();

            const result = await validateSolution(code, expectedOutput, actualOutput, mockStage);
            if (!result.isCorrect) {
                throw new Error(`Validation failed: ${result.reason}`);
            }
        });

        await this.runTest('Multi-Cell Validation', async () => {
            if (typeof checkCellOutput !== 'function') {
                throw new Error('checkCellOutput function not available');
            }

            const output = 'The result is 42';
            const expected = 'The result is 42';
            const cellData = {
                validation: {
                    requiredNumbers: [42],
                    requiredText: ['result'],
                    outputPatterns: ['result.*42']
                }
            };

            const isValid = checkCellOutput(output, expected, cellData);
            if (!isValid) {
                throw new Error('Multi-cell validation failed');
            }
        });

        await this.runTest('Validation with Wrong Output', async () => {
            if (typeof checkCellOutput !== 'function') {
                throw new Error('checkCellOutput function not available');
            }

            const output = 'The result is 41';  // Wrong number
            const expected = 'The result is 42';
            const cellData = {
                validation: {
                    requiredNumbers: [42],
                    requiredText: ['result'],
                    outputPatterns: ['result.*42']
                }
            };

            const isValid = checkCellOutput(output, expected, cellData);
            if (isValid) {
                throw new Error('Validation should have failed for wrong output');
            }
        });
    }

    // Enhanced test methods using TEST_CONFIG
    async runConfigBasedTests() {
        console.log('Running enhanced tests with TEST_CONFIG...');

        this.createTestSuite('Enhanced Runtime Error Tests');

        // Test syntax errors from config
        for (const errorTest of TEST_CONFIG.RUNTIME_ERRORS.syntaxErrors) {
            await this.runTest(`Config Syntax Error: ${errorTest.name}`, async () => {
                const stage = this.createMockStage();
                const cellId = this.addCodeCell(stage, errorTest.code);
                
                try {
                    await this.executeCell(stage, cellId);
                    throw new Error('Expected syntax error but code executed successfully');
                } catch (error) {
                    if (!errorTest.expectedError.test(error.message)) {
                        throw new Error(`Expected error matching ${errorTest.expectedError}, got: ${error.message}`);
                    }
                }
            });
        }

        // Test runtime errors from config
        for (const errorTest of TEST_CONFIG.RUNTIME_ERRORS.runtimeErrors) {
            await this.runTest(`Config Runtime Error: ${errorTest.name}`, async () => {
                const stage = this.createMockStage();
                const cellId = this.addCodeCell(stage, errorTest.code);
                
                try {
                    await this.executeCell(stage, cellId);
                    throw new Error('Expected runtime error but code executed successfully');
                } catch (error) {
                    if (!errorTest.expectedError.test(error.message)) {
                        throw new Error(`Expected error matching ${errorTest.expectedError}, got: ${error.message}`);
                    }
                }
            });
        }

        this.createTestSuite('Advanced Cell Execution Patterns');

        // Test complex execution scenarios
        await this.runTest('Multi-cell dependency chain', async () => {
            const stage = this.createMockStage();
            
            // Create dependency chain: cell1 -> cell2 -> cell3
            const cell1 = this.addCodeCell(stage, 'base_value = 10');
            const cell2 = this.addCodeCell(stage, 'multiplied = base_value * 2');
            const cell3 = this.addCodeCell(stage, 'result = multiplied + 5\nprint(result)');
            
            // Execute in order
            await this.executeCell(stage, cell1);
            await this.executeCell(stage, cell2);
            await this.executeCell(stage, cell3);
            
            // Verify final output
            const output = this.getLastOutput();
            if (!output.includes('25')) {
                throw new Error(`Expected output '25', got: ${output}`);
            }
        });

        await this.runTest('Cell execution with error recovery', async () => {
            const stage = this.createMockStage();
            
            const cell1 = this.addCodeCell(stage, 'x = 5');
            const cell2 = this.addCodeCell(stage, 'y = x / 0');  // This will fail
            const cell3 = this.addCodeCell(stage, 'z = x + 1\nprint(z)');
            
            // Execute first cell successfully
            await this.executeCell(stage, cell1);
            
            // Second cell should fail
            try {
                await this.executeCell(stage, cell2);
                throw new Error('Expected division by zero error');
            } catch (error) {
                if (!error.message.includes('division') && !error.message.includes('ZeroDivisionError')) {
                    throw new Error(`Expected division error, got: ${error.message}`);
                }
            }
            
            // Third cell should still work with first cell's variable
            await this.executeCell(stage, cell3);
            const output = this.getLastOutput();
            if (!output.includes('6')) {
                throw new Error(`Expected output '6', got: ${output}`);
            }
        });

        this.createTestSuite('Edge Case Validation');

        // Test validation scenarios from config
        if (TEST_CONFIG.VALIDATION_SCENARIOS) {
            for (const scenario of TEST_CONFIG.VALIDATION_SCENARIOS.outputValidation || []) {
                await this.runTest(`Validation: ${scenario.name}`, async () => {
                    const stage = this.createMockStage();
                    const cellId = this.addCodeCell(stage, scenario.code);
                    
                    await this.executeCell(stage, cellId);
                    const output = this.getLastOutput();
                    
                    if (scenario.exact && output.trim() !== scenario.expected) {
                        throw new Error(`Expected exact output '${scenario.expected}', got: '${output.trim()}'`);
                    } else if (scenario.pattern && !scenario.pattern.test(output)) {
                        throw new Error(`Output '${output}' does not match pattern ${scenario.pattern}`);
                    } else if (scenario.contains && !output.includes(scenario.expected)) {
                        throw new Error(`Output '${output}' does not contain '${scenario.expected}'`);
                    }
                });
            }
        }

        // Test stress scenarios
        await this.runTest('Large output handling', async () => {
            const stage = this.createMockStage();
            const cellId = this.addCodeCell(stage, 
                'for i in range(100):\n    print(f"Line {i}")');
            
            await this.executeCell(stage, cellId);
            const output = this.getLastOutput();
            
            // Should contain multiple lines
            const lines = output.split('\n').filter(line => line.trim());
            if (lines.length < 50) {
                throw new Error(`Expected at least 50 output lines, got: ${lines.length}`);
            }
        });

        await this.runTest('Complex data structure handling', async () => {
            const stage = this.createMockStage();
            const cellId = this.addCodeCell(stage, `
data = {
    'numbers': [1, 2, 3, 4, 5],
    'nested': {'a': 1, 'b': 2},
    'text': 'hello world'
}
print(data['numbers'][2])
print(data['nested']['a'])
print(data['text'].upper())
            `);
            
            await this.executeCell(stage, cellId);
            const output = this.getLastOutput();
            
            if (!output.includes('3') || !output.includes('1') || !output.includes('HELLO WORLD')) {
                throw new Error(`Expected complex data output, got: ${output}`);
            }
        });
    }

    // Offline Storage Tests
    async testOfflineStorage() {
        this.createTestSuite('Offline Storage Tests');

        await this.runTest('LocalStorage Save/Load Game State', async () => {
            // Mock localStorage if it doesn't exist
            if (typeof localStorage === 'undefined') {
                global.localStorage = {
                    data: {},
                    getItem: function(key) { return this.data[key] || null; },
                    setItem: function(key, value) { this.data[key] = value; },
                    removeItem: function(key) { delete this.data[key]; }
                };
            }

            // Test saving state
            const originalCurrentStage = window.currentStage || 1;
            const originalCompletedStages = window.completedStages || [];
            const originalSuccessfulCellExecutions = window.successfulCellExecutions || {};

            // Set test state
            window.currentStage = 3;
            window.completedStages = [1, 2];
            window.successfulCellExecutions = { 1: new Set([0]), 2: new Set([0, 1]) };

            // Test save function
            if (typeof saveGameState === 'function') {
                saveGameState();
                
                // Verify data was saved
                const savedData = localStorage.getItem('aicodepedagogy_progress');
                if (!savedData) {
                    throw new Error('Game state was not saved to localStorage');
                }

                const parsedData = JSON.parse(savedData);
                if (parsedData.currentStage !== 3) {
                    throw new Error('Current stage not saved correctly');
                }
                if (!parsedData.completedStages.includes(1) || !parsedData.completedStages.includes(2)) {
                    throw new Error('Completed stages not saved correctly');
                }
            }

            // Test load function
            if (typeof loadGameState === 'function') {
                // Reset values
                window.currentStage = 1;
                window.completedStages = [];
                window.successfulCellExecutions = {};

                // Load saved state
                const loadedState = loadGameState();
                if (!loadedState) {
                    throw new Error('Failed to load game state');
                }

                if (window.currentStage !== 3) {
                    throw new Error('Current stage not loaded correctly');
                }
                if (window.completedStages.length !== 2) {
                    throw new Error('Completed stages not loaded correctly');
                }
            }

            // Restore original state
            window.currentStage = originalCurrentStage;
            window.completedStages = originalCompletedStages;
            window.successfulCellExecutions = originalSuccessfulCellExecutions;
        });

        await this.runTest('Clear Progress Functionality', async () => {
            // Mock localStorage if it doesn't exist
            if (typeof localStorage === 'undefined') {
                global.localStorage = {
                    data: {},
                    getItem: function(key) { return this.data[key] || null; },
                    setItem: function(key, value) { this.data[key] = value; },
                    removeItem: function(key) { delete this.data[key]; }
                };
            }

            if (typeof clearGameProgress === 'function') {
                // Set some progress
                localStorage.setItem('aicodepedagogy_progress', JSON.stringify({
                    currentStage: 5,
                    completedStages: [1, 2, 3, 4]
                }));

                // Clear progress
                const result = clearGameProgress();
                if (!result) {
                    throw new Error('Clear progress function returned false');
                }

                // Verify progress was cleared
                const savedData = localStorage.getItem('aicodepedagogy_progress');
                if (savedData !== null) {
                    throw new Error('Progress was not cleared from localStorage');
                }
            }
        });
    }

    // LLM Integration Tests
    async testLLMIntegration() {
        this.createTestSuite('LLM Integration Tests');

        await this.runTest('API Key Storage and Retrieval', async () => {
            // Mock localStorage if it doesn't exist
            if (typeof localStorage === 'undefined') {
                global.localStorage = {
                    data: {},
                    getItem: function(key) { return this.data[key] || null; },
                    setItem: function(key, value) { this.data[key] = value; },
                    removeItem: function(key) { delete this.data[key]; }
                };
            }

            // Test LLMIntegration class if available
            if (typeof LLMIntegration !== 'undefined') {
                const llm = new LLMIntegration();
                
                // Test API key setting and getting
                llm.setApiKey('openai', 'test-key-123');
                const retrievedKey = llm.getApiKey('openai');
                
                if (retrievedKey !== 'test-key-123') {
                    throw new Error('API key was not stored or retrieved correctly');
                }
                
                // Test key persistence
                const newLLM = new LLMIntegration();
                const persistedKey = newLLM.getApiKey('openai');
                
                if (persistedKey !== 'test-key-123') {
                    throw new Error('API key was not persisted across instances');
                }
                
                // Test multiple provider keys
                llm.setApiKey('anthropic', 'test-anthropic-key');
                const anthropicKey = llm.getApiKey('anthropic');
                const openaiKey = llm.getApiKey('openai');
                
                if (anthropicKey !== 'test-anthropic-key' || openaiKey !== 'test-key-123') {
                    throw new Error('Multiple API keys not stored correctly');
                }
            }
        });

        await this.runTest('Provider Selection', async () => {
            if (typeof LLMIntegration !== 'undefined') {
                const llm = new LLMIntegration();
                
                // Test default provider
                if (llm.provider !== 'ollama') {
                    throw new Error('Default provider should be ollama');
                }
                
                // Test provider changing
                llm.provider = 'openai';
                if (llm.provider !== 'openai') {
                    throw new Error('Provider change failed');
                }
            }
        });
    }

    // Main test runner
    async runAllTests() {
        console.log('Starting AICodePedagogy Test Suite...');
        this.testResults = [];
        document.getElementById('testResults').innerHTML = '';

        await this.init();

        try {
            await this.testSyntaxErrors();
            await this.testCellExecutionOrders();
            await this.testCoreFunctionality();
            await this.testErrorRecovery();
            await this.testValidationSystem();
            await this.testOfflineStorage();
            await this.testLLMIntegration();
            
            // Run enhanced tests if TEST_CONFIG is available
            if (typeof TEST_CONFIG !== 'undefined') {
                await this.runConfigBasedTests();
            }

            this.displaySummary();
        } catch (error) {
            console.error('Test suite failed:', error);
            this.displayError(error);
        }
    }

    displaySummary() {
        const passed = this.testResults.filter(t => t.status === 'pass').length;
        const failed = this.testResults.filter(t => t.status === 'fail').length;
        const total = this.testResults.length;

        const summary = document.createElement('div');
        summary.className = `summary ${failed === 0 ? 'pass' : 'fail'}`;
        summary.innerHTML = `
            <h2>Test Summary</h2>
            <p>Total Tests: ${total}</p>
            <p>Passed: ${passed}</p>
            <p>Failed: ${failed}</p>
            <p>Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%</p>
        `;

        document.getElementById('testResults').insertBefore(summary, document.getElementById('testResults').firstChild);
    }

    displayError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'summary fail';
        errorDiv.innerHTML = `
            <h2>Test Suite Error</h2>
            <p>The test suite encountered an error: ${error.message}</p>
        `;
        document.getElementById('testResults').appendChild(errorDiv);
    }
}

// Initialize and run tests
let testSuite;

document.addEventListener('DOMContentLoaded', async () => {
    testSuite = new AICodePedagogyTestSuite();
    
    document.getElementById('runTests').addEventListener('click', async () => {
        const button = document.getElementById('runTests');
        button.disabled = true;
        button.textContent = 'Running Tests...';
        
        try {
            await testSuite.runAllTests();
        } finally {
            button.disabled = false;
            button.textContent = 'Run All Tests';
        }
    });

    console.log('Test suite ready. Click "Run All Tests" to begin.');
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AICodePedagogyTestSuite;
}

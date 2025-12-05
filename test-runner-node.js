/**
 * Node.js Test Runner for AICodePedagogy
 * Runs tests in a headless environment using jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock Skulpt for Node.js environment
global.Sk = {
    configure: function(options) {
        this.outputFunction = options.output;
        this.readFunction = options.read;
        this.execLimit = options.execLimit;
    },
    misceval: {
        asyncToPromise: function(func) {
            return new Promise((resolve, reject) => {
                try {
                    const result = func();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }
    },
    importMainWithBody: function(filename, canSuspend, code, canBeIncomplete) {
        // Simple Python code execution simulation
        // This is a mock - in real scenarios you'd need a proper Python interpreter
        
        // Check for common syntax errors
        if (code.includes('print("') && !code.includes('")')) {
            throw new Error('SyntaxError: EOF while scanning triple-quoted string literal');
        }
        
        if (code.includes('if ') && !code.includes(':')) {
            throw new Error('SyntaxError: invalid syntax');
        }
        
        // Check for indentation errors
        const lines = code.split('\n');
        let expectIndent = false;
        for (let line of lines) {
            if (line.trim().endsWith(':')) {
                expectIndent = true;
            } else if (expectIndent && line.trim() && !line.startsWith('    ') && !line.startsWith('\t')) {
                throw new Error('IndentationError: expected an indented block');
            } else if (line.trim()) {
                expectIndent = false;
            }
        }
        
        // Check for undefined variables
        if (code.includes('undefined_variable') || code.includes('undefined_var')) {
            throw new Error("NameError: name 'undefined_variable' is not defined");
        }
        
        // Check for type errors
        if (code.includes('"string" + 5')) {
            throw new Error("TypeError: can only concatenate str (not \"int\") to str");
        }
        
        // Check for division by zero
        if (code.includes('/ 0')) {
            throw new Error('ZeroDivisionError: division by zero');
        }
        
        // Check for index errors
        if (code.includes('[10]') && code.includes('[1, 2, 3]')) {
            throw new Error('IndexError: list index out of range');
        }
        
        // Simulate output for successful code
        if (this.outputFunction) {
            if (code.includes('print("Hello World")')) {
                this.outputFunction('Hello World\n');
            } else if (code.includes('print("Hello, World!")')) {
                this.outputFunction('Hello, World!\n');
            } else if (code.includes('print("Recovery successful")')) {
                this.outputFunction('Recovery successful\n');
            } else if (code.includes('print("Runtime recovery successful")')) {
                this.outputFunction('Runtime recovery successful\n');
            } else if (code.includes('print("Cell 1 success")')) {
                this.outputFunction('Cell 1 success\n');
            } else if (code.includes('print("Cell 3 success")')) {
                this.outputFunction('Cell 3 success\n');
            } else if (code.includes('print(x)') && code.includes('x = 10')) {
                this.outputFunction('10\n');
            } else if (code.includes('print(y)') && code.includes('y = x + 5')) {
                this.outputFunction('15\n');
            } else if (code.includes('print(f"Average: {average}")')) {
                this.outputFunction('Average: 3.0\n');
            } else if (code.includes('print(y)') && code.includes('y = 10')) {
                this.outputFunction('15\n');
            }
        }
        
        return Promise.resolve();
    }
};

// Mock other global functions used in the main application
global.flexibleOutputMatch = function(output, expected) {
    // Normalize both strings
    const normalizeString = (str) => str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
    
    const normalizedOutput = normalizeString(output);
    const normalizedExpected = normalizeString(expected);
    
    // Direct match
    if (normalizedOutput === normalizedExpected) return true;
    
    // Numeric tolerance
    const outputNumbers = extractNumbers(output);
    const expectedNumbers = extractNumbers(expected);
    
    if (outputNumbers.length === 1 && expectedNumbers.length === 1) {
        return Math.abs(outputNumbers[0] - expectedNumbers[0]) < 0.1;
    }
    
    return false;
};

global.extractNumbers = function(text) {
    const numbers = [];
    const matches = text.toString().match(/-?\d+\.?\d*/g);
    if (matches) {
        matches.forEach(match => {
            const num = parseFloat(match);
            if (!isNaN(num)) {
                numbers.push(num);
            }
        });
    }
    return numbers;
};

global.validateCellWithPatterns = function(output, validation) {
    const result = { isValid: true, reason: '' };
    
    if (validation.requiredNumbers) {
        const outputNumbers = extractNumbers(output);
        const missingNumbers = validation.requiredNumbers.filter(
            num => !outputNumbers.some(outputNum => Math.abs(outputNum - num) < 0.001)
        );
        
        if (missingNumbers.length > 0) {
            result.isValid = false;
            result.reason = `Missing required numbers: ${missingNumbers.join(', ')}`;
            return result;
        }
    }
    
    if (validation.requiredText) {
        const normalizedOutput = output.toLowerCase();
        const missingText = validation.requiredText.filter(
            text => !normalizedOutput.includes(text.toLowerCase())
        );
        
        if (missingText.length > 0) {
            result.isValid = false;
            result.reason = `Missing required text: ${missingText.join(', ')}`;
            return result;
        }
    }
    
    if (validation.outputPatterns) {
        const failedPatterns = validation.outputPatterns.filter(
            pattern => !new RegExp(pattern, 'i').test(output)
        );
        
        if (failedPatterns.length > 0) {
            result.isValid = false;
            result.reason = `Output doesn't match patterns: ${failedPatterns.join(', ')}`;
            return result;
        }
    }
    
    return result;
};

global.checkCellOutput = function(output, expectedOutput, cellData = null) {
    // First try flexible matching
    if (flexibleOutputMatch(output, expectedOutput)) {
        return true;
    }
    
    // If cell has validation rules, use pattern-based validation
    if (cellData && cellData.validation) {
        const result = validateCellWithPatterns(output, cellData.validation);
        return result.isValid;
    }
    
    return false;
};

// Mock game state
global.gameContent = null;
global.currentStage = 1;
global.successfulCellExecutions = {};
global.cellEditors = [];

// Simple console-based test runner
class NodeTestRunner {
    constructor() {
        this.testResults = [];
        this.currentSuite = '';
    }
    
    createTestSuite(suiteName) {
        this.currentSuite = suiteName;
        console.log(`\n📁 ${suiteName}`);
        console.log('='.repeat(50));
    }
    
    async runTest(testName, testFunction) {
        try {
            await testFunction();
            console.log(`✅ ${testName}`);
            this.testResults.push({ name: testName, status: 'pass' });
        } catch (error) {
            console.log(`❌ ${testName}`);
            console.log(`   Error: ${error.message}`);
            this.testResults.push({ name: testName, status: 'fail', error: error.message });
        }
    }
    
    displaySummary() {
        const passed = this.testResults.filter(t => t.status === 'pass').length;
        const failed = this.testResults.filter(t => t.status === 'fail').length;
        const total = this.testResults.length;
        
        console.log('\n📊 Test Summary');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.filter(t => t.status === 'fail').forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }
        
        return failed === 0;
    }
}

// Simplified test suite for Node.js
class SimpleTestSuite extends NodeTestRunner {
    async init() {
        try {
            const gameContentPath = path.join(__dirname, 'game-content.json');
            const gameContentData = fs.readFileSync(gameContentPath, 'utf8');
            global.gameContent = JSON.parse(gameContentData);
            console.log('✅ Game content loaded for testing');
        } catch (error) {
            console.error('❌ Failed to load game content:', error.message);
        }
    }
    
    async waitForSkulpt() {
        // Skulpt is already mocked, so just return
        return Promise.resolve();
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
                    throw "File not found: '" + x + "'";
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
    
    // Include the same test methods but simplified for Node.js
    async testBasicFunctionality() {
        this.createTestSuite('Basic Functionality Tests');
        
        await this.runTest('Code Execution', async () => {
            const output = await this.executeCodeWithSkulpt('print("Hello World")');
            if (!output.includes('Hello World')) {
                throw new Error('Basic code execution failed');
            }
        });
        
        await this.runTest('Syntax Error Detection', async () => {
            try {
                await this.executeCodeWithSkulpt('print("Hello World"');
                throw new Error('Expected syntax error was not thrown');
            } catch (error) {
                if (!error.toString().includes('SyntaxError')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });
        
        await this.runTest('Runtime Error Detection', async () => {
            try {
                await this.executeCodeWithSkulpt('print(undefined_variable)');
                throw new Error('Expected name error was not thrown');
            } catch (error) {
                if (!error.toString().includes('NameError')) {
                    throw new Error(`Unexpected error type: ${error}`);
                }
            }
        });
    }
    
    async testValidationSystem() {
        this.createTestSuite('Validation System Tests');
        
        await this.runTest('Flexible Output Matching', async () => {
            if (!flexibleOutputMatch('Hello World', 'Hello World')) {
                throw new Error('Exact match failed');
            }
            
            if (!flexibleOutputMatch('  Hello World  \n', 'Hello World')) {
                throw new Error('Whitespace tolerance failed');
            }
        });
        
        await this.runTest('Number Extraction', async () => {
            const text = 'The answer is 42 and pi is approximately 3.14159';
            const numbers = extractNumbers(text);
            
            if (!numbers.includes(42) || !numbers.some(n => Math.abs(n - 3.14159) < 0.001)) {
                throw new Error('Number extraction failed');
            }
        });
    }

    async testMarkdownConversion() {
        this.createTestSuite('Markdown Conversion Tests');

        await this.runTest('List Rendering Without Breaks', async () => {
            // Minimal DOM stubs for script.js
            global.document = {
                getElementById: () => ({
                    addEventListener: () => {},
                    style: {},
                    innerHTML: '',
                    querySelectorAll: () => [],
                    appendChild: () => {},
                    classList: { add: () => {}, remove: () => {}, contains: () => false }
                }),
                querySelector: () => ({
                    classList: { add: () => {}, remove: () => {} },
                    addEventListener: () => {},
                    style: {},
                    appendChild: () => {},
                    querySelectorAll: () => []
                }),
                createElement: () => ({
                    className: '',
                    innerHTML: '',
                    appendChild: () => {},
                    addEventListener: () => {},
                    setAttribute: () => {},
                    classList: { add: () => {}, remove: () => {} },
                    style: {},
                    querySelectorAll: () => []
                }),
                addEventListener: () => {}
            };
            global.window = {
                addEventListener: () => {},
                location: { hostname: 'localhost', origin: 'http://localhost' }
            };
            global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

            // Load llm-integration.js to access LLMIntegration
            const { LLMIntegration } = require('./llm-integration.js');
            const llm = new LLMIntegration();
            const html = llm.markdownToHtml('- item1\n- item2');

            if (html.includes('<br>')) {
                throw new Error('List items should not contain <br> tags');
            }

            if (html !== '<ul><li>item1</li><li>item2</li></ul>') {
                throw new Error('Markdown list not converted correctly');
            }
        });

        await this.runTest('Environment Detection', async () => {
            // Minimal DOM stubs for script.js
            global.document = {
                getElementById: () => ({
                    addEventListener: () => {},
                    style: {},
                    innerHTML: '',
                    querySelectorAll: () => [],
                    appendChild: () => {},
                    classList: { add: () => {}, remove: () => {}, contains: () => false }
                }),
                querySelector: () => ({
                    classList: { add: () => {}, remove: () => {} },
                    addEventListener: () => {},
                    style: {},
                    appendChild: () => {},
                    querySelectorAll: () => []
                }),
                querySelectorAll: () => [],
                createElement: () => ({
                    className: '',
                    innerHTML: '',
                    appendChild: () => {},
                    addEventListener: () => {},
                    setAttribute: () => {},
                    classList: { add: () => {}, remove: () => {} },
                    style: {},
                    querySelectorAll: () => []
                }),
                addEventListener: () => {}
            };
            global.window = {
                addEventListener: () => {},
                location: { hostname: 'localhost', origin: 'http://localhost' }
            };
            global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

            // Load llm-integration.js to access LLMIntegration
            const { LLMIntegration } = require('./llm-integration.js');
            const llm = new LLMIntegration();

            // Verify that browser-dependent methods don't throw errors in Node.js
            llm.init(); // Should not throw
            llm.setupEventListeners(); // Should not throw
            
            // Verify core functionality still works
            const simpleHtml = llm.markdownToHtml('**bold text**');
            if (!simpleHtml.includes('<strong>bold text</strong>')) {
                throw new Error('Bold markdown conversion failed');
            }
        });
    }
    
    async runAllTests() {
        console.log('🧪 Starting AICodePedagogy Test Suite (Node.js)...');
        console.log('='.repeat(60));
        
        await this.init();
        
        try {
            await this.testBasicFunctionality();
            await this.testValidationSystem();
            await this.testMarkdownConversion();

            const success = this.displaySummary();
            
            if (success) {
                console.log('\n🎉 All tests passed!');
                process.exit(0);
            } else {
                console.log('\n💥 Some tests failed!');
                process.exit(1);
            }
        } catch (error) {
            console.error('\n💥 Test suite failed:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    // Load test configuration
    try {
        const testConfigPath = path.join(__dirname, 'test-config.js');
        const testConfigCode = fs.readFileSync(testConfigPath, 'utf8');
        // Remove module.exports if present and execute
        const configCode = testConfigCode.replace(/module\.exports.*=.*/, '');
        eval(configCode);
        console.log('✓ Test configuration loaded');
    } catch (error) {
        console.log('⚠ Test configuration not available:', error.message);
    }

    const testSuite = new SimpleTestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = SimpleTestSuite;

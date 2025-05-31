# AICodePedagogy Test Suite

This test suite provides comprehensive testing for the AICodePedagogy educational programming game, focusing on runtime error handling, cell execution orders, and core functionality while excluding Ollama/LLM features.

## Test Coverage

### 🚨 Runtime Error Handling
- **Syntax Error Detection**: Tests for unclosed strings, missing colons, etc.
- **Indentation Error Detection**: Tests for Python indentation requirements
- **Name Error Detection**: Tests for undefined variable usage
- **Type Error Detection**: Tests for incompatible type operations
- **Zero Division Error Detection**: Tests for division by zero scenarios
- **Index Error Detection**: Tests for list index out of range errors

### 🔄 Cell Execution Order Tests
- **Sequential Cell Execution**: Tests proper variable persistence across cells
- **Out-of-Order Cell Execution**: Tests behavior when cells are executed in wrong order
- **Cell Re-execution After Error**: Tests recovery after a cell fails
- **Variable Persistence Across Cells**: Tests that variables remain available across multiple cell executions

### ⚙️ Core Functionality Tests
- **Flexible Output Matching**: Tests the output validation system's flexibility
- **Number Extraction**: Tests extraction of numeric values from text output
- **Pattern-Based Validation**: Tests validation using patterns and rules
- **Cell Status Tracking**: Tests tracking of successfully executed cells
- **Code Accumulation Logic**: Tests how code from multiple cells is combined

### 🛠️ Error Recovery Tests
- **Recovery After Syntax Error**: Tests that the system can recover after syntax errors
- **Recovery After Runtime Error**: Tests that the system can recover after runtime errors
- **Isolated Cell Error Handling**: Tests that errors in one cell don't break others

### ✅ Validation System Tests
- **Single Cell Validation**: Tests validation for single-cell stages
- **Multi-Cell Validation**: Tests validation for multi-cell stages
- **Validation with Wrong Output**: Tests that incorrect output is properly rejected

## Running the Tests

### Browser-based Testing (Recommended)

1. Open `test-runner.html` in your web browser
2. Click "Run All Tests" button
3. View results in the browser interface

```bash
# Serve the files locally (if needed)
npm run test:serve
# Then open http://localhost:8000/test-runner.html
```

### Node.js Testing (Simplified)

```bash
# Install dependencies
npm install

# Run tests in Node.js
npm test
```

### Manual Testing

You can also open the test runner directly:
```bash
npm run test:browser
```

## Test Structure

### Test Files

- `test-runner.html` - Browser-based test runner with full UI
- `tests.js` - Complete test suite with all test cases
- `test-runner-node.js` - Simplified Node.js test runner
- `package.json` - Node.js dependencies and scripts

### Test Categories

Each test category is run as a separate test suite:

1. **Runtime Error Handling** - Tests various Python runtime errors
2. **Cell Execution Order Tests** - Tests multi-cell execution scenarios
3. **Core Functionality Tests** - Tests core application functions
4. **Error Recovery Tests** - Tests error recovery mechanisms
5. **Validation System Tests** - Tests output validation logic

## Key Features Tested

### ✅ What IS Tested
- Python code execution using Skulpt.js
- Error detection and handling for various Python errors
- Cell execution order and variable persistence
- Output validation and pattern matching
- Code accumulation across multiple cells
- Error recovery mechanisms
- Input validation for different data types

### ❌ What IS NOT Tested (Excluded as Requested)
- Ollama LLM integration
- AI-generated hints or responses
- Model selection and management
- LLM query functionality
- Network requests to Ollama API

## Test Results

Tests provide detailed feedback including:
- ✅ **Pass/Fail Status** for each test
- 📊 **Summary Statistics** (total, passed, failed, success rate)
- 🔍 **Error Details** for failed tests
- 📈 **Progress Indicators** during test execution

## Writing New Tests

To add new tests, extend the `AICodePedagogyTestSuite` class in `tests.js`:

```javascript
async testNewFeature() {
    this.createTestSuite('New Feature Tests');
    
    await this.runTest('Test Name', async () => {
        // Test implementation
        const result = await someFunction();
        if (!result.isValid) {
            throw new Error('Test failed');
        }
    });
}
```

Then add the new test method to the `runAllTests()` method.

## Dependencies

### Browser Testing
- Skulpt.js (Python interpreter)
- CodeMirror (code editor)
- Native browser APIs

### Node.js Testing
- Node.js 14+
- jsdom (for DOM simulation)
- Built-in mocks for Skulpt functionality

## Troubleshooting

### Common Issues

1. **Skulpt Loading Issues**: Ensure Skulpt.js is properly loaded before running tests
2. **CORS Issues**: Use a local server when testing in browsers
3. **Missing Dependencies**: Run `npm install` for Node.js testing

### Debug Mode

Set `console.log` level to debug for more verbose output:
```javascript
// In tests.js
console.log('Debug info:', testData);
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Include both positive and negative test cases
3. Test error conditions thoroughly
4. Avoid testing excluded features (Ollama/LLM)
5. Update this README with new test categories

## License

This test suite is part of the AICodePedagogy project and follows the same MIT license.

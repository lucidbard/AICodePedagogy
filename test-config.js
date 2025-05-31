/**
 * Test Configuration for AICodePedagogy
 * Defines test scenarios, edge cases, and validation rules
 */

const TEST_CONFIG = {
  // Runtime error test cases
  RUNTIME_ERRORS: {
    syntaxErrors: [
      {
        name: 'Unclosed String',
        code: 'print("Hello World"',
        expectedError: /SyntaxError|EOF/
      },
      {
        name: 'Missing Colon in If Statement',
        code: 'if True\n    print("test")',
        expectedError: /SyntaxError|invalid syntax/
      },
      {
        name: 'Unclosed Parenthesis',
        code: 'result = max(1, 2, 3',
        expectedError: /SyntaxError|EOF/
      },
      {
        name: 'Invalid Function Definition',
        code: 'def function_name\n    pass',
        expectedError: /SyntaxError|invalid syntax/
      }
    ],

    runtimeErrors: [
      {
        name: 'Undefined Variable Access',
        code: 'print(nonexistent_variable)',
        expectedError: /NameError|not defined/
      },
      {
        name: 'Division by Zero',
        code: 'result = 42 / 0',
        expectedError: /ZeroDivisionError|division by zero/
      },
      {
        name: 'List Index Out of Range',
        code: 'items = [1, 2, 3]\nprint(items[10])',
        expectedError: /IndexError|list index out of range/
      },
      {
        name: 'String + Integer Type Error',
        code: 'result = "hello" + 5',
        expectedError: /TypeError|can only concatenate|unsupported operand/
      },
      {
        name: 'Function Call on Non-Function',
        code: 'number = 42\nresult = number()',
        expectedError: /TypeError|not callable/
      },
      {
        name: 'Key Error in Dictionary',
        code: 'data = {"a": 1, "b": 2}\nprint(data["nonexistent"])',
        expectedError: /KeyError|"nonexistent"/
      }
    ],

    indentationErrors: [
      {
        name: 'Missing Indentation After If',
        code: 'if True:\nprint("not indented")',
        expectedError: /IndentationError|expected an indented block/
      },
      {
        name: 'Missing Indentation After Function',
        code: 'def my_function():\nreturn 42',
        expectedError: /IndentationError|expected an indented block/
      },
      {
        name: 'Inconsistent Indentation',
        code: 'if True:\n    print("4 spaces")\n  print("2 spaces")',
        expectedError: /IndentationError|unindent/
      }
    ]
  },

  // Cell execution order scenarios
  CELL_EXECUTION_SCENARIOS: [
    {
      name: 'Basic Variable Persistence',
      cells: [
        { code: 'x = 10', expectedOutput: '', variables: ['x'] },
        {
          code: 'y = x + 5\nprint(y)',
          expectedOutput: '15',
          usesVariables: ['x']
        },
        {
          code: 'z = x * y\nprint(f"Result: {z}")',
          expectedOutput: 'Result: 150',
          usesVariables: ['x', 'y']
        }
      ]
    },
    {
      name: 'List Processing Across Cells',
      cells: [
        {
          code: 'numbers = [1, 2, 3, 4, 5]',
          expectedOutput: '',
          variables: ['numbers']
        },
        {
          code: 'total = sum(numbers)\nprint(f"Sum: {total}")',
          expectedOutput: 'Sum: 15',
          usesVariables: ['numbers']
        },
        {
          code: 'average = total / len(numbers)\nprint(f"Average: {average}")',
          expectedOutput: 'Average: 3.0',
          usesVariables: ['total', 'numbers']
        }
      ]
    },
    {
      name: 'Function Definition and Usage',
      cells: [
        {
          code: 'def greet(name):\n    return f"Hello, {name}!"',
          expectedOutput: '',
          variables: ['greet']
        },
        {
          code: 'message = greet("World")\nprint(message)',
          expectedOutput: 'Hello, World!',
          usesVariables: ['greet']
        },
        {
          code: 'users = ["Alice", "Bob"]\nfor user in users:\n    print(greet(user))',
          expectedOutput: 'Hello, Alice!\nHello, Bob!',
          usesVariables: ['greet']
        }
      ]
    },
    {
      name: 'Error Recovery Scenario',
      cells: [
        {
          code: 'valid_var = "I work"',
          expectedOutput: '',
          variables: ['valid_var']
        },
        {
          code: 'print(undefined_variable)',
          expectedOutput: 'ERROR',
          shouldFail: true
        },
        {
          code: 'print(valid_var)',
          expectedOutput: 'I work',
          usesVariables: ['valid_var']
        }
      ]
    }
  ],

  // Validation test cases
  VALIDATION_SCENARIOS: [
    {
      name: 'Exact String Match',
      output: 'Hello, World!',
      expected: 'Hello, World!',
      shouldPass: true
    },
    {
      name: 'Whitespace Tolerance',
      output: '   Hello, World!   \n',
      expected: 'Hello, World!',
      shouldPass: true
    },
    {
      name: 'Case Sensitivity',
      output: 'hello, world!',
      expected: 'Hello, World!',
      shouldPass: true
    },
    {
      name: 'Numeric Tolerance',
      output: 'Pi is 3.14159',
      expected: 'Pi is 3.14',
      shouldPass: true
    },
    {
      name: 'Multiple Lines',
      output: 'Line 1\nLine 2\nLine 3',
      expected: 'Line 1\nLine 2\nLine 3',
      shouldPass: true
    },
    {
      name: 'Pattern Validation',
      output: 'The result is 42 items',
      validation: {
        requiredNumbers: [42],
        requiredText: ['result', 'items'],
        outputPatterns: ['result.*\\d+.*items']
      },
      shouldPass: true
    },
    {
      name: 'Failed Pattern Validation',
      output: 'The result is 41 items',
      validation: {
        requiredNumbers: [42],
        requiredText: ['result', 'items'],
        outputPatterns: ['result.*42.*items']
      },
      shouldPass: false
    }
  ],

  // Edge cases for testing
  EDGE_CASES: [
    {
      name: 'Empty Code Execution',
      code: '',
      expectedOutput: '',
      shouldPass: true
    },
    {
      name: 'Only Comments',
      code: '# This is just a comment\n# Another comment',
      expectedOutput: '',
      shouldPass: true
    },
    {
      name: 'Very Long Output',
      code: 'for i in range(100):\n    print(f"Number {i}")',
      expectedBehavior: 'should handle long output gracefully'
    },
    {
      name: 'Unicode Characters',
      code: 'print("Hello 世界! 🌍")',
      expectedOutput: 'Hello 世界! 🌍',
      shouldPass: true
    },
    {
      name: 'Special Characters in Strings',
      code: 'print("Line\\nBreak\\tTab\\"Quote")',
      expectedOutput: 'Line\nBreak\tTab"Quote',
      shouldPass: true
    }
  ],

  // Performance and stress tests
  STRESS_TESTS: [
    {
      name: 'Large Loop',
      code: 'count = 0\nfor i in range(1000):\n    count += 1\nprint(f"Final count: {count}")',
      expectedOutput: 'Final count: 1000',
      maxExecutionTime: 5000 // 5 seconds
    },
    {
      name: 'Deep Recursion',
      code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)\nresult = factorial(10)\nprint(f"10! = {result}")',
      expectedOutput: '10! = 3628800',
      maxExecutionTime: 2000 // 2 seconds
    },
    {
      name: 'Multiple Cell Rapid Execution',
      description: 'Execute multiple cells in quick succession',
      cells: Array.from({ length: 10 }, (_, i) => ({
        code: `step_${i} = ${i}\nprint(f"Step {step_${i}}")`,
        expectedOutput: `Step ${i}`
      }))
    }
  ]
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TEST_CONFIG
} else if (typeof window !== 'undefined') {
  window.TEST_CONFIG = TEST_CONFIG
}

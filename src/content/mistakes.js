// Mistake detection content per curriculum — what a wrong answer is evidence of. Used by learn/diagnose.js;
// every tag here has a matching question in content/recovery.js (checked by tests/content.test.js).
//  `vault:challenge` → tag: the concept the challenge tests (any wrong answer there is evidence of it)
//                      answers: finer tags for known wrong answers (mcq option index / blank text)
// ERRORS: real runtime messages (JS Worker / Pyodide) → tag, first match wins.
export const MISTAKES = {
  'py-1': {
    '0:0': { tag: 'print-values', answers: { 1: 'quotes-in-output', 2: 'variable-vs-string', 3: 'variable-defined' } },
    '0:1': { tag: 'assignment', answers: { '==': 'assign-vs-compare', ':': 'assign-operator' } },
    '0:2': { tag: 'case-sensitive' },
    '1:0': { tag: 'float-type', answers: { 2: 'str-type', 3: 'type-function' } },
    '1:1': { tag: 'string-concat' },
    '1:2': { tag: 'type-conversion' },
    '2:0': { tag: 'if-else-branch' },
    '2:1': { tag: 'missing-colon' },
    '2:2': { tag: 'logical-and', answers: { or: 'and-vs-or', '&&': 'python-and-keyword' } },
    '3:0': { tag: 'return-value' },
    '3:1': { tag: 'return-vs-print' },
    '3:2': { tag: 'return-vs-print' },
    '4:0': { tag: 'range-start' },
    '4:1': { tag: 'list-append' },
    '4:2': { tag: 'index-range' }
  },
  'js-1': {
    '0:0': { tag: 'reassign-let', answers: { 2: 'number-plus', 3: 'let-reassign' } },
    '0:1': { tag: 'const-keyword', answers: { let: 'const-vs-let', var: 'var-old' } },
    '0:2': { tag: 'const-reassign' },
    '1:0': { tag: 'string-number-concat' },
    '1:1': { tag: 'typeof-array' },
    '1:2': { tag: 'strict-equality', answers: { '==': 'loose-equality' } },
    '2:0': { tag: 'if-else-branch' },
    '2:1': { tag: 'condition-parens' },
    '2:2': { tag: 'logical-and', answers: { and: 'js-and-operator', '||': 'and-vs-or' } },
    '3:0': { tag: 'arrow-return' },
    '3:1': { tag: 'return-vs-log' },
    '3:2': { tag: 'return-vs-log' },
    '4:0': { tag: 'array-length' },
    '4:1': { tag: 'array-map', answers: { forEach: 'map-vs-foreach', filter: 'map-vs-filter' } },
    '4:2': { tag: 'off-by-one' }
  }
};

export const ERRORS = {
  py: [
    [/IndentationError/, 'indentation'],
    [/SyntaxError: expected ':'/, 'missing-colon'],
    [/SyntaxError/, 'syntax-error'],
    [/NameError: name '[^']+' is not defined/, 'name-error'],
    [/'NoneType'/, 'none-value'],
    [/can only concatenate str|unsupported operand type\(s\) for \+: '(int|str)' and '(str|int)'/, 'str-int-concat'],
    [/IndexError/, 'index-range'],
    [/TimeoutError|ran longer than/, 'infinite-loop']
  ],
  js: [
    [/^SyntaxError/m, 'syntax-error'],
    [/Assignment to constant variable/, 'const-reassign'],
    [/ReferenceError: \S+ is not defined/, 'undefined-variable'],
    [/Cannot read properties of undefined/, 'undefined-value'],
    [/ran longer than|infinite loop/i, 'infinite-loop']
  ]
};

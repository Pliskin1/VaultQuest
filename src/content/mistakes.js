// Runtime errors as evidence of a mistake, per language (real messages from the JS Worker and Pyodide).
// First match wins. Challenge-specific tags live with the challenges themselves (content/*-world1.js and the
// Pro vault in content/languages.js); every tag here has a Recovery question (checked by tests/content.test.js).
export const ERRORS = {
  py: [
    [/IndentationError/, 'indentation'],
    [/SyntaxError: expected ':'/, 'missing-colon'],
    [/SyntaxError/, 'syntax-error'],
    [/KeyError/, 'key-error'],
    [/NameError: name '[^']+' is not defined/, 'name-error'],
    [/AttributeError: .* has no attribute/, 'not-a-method'],
    [/'NoneType'/, 'none-value'],
    [/can only concatenate str|unsupported operand type\(s\) for \+: '(int|str)' and '(str|int)'/, 'str-int-concat'],
    [/IndexError/, 'index-range'],
    [/TimeoutError|^Timeout|ran longer than/m, 'loop-timeout']
  ],
  js: [
    [/^SyntaxError/m, 'syntax-error'],
    [/is not defined as a function/, 'missing-function'],
    [/is not a function/, 'not-a-method'],
    [/Assignment to constant variable/, 'const-reassign'],
    [/ReferenceError: \S+ is not defined/, 'undefined-variable'],
    [/Cannot read properties of undefined/, 'undefined-value'],
    [/Cannot (read|set) properties of null/, 'null-element'],
    [/^Timeout|ran longer than|infinite loop/im, 'loop-timeout']
  ]
};

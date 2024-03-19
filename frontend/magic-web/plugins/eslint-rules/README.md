# ESLint Custom Rules

This directory contains custom ESLint rules specific to this project, providing additional code quality checks beyond standard ESLint rules.

## Overview

Custom rules are implemented as CommonJS modules and loaded via `eslint-plugin-local-rules`. These rules help enforce project-specific patterns and prevent common mistakes in React/TypeScript development.

## Directory Structure

```
plugins/
├── eslint-rules.cjs                      # Rules index (exports all rules)
└── eslint-rules/
    ├── README.md                         # This documentation
    ├── package.json                      # Package metadata
    ├── index.js                          # Re-export for npm compatibility
    └── rules/
        ├── no-component-recursion.cjs    # Prevent React component self-recursion
        └── (future rules...)
```

## Available Rules

### `local-rules/no-component-recursion`

**Purpose:** Prevents React components from calling themselves directly, which causes infinite loops and stack overflow errors.

**Configuration:**
- **Severity:** `error`
- **Type:** `problem`
- **Fixable:** No (requires manual refactoring)

**Documentation:** `../../docs/eslint-no-component-recursion.md`

**Example:**

```typescript
// ❌ Bad - causes infinite loop
const MyComponent = observer((props) => {
  if (isPrivateDeployment()) return null
  return <MyComponent {...props} />  // Error: self-recursion
})

// ✅ Good - delegate to separate implementation
const MyComponent = observer((props) => {
  if (isPrivateDeployment()) return null
  return <MyComponentImpl {...props} />
})

const MyComponentImpl = (props) => {
  return <div>{props.children}</div>
}
```

**Detected Patterns:**
- Arrow function components: `const C = () => <C />`
- Function expression components: `const C = function() { return <C /> }`
- Function declaration components: `function C() { return <C /> }`
- HOC-wrapped components: `const C = observer(() => <C />)`

## Usage

### In ESLint Configuration

Rules are enabled in `.eslintrc.cjs`:

```javascript
module.exports = {
  plugins: ["local-rules"],
  rules: {
    "local-rules/no-component-recursion": "error",
  },
}
```

### Running Linter

```bash
# Check all files
pnpm lint

# Auto-fix issues (where possible)
pnpm lint:fix

# Check specific files
pnpm lint src/components/**/*.tsx
```

## Adding New Rules

Follow these steps to add a new custom rule:

### 1. Create Rule File

Create a new `.cjs` file in `plugins/eslint-rules/rules/`:

```javascript
// plugins/eslint-rules/rules/my-rule.cjs
module.exports = {
  meta: {
    type: 'problem', // 'problem', 'suggestion', or 'layout'
    docs: {
      description: 'Brief description of what the rule does',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/yourorg/yourrepo/blob/main/docs/eslint-my-rule.md',
    },
    messages: {
      myMessage: 'Error message with {{placeholder}}',
    },
    fixable: null, // 'code' or 'whitespace' if auto-fixable
    schema: [], // JSON schema for rule options
  },

  create(context) {
    return {
      // AST node visitors
      'FunctionDeclaration'(node) {
        // Rule implementation
        if (/* condition */) {
          context.report({
            node,
            messageId: 'myMessage',
            data: { placeholder: 'value' },
          })
        }
      },
    }
  },
}
```

### 2. Export Rule

Add the rule to `plugins/eslint-rules.cjs`:

```javascript
module.exports = {
  'no-component-recursion': require('./eslint-rules/rules/no-component-recursion.cjs'),
  'my-rule': require('./eslint-rules/rules/my-rule.cjs'), // Add this line
}
```

### 3. Enable Rule

Add the rule to `.eslintrc.cjs`:

```javascript
module.exports = {
  rules: {
    'local-rules/my-rule': 'error', // or 'warn'
  },
}
```

### 4. Document Rule

Create documentation in `docs/eslint-my-rule.md`:

```markdown
# ESLint Rule: my-rule

## Overview
Brief description of the rule and why it exists.

## Problem
Describe the problem this rule prevents.

## Examples
Show bad and good code examples.

## Configuration
Explain how to configure the rule.
```

### 5. Test Rule

Create test cases to verify rule behavior:

```javascript
// Test your rule manually or with ESLint's RuleTester
const { RuleTester } = require('eslint')
const rule = require('./my-rule.cjs')

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
})

ruleTester.run('my-rule', rule, {
  valid: [
    // Valid code examples
    'const x = 1',
  ],
  invalid: [
    {
      code: 'const x = 2',
      errors: [{ messageId: 'myMessage' }],
    },
  ],
})
```

## Rule Development Tips

### Understanding AST

Use [AST Explorer](https://astexplorer.net/) to understand the Abstract Syntax Tree structure:

1. Select parser: `@typescript-eslint/parser`
2. Paste your code
3. Explore the tree structure
4. Identify node types and properties

### Common Node Types

- `FunctionDeclaration` - function declarations
- `FunctionExpression` - function expressions
- `ArrowFunctionExpression` - arrow functions
- `VariableDeclarator` - variable declarations
- `JSXElement` - JSX elements
- `CallExpression` - function calls

### Context API

The `context` object provides:

- `context.report()` - Report a problem
- `context.getSourceCode()` - Get source code object
- `context.getFilename()` - Get current filename
- `context.getScope()` - Get current scope

### Best Practices

1. **Clear error messages** - Include actionable guidance
2. **Precise locations** - Report on the exact problematic node
3. **Performance** - Avoid expensive operations in visitors
4. **Documentation** - Provide examples and rationale
5. **Testing** - Test edge cases and false positives

## Troubleshooting

### Rule Not Working

1. Check rule is exported in `plugins/eslint-rules.cjs`
2. Verify rule is enabled in `.eslintrc.cjs`
3. Ensure `eslint-plugin-local-rules` is installed
4. Restart ESLint server in your IDE

### Parser Errors

If you see parser errors:

1. Ensure `@typescript-eslint/parser` is configured
2. Check `parserOptions.project` points to correct tsconfig
3. Verify file is included in tsconfig

### False Positives

If rule triggers incorrectly:

1. Review AST structure with AST Explorer
2. Add more specific conditions to rule logic
3. Consider adding rule options for configuration

## Resources

### Official Documentation

- [ESLint Custom Rules](https://eslint.org/docs/latest/extend/custom-rules)
- [ESLint Rule API](https://eslint.org/docs/latest/extend/custom-rules#the-context-object)
- [TypeScript ESLint](https://typescript-eslint.io/developers/custom-rules)

### Tools

- [AST Explorer](https://astexplorer.net/) - Visualize AST structure
- [ESLint Playground](https://eslint.org/play/) - Test rules online
- [eslint-plugin-local-rules](https://github.com/cletusw/eslint-plugin-local-rules) - Load local rules

### Examples

- [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) - React-specific rules
- [typescript-eslint rules](https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/eslint-plugin/src/rules) - TypeScript rules

## Contributing

When contributing new rules:

1. Discuss the rule necessity with the team
2. Follow the structure and conventions above
3. Provide comprehensive documentation
4. Include test cases
5. Update this README with the new rule

## License

These custom rules are part of the Magic Web project and follow the same license.

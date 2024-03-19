/**
 * ESLint rule to prevent React component infinite recursion
 * Detects when a component directly calls itself in its return statement
 * 
 * Example of problematic code:
 * const MyComponent = () => {
 *   return <MyComponent />  // ❌ Infinite loop!
 * }
 * 
 * Correct code:
 * const MyComponent = () => {
 *   return <MyComponentImpl />  // ✅ Calls different component
 * }
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent React components from calling themselves directly, which causes infinite loops',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      selfReference: 'Component "{{name}}" is calling itself directly. This will cause an infinite loop. Did you mean to call a different component?',
    },
    schema: [],
  },

  create(context) {
    // Track component names and their JSX usage
    const componentStack = []

    function isReactComponent(node) {
      if (node.id && node.id.name) return /^[A-Z]/.test(node.id.name)
      return false
    }

    function isFunctionLike(node) {
      if (!node) return false
      return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
    }

    function hasFunctionArgument(node) {
      if (!node || node.type !== 'CallExpression') return false

      return node.arguments.some((argument) => {
        if (!argument) return false
        if (isFunctionLike(argument)) return true
        if (argument.type === 'CallExpression') return hasFunctionArgument(argument)
        return false
      })
    }

    function getComponentName(node) {
      // For VariableDeclarator: const MyComponent = () => {}
      if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
        return node.id.name
      }
      // For FunctionDeclaration: function MyComponent() {}
      if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name
      }
      return null
    }

    function getTrackedComponentName(node) {
      const componentName = getComponentName(node)
      if (!componentName || !/^[A-Z]/.test(componentName)) return null
      if (!node.init) return null
      if (isFunctionLike(node.init)) return componentName
      if (node.init.type === 'CallExpression' && hasFunctionArgument(node.init)) return componentName
      return null
    }

    return {
      'VariableDeclarator'(node) {
        const componentName = getTrackedComponentName(node)
        if (componentName) componentStack.push(componentName)
      },

      // Track function declarations
      'FunctionDeclaration'(node) {
        if (isReactComponent(node)) {
          componentStack.push(node.id.name)
        }
      },

      // Check JSX elements for self-reference
      'JSXElement'(node) {
        const openingElement = node.openingElement

        if (openingElement.name && openingElement.name.type === 'JSXIdentifier') {
          const elementName = openingElement.name.name
          const currentComponent = componentStack[componentStack.length - 1]

          // Check if component is calling itself
          if (currentComponent && elementName === currentComponent) {
            context.report({
              node: openingElement,
              messageId: 'selfReference',
              data: {
                name: elementName,
              },
            })
          }
        }
      },

      'VariableDeclarator:exit'(node) {
        const componentName = getTrackedComponentName(node)
        if (componentName && componentStack[componentStack.length - 1] === componentName)
          componentStack.pop()
      },

      // Clean up stack when exiting function declaration
      'FunctionDeclaration:exit'(node) {
        if (isReactComponent(node) && componentStack[componentStack.length - 1] === node.id.name) {
          componentStack.pop()
        }
      },
    }
  },
}

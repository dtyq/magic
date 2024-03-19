/**
 * Local ESLint rules index
 * This file exports all custom ESLint rules for the project
 */

module.exports = {
  rules: {
    'no-component-recursion': require('./rules/no-component-recursion.cjs'),
  },
}

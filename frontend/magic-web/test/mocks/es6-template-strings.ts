// Mock for @dtyq/es6-template-strings to avoid ES module compatibility issues in tests
export function resolveToString(template: string, variables?: Record<string, any>): string {
	if (!variables) return template

	// Simple template replacement for testing
	return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
		return variables[key] || match
	})
}

export default {
	resolveToString,
}

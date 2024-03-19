/**
 * @fileoverview Throttled Browser History Implementation
 * @description A custom browser history wrapper that implements throttling for navigation operations
 * to prevent excessive navigation calls and improve performance. This module wraps the standard
 * browser history API with a throttling mechanism that delays navigation execution by 50ms,
 * ensuring only the last operation in a series of rapid calls is executed.
 *
 * @author biubiukam
 * @version 1.0.0
 * @created 2025-08-22
 *
 * @example
 * ```typescript
 * import { baseHistory } from './baseHistory'
 *
 * // These rapid calls will be throttled, only the last one executes
 * baseHistory.push('/page1')
 * baseHistory.push('/page2')
 * baseHistory.push('/page3') // Only this will execute after 50ms
 * ```
 */
import { createBrowserHistory, type To } from "history"

// Configuration constants
const THROTTLE_DELAY = 50 // ms

// Navigation action type definitions
interface NavigationAction {
	type: "push" | "replace" | "go"
	to?: To
	state?: any
	delta?: number
}

// Create browser history instance
const baseHistory = createBrowserHistory({ window })

// Store original methods to prevent infinite recursion
const originalMethods = {
	push: baseHistory.push.bind(baseHistory),
	replace: baseHistory.replace.bind(baseHistory),
	go: baseHistory.go.bind(baseHistory),
} as const

// Throttle state management
class ThrottleManager {
	private lastAction: NavigationAction | null = null
	private timeoutId: NodeJS.Timeout | null = null

	// Execute the actual navigation operation
	private executeNavigation = (action: NavigationAction): void => {
		switch (action.type) {
			case "push":
				if (action.to !== undefined) {
					originalMethods.push(action.to, action.state)
				}
				break
			case "replace":
				if (action.to !== undefined) {
					originalMethods.replace(action.to, action.state)
				}
				break
			case "go":
				if (action.delta !== undefined) {
					originalMethods.go(action.delta)
				}
				break
		}
	}

	// Handle throttled navigation with proper cleanup
	public throttleNavigation = (action: NavigationAction): void => {
		// Record the last operation
		this.lastAction = action
		console.log("throttleNavigation", action)

		// Clear previous timer to implement throttling
		if (this.timeoutId) {
			clearTimeout(this.timeoutId)
		}

		// Set new timer to execute the last operation after delay
		this.timeoutId = setTimeout(() => {
			if (this.lastAction) {
				this.executeNavigation(this.lastAction)
				this.cleanup()
			}
		}, THROTTLE_DELAY)
	}

	// Clean up state after execution
	private cleanup = (): void => {
		this.lastAction = null
		this.timeoutId = null
	}

	// Force execute pending navigation (useful for cleanup)
	public flush = (): void => {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId)
			if (this.lastAction) {
				this.executeNavigation(this.lastAction)
				this.cleanup()
			}
		}
	}
}

// Create throttle manager instance
const throttleManager = new ThrottleManager()

// // Override baseHistory methods with throttling
// baseHistory.push = (to: To, state?: any): void => {
// 	throttleManager.throttleNavigation({ type: "push", to, state })
// }
//
// baseHistory.replace = (to: To, state?: any): void => {
// 	throttleManager.throttleNavigation({ type: "replace", to, state })
// }
//
// baseHistory.go = (delta: number): void => {
// 	throttleManager.throttleNavigation({ type: "go", delta })
// }

// Add cleanup function for proper resource management
const cleanup = (): void => {
	throttleManager.flush()
}

// Export the enhanced history instance and utilities
export { baseHistory, cleanup }

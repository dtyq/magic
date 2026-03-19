/**
 * Array polyfills for older browsers
 * Includes: at, findLast, findLastIndex
 */

// Array.prototype.at polyfill
if (!Array.prototype.at) {
	Array.prototype.at = function (index: number) {
		// Convert negative index to positive
		const len = this.length
		const relativeIndex = index < 0 ? len + index : index

		// Return undefined if index is out of bounds
		if (relativeIndex < 0 || relativeIndex >= len) {
			return undefined
		}

		return this[relativeIndex]
	}
}

// Array.prototype.findLast polyfill
if (!Array.prototype.findLast) {
	Array.prototype.findLast = function <T>(
		predicate: (value: T, index: number, array: T[]) => boolean,
		thisArg?: any,
	): T | undefined {
		const len = this.length

		// Return undefined if array is empty
		if (len === 0) {
			return undefined
		}

		// Iterate from the end to the beginning
		for (let i = len - 1; i >= 0; i--) {
			const element = this[i]
			// Call predicate with proper thisArg binding
			if (predicate.call(thisArg, element, i, this)) {
				return element
			}
		}

		return undefined
	}
}

// Array.prototype.findLastIndex polyfill
if (!Array.prototype.findLastIndex) {
	Array.prototype.findLastIndex = function <T>(
		predicate: (value: T, index: number, array: T[]) => boolean,
		thisArg?: any,
	): number {
		const len = this.length

		// Return -1 if array is empty
		if (len === 0) {
			return -1
		}

		// Iterate from the end to the beginning
		for (let i = len - 1; i >= 0; i--) {
			const element = this[i]
			// Call predicate with proper thisArg binding
			if (predicate.call(thisArg, element, i, this)) {
				return i
			}
		}

		return -1
	}
}

export {}

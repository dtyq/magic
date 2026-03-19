/**
 * String polyfills for older browsers
 * Includes: at, replaceAll
 */

// String.prototype.at polyfill (also add this for strings)
if (!String.prototype.at) {
	String.prototype.at = function (index: number) {
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

// String.prototype.replaceAll polyfill
if (!String.prototype.replaceAll) {
	String.prototype.replaceAll = function (
		searchValue: string | RegExp,
		replaceValue: string | ((substring: string, ...args: any[]) => string),
	) {
		// Handle RegExp case
		if (searchValue instanceof RegExp) {
			// If RegExp doesn't have global flag, throw TypeError (same as native behavior)
			if (!searchValue.global) {
				throw new TypeError(
					"String.prototype.replaceAll called with a non-global RegExp argument",
				)
			}
			return this.replace(searchValue, replaceValue as string)
		}

		// Handle string case
		const str = String(this)
		const search = String(searchValue)

		// If search string is empty, insert replacement between each character
		if (search === "") {
			if (typeof replaceValue === "function") {
				let result = ""
				for (let i = 0; i <= str.length; i++) {
					result += replaceValue("", i, str)
					if (i < str.length) {
						result += str[i]
					}
				}
				return result
			} else {
				return replaceValue + str.split("").join(replaceValue) + replaceValue
			}
		}

		// Normal string replacement
		let result = str
		let searchIndex = 0

		while ((searchIndex = result.indexOf(search, searchIndex)) !== -1) {
			if (typeof replaceValue === "function") {
				const replacement = replaceValue(search, searchIndex, str)
				result =
					result.slice(0, searchIndex) +
					replacement +
					result.slice(searchIndex + search.length)
				searchIndex += replacement.length
			} else {
				result =
					result.slice(0, searchIndex) +
					replaceValue +
					result.slice(searchIndex + search.length)
				searchIndex += replaceValue.length
			}
		}

		return result
	}
}

export {}

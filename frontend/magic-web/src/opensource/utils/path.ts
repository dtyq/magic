/**
 * Path utilities for calculating relative paths between files
 * Uses pathe library for reliable cross-platform path handling
 */

import { relative, dirname, resolve } from "pathe"

/**
 * Calculate relative path from one file to another
 *
 * This function uses the mature `pathe` library to handle path calculations,
 * which properly handles:
 * - ".." and "." segments
 * - Multiple slashes
 * - Cross-platform compatibility
 * - Edge cases
 *
 * @param fromPath - Source file path (e.g., "./docs/guide.md" or "/docs/guide.md")
 * @param toPath - Target file path (e.g., "./images/photo.png" or "/images/photo.png")
 * @returns Relative path from source to target (e.g., "../images/photo.png")
 *
 * @example
 * ```typescript
 * calculateRelativePath("./docs/guide.md", "./images/photo.png")
 * // Returns: "../images/photo.png"
 *
 * calculateRelativePath("./docs/api/ref.md", "./images/logo.png")
 * // Returns: "../../images/logo.png"
 *
 * calculateRelativePath("./guide.md", "./docs/api/ref.md")
 * // Returns: "./docs/api/ref.md"
 *
 * calculateRelativePath("./docs/a.md", "./docs/b.md")
 * // Returns: "./b.md"
 *
 * calculateRelativePath("./docs/guide.md", "./../images/photo.png")
 * // Returns: "../images/photo.png" (properly normalized, no "./../")
 * ```
 */
export function calculateRelativePath(fromPath: string, toPath: string): string {
	// Validate inputs
	if (!fromPath || !toPath) {
		throw new Error("Both fromPath and toPath are required")
	}

	console.log("fromPath", fromPath)
	console.log("toPath", toPath)

	// Use a deep virtual root to prevent path escape issues
	// This ensures that even paths with multiple "../" won't escape the virtual workspace
	const VIRTUAL_ROOT = "/virtual/workspace/project/root"

	// Normalize input paths: treat all paths as relative to project root
	// Convert absolute-like paths (starting with "/") to relative paths
	const normalizeInput = (path: string): string => {
		// Remove leading slash if present (treat as project-relative path)
		if (path.startsWith("/")) {
			return `.${path}`
		}
		// Add "./" prefix if not already present
		if (!path.startsWith("./") && !path.startsWith("../")) {
			return `./${path}`
		}
		return path
	}

	const normalizedFromInput = normalizeInput(fromPath)
	const normalizedToInput = normalizeInput(toPath)

	// Normalize and resolve paths relative to the virtual root
	// This properly handles "..", ".", and multiple slashes
	const normalizedFrom = resolve(VIRTUAL_ROOT, normalizedFromInput)
	const normalizedTo = resolve(VIRTUAL_ROOT, normalizedToInput)

	// Get directory of source file
	const fromDir = dirname(normalizedFrom)

	// Calculate relative path from source directory to target file
	const relativePath = relative(fromDir, normalizedTo)

	// Ensure the path starts with "./" if it doesn't start with ".."
	if (!relativePath.startsWith("..")) {
		console.log("relativePath", "111", relativePath)
		return `./${relativePath}`
	}

	console.log("relativePath", relativePath)

	return relativePath
}

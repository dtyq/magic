import { FileData } from "../types"

export const generateNextFileName = (fileName: string, existingNames: string[]) => {
	// Parse basename and extension
	const lastDotIndex = fileName.lastIndexOf(".")
	const fullName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
	const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : ""

	// Check if the filename already has a number pattern like "filename (1)" or "filename (2)"
	const numberPattern = /^(.+) \((\d+)\)$/
	const match = fullName.match(numberPattern)

	let baseName: string
	let startCounter: number

	if (match) {
		// File already has a number, extract the base name and start from next number
		baseName = match[1]
		startCounter = parseInt(match[2]) + 1
	} else {
		// File doesn't have a number, use original name as base
		baseName = fullName
		startCounter = 1
	}

	// Find all existing files with the same base name pattern
	const basePattern = new RegExp(
		`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: \\((\\d+)\\))?${extension.replace(
			/[.*+?^${}()|[\]\\]/g,
			"\\$&",
		)}$`,
	)
	const existingNumbers = existingNames
		.map((name) => {
			const baseMatch = name.match(basePattern)
			if (!baseMatch) return 0
			return baseMatch[1] ? parseInt(baseMatch[1]) : 0 // 0 for base name without number
		})
		.filter((num) => num !== null)

	// Find the highest existing number and start from next
	const maxNumber = Math.max(0, ...existingNumbers)
	let counter = Math.max(startCounter, maxNumber + 1)
	let newFileName = `${baseName} (${counter})${extension}`

	// Ensure the generated name is unique
	while (existingNames.includes(newFileName)) {
		counter++
		newFileName = `${baseName} (${counter})${extension}`
	}

	return newFileName
}

/**
 * Generate unique filename by appending number in parentheses
 * @param fileName - Original filename
 * @param existingFiles - Array of existing files
 * @param additionalNames - Additional existing names to check against
 * @param targetSuffixDir - Target directory for upload (to check conflicts only within same directory)
 * @returns Unique filename
 */

export function generateUniqueFileName(
	fileName: string,
	existingFiles: FileData[],
	additionalNames: string[] = [],
	targetSuffixDir?: string,
): string {
	// Get existing file names from current files with same suffix directory and additional names
	const existingFilesInSameDir = existingFiles.filter((f) => f.suffixDir === targetSuffixDir)
	const existingNames = [...existingFilesInSameDir.map((f) => f.name), ...additionalNames]

	// If filename doesn't exist, return it directly
	if (!existingNames.includes(fileName)) {
		return fileName
	}

	return generateNextFileName(fileName, existingNames)
}

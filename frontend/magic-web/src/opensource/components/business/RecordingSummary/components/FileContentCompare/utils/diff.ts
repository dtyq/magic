import { diffLines, diffChars, Change } from "diff"
import { ConflictResolution } from "../types"

/**
 * Diff operation types
 */
export enum DiffOp {
	EQUAL = 0,
	DELETE = -1,
	INSERT = 1,
}

/**
 * Inline diff fragment (for character-level diff within a line)
 */
export interface InlineDiffFragment {
	operation: DiffOp
	text: string
}

/**
 * Diff result
 */
export interface DiffResult {
	operation: DiffOp
	text: string
	inlineDiff?: InlineDiffFragment[]
}

/**
 * Convert jsdiff Change to our DiffOp
 */
function changeToDiffOp(change: Change): DiffOp {
	if (change.added) return DiffOp.INSERT
	if (change.removed) return DiffOp.DELETE
	return DiffOp.EQUAL
}

/**
 * Character-level diff using jsdiff
 * Returns array of inline diff fragments
 */
function computeCharDiff(text1: string, text2: string): InlineDiffFragment[] {
	const changes = diffChars(text1, text2)
	return changes.map((change) => ({
		operation: changeToDiffOp(change),
		text: change.value,
	}))
}

/**
 * Line-level diff using jsdiff
 * Returns array of diff operations with inline diff for modified lines
 */
export function computeDiff(text1: string, text2: string): DiffResult[] {
	// Use jsdiff's diffLines for precise line-based comparison
	const changes = diffLines(text1, text2)

	// Convert to our format
	const result: DiffResult[] = []

	for (const change of changes) {
		const operation = changeToDiffOp(change)
		// Split by newlines and process each line
		const lines = change.value.split("\n")
		// Remove trailing empty line if exists (diffLines adds \n at the end)
		if (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop()
		}

		for (const line of lines) {
			result.push({
				operation,
				text: line,
			})
		}
	}

	// Post-process: detect adjacent DELETE+INSERT pairs that might be the same line modified
	// and compute inline diff for them
	const processed: DiffResult[] = []
	for (let idx = 0; idx < result.length; idx++) {
		const current = result[idx]

		// Check if this DELETE is followed by an INSERT, and they might be the same line
		if (
			current.operation === DiffOp.DELETE &&
			idx + 1 < result.length &&
			result[idx + 1].operation === DiffOp.INSERT
		) {
			const deleteLine = current.text
			const insertLine = result[idx + 1].text

			// Compute character-level diff for these lines
			const inlineDiff = computeCharDiff(deleteLine, insertLine)

			// If inline diff is meaningful (has EQUAL parts or multiple fragments),
			// mark it as modified with inline diff
			const hasEqualParts = inlineDiff.some((f) => f.operation === DiffOp.EQUAL)
			if (hasEqualParts || inlineDiff.length > 2) {
				processed.push({
					operation: DiffOp.DELETE,
					text: deleteLine,
					inlineDiff,
				})
				processed.push({
					operation: DiffOp.INSERT,
					text: insertLine,
					inlineDiff,
				})
				idx++ // Skip the next INSERT as we've already processed it
				continue
			}
		}

		processed.push(current)
	}

	return processed
}

/**
 * Smart merge algorithm
 * Intelligently merges two versions of text
 */
export function smartMerge(
	currentContent: string,
	serverContent: string,
	i18n?: {
		currentVersion?: string
		serverVersion?: string
	},
): string {
	const currentVersionLabel = i18n?.currentVersion || "当前版本"
	const serverVersionLabel = i18n?.serverVersion || "最新版本"

	const diff = computeDiff(currentContent, serverContent)
	const merged: string[] = []
	let conflictSections: string[] = []

	for (const part of diff) {
		if (part.operation === DiffOp.EQUAL) {
			// Add any pending conflicts first
			if (conflictSections.length > 0) {
				merged.push(`<<<<<<< ${currentVersionLabel}`)
				merged.push(...conflictSections.filter((p) => p.startsWith("DELETE:")))
				merged.push(`=======`)
				merged.push(...conflictSections.filter((p) => p.startsWith("INSERT:")))
				merged.push(`>>>>>>> ${serverVersionLabel}`)
				conflictSections = []
			}
			merged.push(part.text)
		} else if (part.operation === DiffOp.DELETE) {
			// Track deletions that might conflict
			conflictSections.push(`DELETE:${part.text}`)
		} else if (part.operation === DiffOp.INSERT) {
			// Check if there's a corresponding deletion
			const deleteIndex = conflictSections.findIndex((c) => c.startsWith("DELETE:"))
			if (deleteIndex >= 0) {
				// Conflict detected - both modified
				conflictSections.push(`INSERT:${part.text}`)
			} else {
				// Just an insertion - auto-accept
				if (conflictSections.length > 0) {
					merged.push(`<<<<<<< ${currentVersionLabel}`)
					merged.push(...conflictSections.filter((p) => p.startsWith("DELETE:")))
					merged.push(`=======`)
					merged.push(...conflictSections.filter((p) => p.startsWith("INSERT:")))
					merged.push(`>>>>>>> ${serverVersionLabel}`)
					conflictSections = []
				}
				merged.push(part.text)
			}
		}
	}

	// Handle remaining conflicts
	if (conflictSections.length > 0) {
		merged.push(`<<<<<<< ${currentVersionLabel}`)
		merged.push(...conflictSections.filter((p) => p.startsWith("DELETE:")))
		merged.push(`=======`)
		merged.push(...conflictSections.filter((p) => p.startsWith("INSERT:")))
		merged.push(`>>>>>>> ${serverVersionLabel}`)
	}

	return merged.join("\n")
}

/**
 * Advanced smart merge - tries to merge without conflict markers when possible
 * Prefers server content when there are conflicts
 */
export function advancedSmartMerge(
	currentContent: string,
	serverContent: string,
	i18n?: {
		currentVersion?: string
		serverVersion?: string
	},
): string {
	const currentVersionLabel = i18n?.currentVersion || "当前版本"
	const serverVersionLabel = i18n?.serverVersion || "最新版本"

	// If contents are identical, return directly
	if (currentContent === serverContent) {
		return currentContent
	}

	const diff = computeDiff(currentContent, serverContent)
	const merged: string[] = []
	const pendingDeletes: Array<{ text: string; inlineDiff?: InlineDiffFragment[] }> = []
	const pendingInserts: Array<{ text: string; inlineDiff?: InlineDiffFragment[] }> = []
	let changeCounter = 0

	// Helper function to flush pending changes as a conflict or change marker
	const flushPendingConflict = () => {
		if (pendingDeletes.length > 0 && pendingInserts.length > 0) {
			// Create conflict markers for any DELETE+INSERT pairs
			merged.push(`<<<<<<< ${currentVersionLabel}`)
			merged.push(...pendingDeletes.map((d) => d.text))
			merged.push(`=======`)
			merged.push(...pendingInserts.map((i) => i.text))
			merged.push(`>>>>>>> ${serverVersionLabel}`)
		} else if (pendingDeletes.length > 0) {
			// Only deletions - create deletion marker
			const id = `deletion-${changeCounter++}`
			merged.push(`####### DELETION ${id}`)
			merged.push(...pendingDeletes.map((d) => d.text))
			merged.push(`####### END ${id}`)
		} else if (pendingInserts.length > 0) {
			// Only insertions - create addition marker
			const id = `addition-${changeCounter++}`
			merged.push(`####### ADDITION ${id}`)
			merged.push(...pendingInserts.map((i) => i.text))
			merged.push(`####### END ${id}`)
		}
		pendingDeletes.length = 0
		pendingInserts.length = 0
	}

	for (const part of diff) {
		if (part.operation === DiffOp.EQUAL) {
			// Flush any pending conflict before adding the equal line
			// This ensures equal lines separate conflicts into independent blocks
			flushPendingConflict()

			// Add the equal line (no conflict marker needed)
			merged.push(part.text)
		} else if (part.operation === DiffOp.DELETE) {
			pendingDeletes.push({
				text: part.text,
				inlineDiff: part.inlineDiff,
			})
		} else if (part.operation === DiffOp.INSERT) {
			pendingInserts.push({
				text: part.text,
				inlineDiff: part.inlineDiff,
			})
		}
	}

	// Handle remaining changes at the end
	flushPendingConflict()

	return merged.join("\n")
}

/**
 * Conflict resolution recommendation
 */
export type ConflictRecommendation = ConflictResolution | undefined

/**
 * Change type - for non-conflict changes
 */
export type ChangeType = "addition" | "deletion"

/**
 * Change recommendation type
 */
export type ChangeRecommendation = "keep" | "remove"

/**
 * Recommendation source type
 */
export type RecommendationSource = "rule" | "ai"

/**
 * Change information for additions and deletions
 */
export interface ChangeInfo {
	id: string
	type: ChangeType
	lines: string[]
	startIndex: number
	endIndex: number
	lineNumbers: number[]
	recommendation?: ChangeRecommendation
	recommendationReason?: string
	recommendationSource?: RecommendationSource
}

/**
 * Conflict information extracted from merged content
 */
export interface ConflictInfo {
	id: string
	currentLines: string[]
	serverLines: string[]
	startIndex: number
	endIndex: number
	incomplete: boolean
	recommendation?: ConflictRecommendation
	recommendationReason?: string
	recommendationSource?: RecommendationSource
	currentLineNumbers?: number[]
	serverLineNumbers?: number[]
}

interface SequenceMatchParams {
	sourceLines: string[]
	targetLines: string[]
	startSearchIndex: number
}

interface SequenceMatchResult {
	lineNumbers: number[]
	nextSearchIndex: number
}

function findSequentialLineNumbers({
	sourceLines,
	targetLines,
	startSearchIndex,
}: SequenceMatchParams): SequenceMatchResult {
	if (targetLines.length === 0) {
		return {
			lineNumbers: [],
			nextSearchIndex: startSearchIndex,
		}
	}

	const maxStart = sourceLines.length - targetLines.length
	if (maxStart < 0) {
		return {
			lineNumbers: new Array(targetLines.length).fill(0),
			nextSearchIndex: startSearchIndex,
		}
	}

	const normalizedStart = Math.min(Math.max(startSearchIndex, 0), Math.max(0, maxStart))

	const tryMatch = (from: number, to: number) => {
		for (let start = from; start <= to; start++) {
			let matched = true
			for (let offset = 0; offset < targetLines.length; offset++) {
				if (sourceLines[start + offset] !== targetLines[offset]) {
					matched = false
					break
				}
			}
			if (matched) {
				return start
			}
		}
		return -1
	}

	let matchedStart = tryMatch(normalizedStart, maxStart)
	if (matchedStart < 0 && normalizedStart > 0) {
		matchedStart = tryMatch(0, normalizedStart - 1)
	}

	if (matchedStart < 0) {
		return {
			lineNumbers: new Array(targetLines.length).fill(0),
			nextSearchIndex: startSearchIndex,
		}
	}

	const lineNumbers = targetLines.map((_, idx) => matchedStart + idx + 1)
	return {
		lineNumbers,
		nextSearchIndex: matchedStart + targetLines.length,
	}
}

/**
 * Parse conflicts from merged content
 * Extracts all conflict regions with their current and server lines
 */
export function parseConflicts(mergedContent: string): ConflictInfo[] {
	const lines = mergedContent.split("\n")
	const conflicts: ConflictInfo[] = []
	let conflictStart = -1
	let conflictCurrentLines: string[] = []
	let conflictServerLines: string[] = []
	let conflictPhase: "none" | "current" | "server" = "none"

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]

		if (line.startsWith("<<<<<<<")) {
			conflictStart = index
			conflictPhase = "current"
			conflictCurrentLines = []
			conflictServerLines = []
		} else if (line.startsWith("=======")) {
			if (conflictPhase === "current") {
				conflictPhase = "server"
			}
		} else if (line.startsWith(">>>>>>>")) {
			if (conflictPhase === "server") {
				// Complete conflict
				conflicts.push({
					id: `conflict-${conflictStart}`,
					currentLines: [...conflictCurrentLines],
					serverLines: [...conflictServerLines],
					startIndex: conflictStart,
					endIndex: index,
					incomplete: false,
				})
			}
			conflictPhase = "none"
			conflictCurrentLines = []
			conflictServerLines = []
		} else if (conflictPhase === "current") {
			conflictCurrentLines.push(line)
		} else if (conflictPhase === "server") {
			conflictServerLines.push(line)
		}
	}

	// Handle incomplete conflicts
	if (conflictPhase !== "none" && conflictStart >= 0) {
		conflicts.push({
			id: `conflict-${conflictStart}`,
			currentLines: [...conflictCurrentLines],
			serverLines: conflictPhase === "server" ? [...conflictServerLines] : [],
			startIndex: conflictStart,
			endIndex: lines.length - 1,
			incomplete: true,
		})
	}

	return conflicts
}

/**
 * Analyze conflict and provide smart recommendation
 */
export function getConflictRecommendation(
	conflict: ConflictInfo,
	i18n?: {
		moreContent?: string
		onlyAdditions?: string
		onlyDeletions?: string
		smallChanges?: string
		serverExtends?: string
		currentExtends?: string
	},
): { recommendation: ConflictRecommendation; reason: string } {
	const currentContent = conflict.currentLines.join("\n")
	const serverContent = conflict.serverLines.join("\n")

	// Default i18n texts
	const moreContentText = i18n?.moreContent || "内容更完整"
	const onlyAdditionsText = i18n?.onlyAdditions || "仅包含新增内容"
	const onlyDeletionsText = i18n?.onlyDeletions || "仅删除了部分内容"
	const smallChangesText = i18n?.smallChanges || "改动较小"
	const serverExtendsText = i18n?.serverExtends || "最新内容包含当前内容并有扩展"
	const currentExtendsText = i18n?.currentExtends || "当前内容包含最新内容并有扩展"

	// Case 1: One side is empty
	if (currentContent.trim() === "" && serverContent.trim() !== "") {
		return {
			recommendation: ConflictResolution.SERVER,
			reason: onlyAdditionsText,
		}
	}
	if (serverContent.trim() === "" && currentContent.trim() !== "") {
		return {
			recommendation: ConflictResolution.CURRENT,
			reason: onlyDeletionsText,
		}
	}

	// Case 2: Check if one version contains the other (extension detection)
	const currentTrimmed = currentContent.trim()
	const serverTrimmed = serverContent.trim()

	if (currentTrimmed && serverTrimmed) {
		// Check if server content contains and extends current content
		if (
			serverTrimmed.includes(currentTrimmed) &&
			serverTrimmed.length > currentTrimmed.length
		) {
			// Server extends current - recommend server
			return {
				recommendation: ConflictResolution.SERVER,
				reason: serverExtendsText,
			}
		}

		// Check if current content contains and extends server content
		if (
			currentTrimmed.includes(serverTrimmed) &&
			currentTrimmed.length > serverTrimmed.length
		) {
			// Current extends server - recommend current
			return {
				recommendation: ConflictResolution.CURRENT,
				reason: currentExtendsText,
			}
		}
	}

	// Case 3: Content length comparison (very significant difference only)
	const currentLength = currentContent.length
	const serverLength = serverContent.length
	const lengthDiff = Math.abs(currentLength - serverLength)
	const minLength = Math.min(currentLength, serverLength)

	// Only recommend if one version is at least 2x longer than the other
	if (minLength > 0 && lengthDiff > minLength * 2) {
		if (serverLength > currentLength) {
			return {
				recommendation: ConflictResolution.SERVER,
				reason: moreContentText,
			}
		} else {
			return {
				recommendation: ConflictResolution.CURRENT,
				reason: moreContentText,
			}
		}
	}

	// Case 4: Line count comparison (very significant difference only)
	const currentLineCount = conflict.currentLines.length
	const serverLineCount = conflict.serverLines.length

	// Only recommend if one version has at least 2x more lines
	if (serverLineCount >= currentLineCount * 2) {
		return {
			recommendation: ConflictResolution.SERVER,
			reason: moreContentText,
		}
	}
	if (currentLineCount >= serverLineCount * 2) {
		return {
			recommendation: ConflictResolution.CURRENT,
			reason: moreContentText,
		}
	}

	// Case 5: Check for only whitespace/formatting changes
	const currentTrimmedWS = currentContent.replace(/\s+/g, "")
	const serverTrimmedWS = serverContent.replace(/\s+/g, "")

	if (currentTrimmedWS === serverTrimmedWS) {
		// Only whitespace differences, prefer server (latest)
		return {
			recommendation: ConflictResolution.SERVER,
			reason: smallChangesText,
		}
	}

	// Case 6: No clear winner - don't recommend
	return {
		recommendation: undefined,
		reason: "",
	}
}

/**
 * Analyze change and provide smart recommendation
 */
export function getChangeRecommendation(
	change: { type: ChangeType; lines: string[] },
	i18n?: {
		newContent?: string
		deletedContent?: string
	},
): { recommendation: ChangeRecommendation | undefined; reason: string } {
	// Default i18n texts
	const newContentText = i18n?.newContent || "服务器新增内容"
	const deletedContentText = i18n?.deletedContent || "服务器已删除内容"

	if (change.type === "addition") {
		// For additions, recommend keeping (server has new content)
		return {
			recommendation: "keep",
			reason: newContentText,
		}
	} else if (change.type === "deletion") {
		// For deletions, recommend removing (server deleted the content)
		return {
			recommendation: "remove",
			reason: deletedContentText,
		}
	}

	return {
		recommendation: undefined,
		reason: "",
	}
}

/**
 * Resolve merge conflicts based on user selections
 * Replaces conflict markers with selected content
 */
export function resolveConflictsWithSelections(
	mergedContent: string,
	selections: Map<string, "current" | "server" | "custom">,
	customContents: Map<string, string>,
): string {
	const lines = mergedContent.split("\n")
	const result: string[] = []
	let conflictStart = -1
	let conflictCurrentLines: string[] = []
	let conflictServerLines: string[] = []
	let conflictPhase: "none" | "current" | "server" = "none"
	let conflictId: string | null = null

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]

		if (line.startsWith("<<<<<<<")) {
			conflictStart = index
			conflictId = `conflict-${conflictStart}`
			conflictPhase = "current"
			conflictCurrentLines = []
			conflictServerLines = []
		} else if (line.startsWith("=======")) {
			if (conflictPhase === "current") {
				conflictPhase = "server"
			}
		} else if (line.startsWith(">>>>>>>")) {
			if (conflictPhase === "server" && conflictId) {
				// Process complete conflict
				const selection = selections.get(conflictId)
				if (selection === "current") {
					result.push(...conflictCurrentLines)
				} else if (selection === "server") {
					result.push(...conflictServerLines)
				} else if (selection === "custom") {
					const customContent = customContents.get(conflictId)
					if (customContent !== undefined) {
						result.push(...customContent.split("\n"))
					} else {
						// Fallback to server if custom content not provided
						result.push(...conflictServerLines)
					}
				} else {
					// No selection, keep conflict markers (shouldn't happen in normal flow)
					result.push(`<<<<<<<`)
					result.push(...conflictCurrentLines)
					result.push(`=======`)
					result.push(...conflictServerLines)
					result.push(`>>>>>>>`)
				}
			}
			conflictPhase = "none"
			conflictId = null
			conflictCurrentLines = []
			conflictServerLines = []
		} else if (conflictPhase === "current") {
			conflictCurrentLines.push(line)
		} else if (conflictPhase === "server") {
			conflictServerLines.push(line)
		} else {
			// Normal line - not in conflict
			result.push(line)
		}
	}

	// Handle incomplete conflicts
	if (conflictPhase !== "none" && conflictId) {
		const selection = selections.get(conflictId)
		if (selection === "current") {
			result.push(...conflictCurrentLines)
		} else if (selection === "server") {
			result.push(...conflictServerLines)
		} else if (selection === "custom") {
			const customContent = customContents.get(conflictId)
			if (customContent !== undefined) {
				result.push(...customContent.split("\n"))
			} else {
				result.push(...conflictServerLines)
			}
		} else {
			// No selection, keep incomplete conflict markers
			result.push(`<<<<<<<`)
			result.push(...conflictCurrentLines)
			if (conflictPhase === "server") {
				result.push(`=======`)
				result.push(...conflictServerLines)
			}
		}
	}

	return result.join("\n")
}

/**
 * Interactive merge - keeps all changes (additions, deletions, modifications) as interactive items
 * Uses special markers for additions and deletions
 */
export function interactiveMerge(
	currentContent: string,
	serverContent: string,
	i18n?: {
		currentVersion?: string
		serverVersion?: string
	},
): string {
	const currentVersionLabel = i18n?.currentVersion || "当前版本"
	const serverVersionLabel = i18n?.serverVersion || "最新版本"

	if (currentContent === serverContent) {
		return currentContent
	}

	const diff = computeDiff(currentContent, serverContent)
	const merged: string[] = []
	const pendingDeletes: Array<{ text: string }> = []
	const pendingInserts: Array<{ text: string }> = []

	let changeIdCounter = 0

	const flushPendingChanges = () => {
		if (pendingDeletes.length > 0 && pendingInserts.length > 0) {
			// Both delete and insert - this is a modification (conflict)
			merged.push(`<<<<<<< ${currentVersionLabel}`)
			merged.push(...pendingDeletes.map((d) => d.text))
			merged.push(`=======`)
			merged.push(...pendingInserts.map((i) => i.text))
			merged.push(`>>>>>>> ${serverVersionLabel}`)
		} else if (pendingDeletes.length > 0) {
			// Only deletions - mark as deletable
			const deleteId = `delete-${changeIdCounter++}`
			merged.push(`####### DELETION ${deleteId}`)
			merged.push(...pendingDeletes.map((d) => d.text))
			merged.push(`####### END ${deleteId}`)
		} else if (pendingInserts.length > 0) {
			// Only insertions - mark as addition
			const addId = `add-${changeIdCounter++}`
			merged.push(`####### ADDITION ${addId}`)
			merged.push(...pendingInserts.map((i) => i.text))
			merged.push(`####### END ${addId}`)
		}
		pendingDeletes.length = 0
		pendingInserts.length = 0
	}

	for (const part of diff) {
		if (part.operation === DiffOp.EQUAL) {
			flushPendingChanges()
			merged.push(part.text)
		} else if (part.operation === DiffOp.DELETE) {
			pendingDeletes.push({ text: part.text })
		} else if (part.operation === DiffOp.INSERT) {
			pendingInserts.push({ text: part.text })
		}
	}

	flushPendingChanges()
	return merged.join("\n")
}

/**
 * Parse changes (additions and deletions) from merged content
 */
export function parseChanges(
	mergedContent: string,
	currentContent: string,
	serverContent: string,
	i18n?: {
		newContent?: string
		deletedContent?: string
	},
): ChangeInfo[] {
	const lines = mergedContent.split("\n")
	const changes: ChangeInfo[] = []
	const currentLines = currentContent.split("\n")
	const serverLines = serverContent.split("\n")
	let additionSearchStartIdx = 0
	let deletionSearchStartIdx = 0

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]

		// Check for addition marker
		if (line.startsWith("####### ADDITION ")) {
			const id = line.replace("####### ADDITION ", "").trim()
			const changeLines: string[] = []
			let endIndex = index

			// Collect lines until end marker
			for (let i = index + 1; i < lines.length; i++) {
				if (lines[i].startsWith("####### END ")) {
					endIndex = i
					break
				}
				changeLines.push(lines[i])
			}

			// Find line numbers in server content
			const { lineNumbers, nextSearchIndex } = findSequentialLineNumbers({
				sourceLines: serverLines,
				targetLines: changeLines,
				startSearchIndex: additionSearchStartIdx,
			})
			if (lineNumbers.some((value) => value > 0)) {
				additionSearchStartIdx = nextSearchIndex
			}

			// Get recommendation for this addition
			const { recommendation, reason } = getChangeRecommendation(
				{
					type: "addition",
					lines: changeLines,
				},
				i18n,
			)

			changes.push({
				id,
				type: "addition",
				lines: changeLines,
				startIndex: index,
				endIndex,
				lineNumbers,
				recommendation,
				recommendationReason: reason,
			})
		}

		// Check for deletion marker
		if (line.startsWith("####### DELETION ")) {
			const id = line.replace("####### DELETION ", "").trim()
			const changeLines: string[] = []
			let endIndex = index

			// Collect lines until end marker
			for (let i = index + 1; i < lines.length; i++) {
				if (lines[i].startsWith("####### END ")) {
					endIndex = i
					break
				}
				changeLines.push(lines[i])
			}

			// Find line numbers in current content
			const { lineNumbers, nextSearchIndex } = findSequentialLineNumbers({
				sourceLines: currentLines,
				targetLines: changeLines,
				startSearchIndex: deletionSearchStartIdx,
			})
			if (lineNumbers.some((value) => value > 0)) {
				deletionSearchStartIdx = nextSearchIndex
			}

			// Get recommendation for this deletion
			const { recommendation, reason } = getChangeRecommendation(
				{
					type: "deletion",
					lines: changeLines,
				},
				i18n,
			)

			changes.push({
				id,
				type: "deletion",
				lines: changeLines,
				startIndex: index,
				endIndex,
				lineNumbers,
				recommendation,
				recommendationReason: reason,
			})
		}
	}

	return changes
}

/**
 * Analyze merged content to determine line types
 * Returns a map of line index to line type (added/unchanged)
 */
export function analyzeMergedLineTypes(
	mergedContent: string,
	currentContent: string,
	serverContent: string,
): Map<number, "added" | "unchanged"> {
	const mergedLines = mergedContent.split("\n")
	const currentLines = currentContent.split("\n")
	const serverLines = serverContent.split("\n")
	const lineTypes = new Map<number, "added" | "unchanged">()

	// Build a set of current content lines for quick lookup
	const currentLinesSet = new Set(currentLines)

	for (let i = 0; i < mergedLines.length; i++) {
		const line = mergedLines[i]

		// Skip conflict markers
		if (
			line.startsWith("<<<<<<<") ||
			line.startsWith("=======") ||
			line.startsWith(">>>>>>>")
		) {
			continue
		}

		// If line exists in current content, it's unchanged
		// If line only exists in server content, it's added
		if (currentLinesSet.has(line)) {
			lineTypes.set(i, "unchanged")
		} else {
			// Check if it's from server (new addition)
			if (serverLines.includes(line)) {
				lineTypes.set(i, "added")
			} else {
				// Default to unchanged for safety
				lineTypes.set(i, "unchanged")
			}
		}
	}

	return lineTypes
}

/**
 * Resolve changes (additions/deletions) based on user selections
 */
export function resolveChangesWithSelections(
	mergedContent: string,
	selections: Map<string, ChangeRecommendation>,
): string {
	const lines = mergedContent.split("\n")
	const result: string[] = []

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]

		// Check for addition marker
		if (line.startsWith("####### ADDITION ")) {
			const id = line.replace("####### ADDITION ", "").trim()
			const selection = selections.get(id)

			// Find the end marker
			let endIndex = index
			const changeLines: string[] = []
			for (let i = index + 1; i < lines.length; i++) {
				if (lines[i].startsWith("####### END ")) {
					endIndex = i
					break
				}
				changeLines.push(lines[i])
			}

			// Apply selection
			if (selection === "keep") {
				// Keep the addition
				result.push(...changeLines)
			} else if (selection === "remove") {
				// Remove the addition (don't add anything)
			} else {
				// No selection yet, keep by default for now
				result.push(...changeLines)
			}

			// Skip to end marker
			index = endIndex
			continue
		}

		// Check for deletion marker
		if (line.startsWith("####### DELETION ")) {
			const id = line.replace("####### DELETION ", "").trim()
			const selection = selections.get(id)

			// Find the end marker
			let endIndex = index
			const changeLines: string[] = []
			for (let i = index + 1; i < lines.length; i++) {
				if (lines[i].startsWith("####### END ")) {
					endIndex = i
					break
				}
				changeLines.push(lines[i])
			}

			// Apply selection
			if (selection === "keep") {
				// Keep the deleted lines (restore them)
				result.push(...changeLines)
			} else if (selection === "remove") {
				// Confirm deletion (don't add anything)
			} else {
				// No selection yet, remove by default (confirm deletion)
			}

			// Skip to end marker
			index = endIndex
			continue
		}

		// Normal line - keep it
		result.push(line)
	}

	return result.join("\n")
}

/**
 * Resolve merge conflicts by removing conflict markers
 * When conflicts exist, prefers server version (latest version)
 */
export function resolveMergeConflicts(mergedContent: string): string {
	const lines = mergedContent.split("\n")
	const result: string[] = []
	let conflictPhase: "none" | "current" | "server" = "none"
	let conflictCurrentLines: string[] = []
	let conflictServerLines: string[] = []

	for (const line of lines) {
		if (line.startsWith("<<<<<<<")) {
			conflictPhase = "current"
			conflictCurrentLines = []
			conflictServerLines = []
			continue
		} else if (line.startsWith("=======")) {
			conflictPhase = "server"
			continue
		} else if (line.startsWith(">>>>>>>")) {
			// End of conflict - prefer server version
			result.push(...conflictServerLines)
			conflictPhase = "none"
			conflictCurrentLines = []
			conflictServerLines = []
		} else if (conflictPhase === "current") {
			conflictCurrentLines.push(line)
		} else if (conflictPhase === "server") {
			conflictServerLines.push(line)
		} else {
			// Normal line
			result.push(line)
		}
	}

	// Handle incomplete conflicts
	if (conflictPhase === "server") {
		// If we're in server phase, prefer server version
		result.push(...conflictServerLines)
	} else if (conflictPhase === "current") {
		// If we're in current phase but no separator, use current version
		result.push(...conflictCurrentLines)
	}

	return result.join("\n")
}

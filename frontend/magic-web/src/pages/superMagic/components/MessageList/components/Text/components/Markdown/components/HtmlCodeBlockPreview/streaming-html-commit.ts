const SCRIPT_OPEN_TOKEN = "<script"
const SCRIPT_CLOSE_TOKEN = "</script"
const COMMENT_OPEN_TOKEN = "<!--"
const COMMENT_CLOSE_TOKEN = "-->"

function isTagNameBoundary(character: string | undefined) {
	return character === undefined || /[\s/>]/.test(character)
}

function findToken(
	normalizedSource: string,
	token: string,
	fromIndex: number,
	options: { ignoreHtmlComments?: boolean } = {},
) {
	const { ignoreHtmlComments = true } = options
	let tokenIndex = normalizedSource.indexOf(token, fromIndex)

	while (tokenIndex >= 0) {
		if (ignoreHtmlComments) {
			const commentStart = normalizedSource.lastIndexOf("<!--", tokenIndex)
			const commentEnd = normalizedSource.lastIndexOf("-->", tokenIndex)
			if (commentStart > commentEnd) {
				const nextCommentEnd = normalizedSource.indexOf("-->", tokenIndex)
				if (nextCommentEnd < 0) return -1
				tokenIndex = normalizedSource.indexOf(token, nextCommentEnd + 3)
				continue
			}
		}

		if (isTagNameBoundary(normalizedSource[tokenIndex + token.length])) return tokenIndex
		tokenIndex = normalizedSource.indexOf(token, tokenIndex + token.length)
	}

	return -1
}

function findTrailingPartialScriptStart(source: string, normalizedSource: string) {
	const lastTagStart = source.lastIndexOf("<")
	if (lastTagStart < 0) return null

	const normalizedCandidate = source.slice(lastTagStart).toLowerCase()
	if (
		normalizedCandidate.length >= SCRIPT_OPEN_TOKEN.length ||
		!SCRIPT_OPEN_TOKEN.startsWith(normalizedCandidate)
	) {
		return null
	}

	const commentStart = normalizedSource.lastIndexOf("<!--", lastTagStart)
	const commentEnd = normalizedSource.lastIndexOf("-->", lastTagStart)
	return commentStart > commentEnd ? null : lastTagStart
}

function findTagEnd(source: string, fromIndex: number) {
	let quote: '"' | "'" | null = null

	for (let index = fromIndex; index < source.length; index += 1) {
		const character = source[index]
		if (quote) {
			if (character === quote) quote = null
			continue
		}

		if (character === '"' || character === "'") {
			quote = character
			continue
		}

		if (character === ">") return index
	}

	return -1
}

/**
 * Returns the first script element that is incomplete in the current streaming prefix.
 * HTML parsers auto-close a partial script element, but that would execute an invalid
 * JavaScript prefix. Keeping the unsafe tail out of the iframe preserves the last valid UI.
 */
export function findIncompleteStreamingScriptStart(source: string): number | null {
	const normalizedSource = source.toLowerCase()
	let searchIndex = 0

	while (searchIndex < source.length) {
		const scriptStart = findToken(normalizedSource, SCRIPT_OPEN_TOKEN, searchIndex)
		if (scriptStart < 0) return findTrailingPartialScriptStart(source, normalizedSource)

		const openingTagEnd = findTagEnd(source, scriptStart + SCRIPT_OPEN_TOKEN.length)
		if (openingTagEnd < 0) return scriptStart

		const closingTagStart = findToken(normalizedSource, SCRIPT_CLOSE_TOKEN, openingTagEnd + 1, {
			ignoreHtmlComments: false,
		})
		if (closingTagStart < 0) return scriptStart

		const closingTagEnd = findTagEnd(source, closingTagStart + SCRIPT_CLOSE_TOKEN.length)
		if (closingTagEnd < 0) return scriptStart

		searchIndex = closingTagEnd + 1
	}

	return null
}

export function resolveStreamingHtmlCommitContent(source: string) {
	const incompleteScriptStart = findIncompleteStreamingScriptStart(source)
	return incompleteScriptStart === null ? source : source.slice(0, incompleteScriptStart)
}

export interface StreamingHtmlScanState {
	source: string
	normalizedSource: string
	scannedLength: number
	safeContentEnd: number
	mode: "html" | "comment" | "script-opening" | "script-content"
	scriptStart: number | null
	scanIndex: number
}

function createEmptyStreamingHtmlScanState(): StreamingHtmlScanState {
	return {
		source: "",
		normalizedSource: "",
		scannedLength: 0,
		safeContentEnd: 0,
		mode: "html",
		scriptStart: null,
		scanIndex: 0,
	}
}

function isPrefixOfToken(source: string, startIndex: number, token: string) {
	const suffix = source.slice(startIndex).toLowerCase()
	return suffix.length > 0 && suffix.length < token.length && token.startsWith(suffix)
}

function findNextTagEnd(source: string, fromIndex: number) {
	return findTagEnd(source, fromIndex)
}

/**
 * Scans only the appended suffix of an HTML stream. The state deliberately keeps an
 * incomplete script out of the committed prefix, while comments and ordinary markup
 * continue to advance without rescanning the whole document on every token.
 */
export function updateStreamingHtmlScanState(
	previousState: StreamingHtmlScanState | undefined,
	source: string,
): StreamingHtmlScanState {
	const canReuseState = previousState && source.startsWith(previousState.source)
	const previousSourceLength = canReuseState ? previousState.source.length : 0
	const state = canReuseState
		? {
				...previousState,
				source,
				normalizedSource:
					previousState.normalizedSource +
					source.slice(previousSourceLength).toLowerCase(),
			}
		: { ...createEmptyStreamingHtmlScanState(), source, normalizedSource: source.toLowerCase() }
	let index = canReuseState ? state.scanIndex : 0

	if (!canReuseState) {
		state.safeContentEnd = 0
		state.mode = "html"
		state.scriptStart = null
	}

	while (index < source.length) {
		if (state.mode === "comment") {
			const commentEnd = source.indexOf(COMMENT_CLOSE_TOKEN, index)
			if (commentEnd < 0) {
				state.scanIndex = Math.max(index, source.length - COMMENT_CLOSE_TOKEN.length + 1)
				state.scannedLength = source.length
				state.safeContentEnd = source.length
				return state
			}

			index = commentEnd + COMMENT_CLOSE_TOKEN.length
			state.mode = "html"
			state.scanIndex = index
			continue
		}

		if (state.mode === "script-opening") {
			const scriptStart = state.scriptStart
			if (scriptStart === null) {
				state.mode = "html"
				index += 1
				continue
			}
			const openingToken = source
				.slice(scriptStart, scriptStart + SCRIPT_OPEN_TOKEN.length)
				.toLowerCase()
			if (openingToken.length < SCRIPT_OPEN_TOKEN.length) {
				state.scanIndex = source.length
				state.scannedLength = source.length
				state.safeContentEnd = scriptStart
				return state
			}
			if (
				openingToken !== SCRIPT_OPEN_TOKEN ||
				!isTagNameBoundary(source[scriptStart + SCRIPT_OPEN_TOKEN.length])
			) {
				state.mode = "html"
				state.scriptStart = null
				index = scriptStart + 1
				state.scanIndex = index
				continue
			}

			const openingTagEnd = findNextTagEnd(source, scriptStart + SCRIPT_OPEN_TOKEN.length)
			if (openingTagEnd < 0) {
				state.scanIndex = source.length
				state.scannedLength = source.length
				state.safeContentEnd = state.scriptStart ?? state.safeContentEnd
				return state
			}

			state.mode = "script-content"
			index = openingTagEnd + 1
			state.scanIndex = index
			continue
		}

		if (state.mode === "script-content") {
			const closingTagStart = findToken(state.normalizedSource, SCRIPT_CLOSE_TOKEN, index, {
				ignoreHtmlComments: false,
			})
			if (closingTagStart < 0) {
				// Retain a short suffix so a split "</script>" is detected when the next chunk arrives.
				state.scanIndex = Math.max(index, source.length - SCRIPT_CLOSE_TOKEN.length + 1)
				state.scannedLength = source.length
				state.safeContentEnd = state.scriptStart ?? state.safeContentEnd
				return state
			}

			const closingTagEnd = findNextTagEnd(
				source,
				closingTagStart + SCRIPT_CLOSE_TOKEN.length,
			)
			if (closingTagEnd < 0) {
				state.scanIndex = closingTagStart
				state.scannedLength = source.length
				state.safeContentEnd = state.scriptStart ?? state.safeContentEnd
				return state
			}

			state.safeContentEnd = closingTagEnd + 1
			state.mode = "html"
			state.scriptStart = null
			index = closingTagEnd + 1
			state.scanIndex = index
			continue
		}

		const tagStart = source.indexOf("<", index)
		if (tagStart < 0) {
			state.safeContentEnd = source.length
			state.scanIndex = source.length
			state.scannedLength = source.length
			return state
		}

		if (source.startsWith(COMMENT_OPEN_TOKEN, tagStart)) {
			state.mode = "comment"
			index = tagStart + COMMENT_OPEN_TOKEN.length
			state.scanIndex = index
			continue
		}

		if (isPrefixOfToken(source, tagStart, SCRIPT_OPEN_TOKEN)) {
			state.mode = "script-opening"
			state.scriptStart = tagStart
			state.safeContentEnd = tagStart
			state.scanIndex = source.length
			state.scannedLength = source.length
			return state
		}

		if (
			source.slice(tagStart, tagStart + SCRIPT_OPEN_TOKEN.length).toLowerCase() ===
			SCRIPT_OPEN_TOKEN
		) {
			const boundary = source[tagStart + SCRIPT_OPEN_TOKEN.length]
			if (isTagNameBoundary(boundary)) {
				state.scriptStart = tagStart
				state.safeContentEnd = tagStart
				state.mode = "script-opening"
				state.scanIndex = tagStart + SCRIPT_OPEN_TOKEN.length
				continue
			}
		}

		index = tagStart + 1
		state.scanIndex = index
	}

	state.safeContentEnd = source.length
	state.scanIndex = source.length
	state.scannedLength = source.length
	return state
}

export function resolveStreamingHtmlCommitContentIncrementally(
	state: StreamingHtmlScanState | undefined,
	source: string,
) {
	const nextState = updateStreamingHtmlScanState(state, source)
	return {
		state: nextState,
		content: source.slice(0, nextState.safeContentEnd),
	}
}

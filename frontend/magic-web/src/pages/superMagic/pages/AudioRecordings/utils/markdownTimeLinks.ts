import type { Link, Parent, PhrasingContent, Root, Text } from "mdast"
import { parseRecordingTimeToSeconds } from "./time"

const TIME_TEXT_REGEX = /(\d{1,3}:[0-5]\d(?::[0-5]\d)?)/g
const RECORDING_TIME_TEXT_EXACT_REGEX = /^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/
const MARKDOWN_MAGIC_TIME_LINK_REGEX = /\[([^\]]+)]\(magic-time:\/\/\/?([^)]+)\)/g
const CODED_MAGIC_TIME_LINK_REGEX = /`\\?\[([^\\\]]+)\\?]\??\\?\(magic-time:\/\/\/?([^\\)]+)\\?\)`/g
const PLAIN_MAGIC_TIME_TEXT_REGEX =
	/(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\s*\(magic-time:\/\/\/?([^)]+)\)/g
const MARKDOWN_LINK_REGEX = /\[[^\]]+]\([^)]+\)/g
const INLINE_CODE_REGEX = /`[^`\n]+`/g
const HTML_TAG_REGEX = /<\/?[A-Za-z][^>]*>/g
const SPEAKER_GROUP_REGEX = /\[(Speaker-[\w-]+(?:\s*,\s*Speaker-[\w-]+)+)]/g
const SPEAKER_ID_REGEX = /\bSpeaker-[\w-]+\b/g
const SPEAKER_ID_EXACT_REGEX = /^Speaker-[\w-]+$/
const INLINE_MAGIC_TIME_LINK_EXACT_REGEX =
	/^\\?\[([^\\\]]+)\\?]\??\\?\(magic-time:\/\/\/?([^\\)]+)\\?\)$/
const AST_RECORDING_TOKEN_REGEX =
	/\[(Speaker-[\w-]+(?:\s*,\s*Speaker-[\w-]+)+)]|(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\s*\(magic-time:\/\/\/?([^)]+)\)|\bSpeaker-[\w-]+\b|\d{1,3}:[0-5]\d(?::[0-5]\d)?/g
const SKIP_AST_CHILDREN_TYPES = new Set(["link", "linkReference", "definition", "html", "code"])

/** Creates a remark plugin that turns plain recording text tokens into internal markdown links. */
export function createRecordingMarkdownRemarkPlugin(speakerNameMap: Record<string, string>) {
	return function recordingMarkdownRemarkPlugin() {
		return function transformRecordingMarkdownLinks(tree: Root) {
			transformRecordingTextChildren(tree, speakerNameMap)
		}
	}
}

/** Walks mdast children and only rewrites plain text nodes outside links/code/html. */
function transformRecordingTextChildren(parent: Parent, speakerNameMap: Record<string, string>) {
	const children = parent.children

	for (let index = 0; index < children.length; index += 1) {
		const child = children[index]

		if (child.type === "text") {
			if (isTextBetweenInlineHtmlTags(children, index)) continue

			const replacement = splitRecordingTextNode(child, speakerNameMap)
			if (replacement) {
				children.splice(index, 1, ...replacement)
				index += replacement.length - 1
			}
			continue
		}

		if (SKIP_AST_CHILDREN_TYPES.has(child.type)) continue

		if ("children" in child && Array.isArray(child.children)) {
			transformRecordingTextChildren(child as Parent, speakerNameMap)
		}
	}
}

/** Keeps raw inline HTML content intact because rehypeRaw owns parsing and sanitizing that subtree. */
function isTextBetweenInlineHtmlTags(children: Parent["children"], index: number): boolean {
	const previousNode = children[index - 1]
	const nextNode = children[index + 1]

	if (previousNode?.type !== "html" || nextNode?.type !== "html") return false

	return isOpeningHtmlTag(previousNode.value) && isClosingHtmlTag(nextNode.value)
}

/** Detects a simple raw HTML opening tag emitted as an mdast html sibling. */
function isOpeningHtmlTag(value: string): boolean {
	return /^<([A-Za-z][\w:-]*)(?:\s[^>]*)?>$/.test(value.trim())
}

/** Detects a simple raw HTML closing tag emitted as an mdast html sibling. */
function isClosingHtmlTag(value: string): boolean {
	return /^<\/[A-Za-z][\w:-]*>$/.test(value.trim())
}

/** Splits one text node into plain text plus magic-time/magic-speaker link nodes. */
function splitRecordingTextNode(
	node: Text,
	speakerNameMap: Record<string, string>,
): PhrasingContent[] | null {
	const value = node.value
	const nodes: PhrasingContent[] = []
	let lastIndex = 0
	let hasReplacement = false

	AST_RECORDING_TOKEN_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = AST_RECORDING_TOKEN_REGEX.exec(value)) !== null) {
		if (match.index > lastIndex) {
			nodes.push({ type: "text", value: value.slice(lastIndex, match.index) })
		}

		nodes.push(...createRecordingTokenNodes(match, speakerNameMap))
		lastIndex = match.index + match[0].length
		hasReplacement = true
	}

	if (!hasReplacement) return null

	if (lastIndex < value.length) {
		nodes.push({ type: "text", value: value.slice(lastIndex) })
	}

	return nodes
}

/** Maps a matched recording token to one or more internal link nodes. */
function createRecordingTokenNodes(
	match: RegExpExecArray,
	speakerNameMap: Record<string, string>,
): PhrasingContent[] {
	const speakerGroup = match[1]
	const plainMagicTimeLabel = match[2]
	const plainMagicTimeSeconds = match[3]
	const token = match[0]

	if (speakerGroup) {
		return speakerGroup.split(/\s*,\s*/).flatMap((speakerId, index) => {
			const speakerLink = createSpeakerLinkNode(speakerId, speakerNameMap)
			return index === 0 ? [speakerLink] : [{ type: "text", value: " " } as Text, speakerLink]
		})
	}

	if (plainMagicTimeLabel) {
		return [createTimeLinkNode(plainMagicTimeLabel, Number(plainMagicTimeSeconds))]
	}

	if (SPEAKER_ID_EXACT_REGEX.test(token)) {
		return [createSpeakerLinkNode(token, speakerNameMap)]
	}

	return [createTimeLinkNode(token, parseRecordingTimeToSeconds(token))]
}

/** Builds a magic-speaker mdast link node consumed by the ReactMarkdown anchor override. */
function createSpeakerLinkNode(speakerId: string, speakerNameMap: Record<string, string>): Link {
	const label = speakerNameMap[speakerId]?.trim() || speakerId
	return {
		type: "link",
		url: `magic-speaker://${encodeURIComponent(speakerId)}`,
		children: [{ type: "text", value: label }],
	}
}

/** Builds a magic-time mdast link node consumed by the ReactMarkdown anchor override. */
function createTimeLinkNode(label: string, seconds: number): Link {
	return {
		type: "link",
		url: `magic-time://${seconds}`,
		children: [{ type: "text", value: label }],
	}
}

/** Returns true when an inline-code value is only a plain recording timestamp. */
export function isRecordingTimeText(value: string): boolean {
	return RECORDING_TIME_TEXT_EXACT_REGEX.test(value)
}

/** Parses inline-code magic-time links, including historical escaped markdown syntax. */
export function parseRecordingInlineCodeTimeLink(
	value: string,
): { label: string; seconds: number } | null {
	const match = value.trim().match(INLINE_MAGIC_TIME_LINK_EXACT_REGEX)
	if (!match) return null

	const seconds = Number(match[2])
	if (!Number.isFinite(seconds)) return null

	return {
		label: match[1],
		seconds,
	}
}

/** Converts plain time text in markdown into internal links handled by the shared audio player. */
export function injectMarkdownTimeLinks(markdown: string): string {
	const preservedLinks: string[] = []
	const withPlaceholders = markdown
		.replace(CODED_MAGIC_TIME_LINK_REGEX, (_match, label: string, seconds: string) => {
			return `[${label}](magic-time://${seconds})`
		})
		.replace(MARKDOWN_MAGIC_TIME_LINK_REGEX, (match) => {
			const index = preservedLinks.push(match) - 1
			return `MAGIC_TIME_LINK_${index}`
		})
		.replace(PLAIN_MAGIC_TIME_TEXT_REGEX, (_match, label: string, seconds: string) => {
			const index = preservedLinks.push(`[${label}](magic-time://${seconds})`) - 1
			return `MAGIC_TIME_LINK_${index}`
		})

	return withPlaceholders
		.replace(TIME_TEXT_REGEX, (match, _time: string, offset: number, source: string) => {
			// Check the prefix in code: regex lookbehind prevents older WebKit from loading this module.
			if (source.slice(offset - 2, offset) === "](") return match

			const seconds = parseRecordingTimeToSeconds(match)
			return `[${match}](magic-time://${seconds})`
		})
		.replace(
			/MAGIC_TIME_LINK_(\d+)/g,
			(_match, index: string) => preservedLinks[Number(index)] ?? "",
		)
}

/** Reads seconds from an internal markdown time link href. */
export function parseMarkdownTimeLink(href: string | undefined): number | null {
	if (!href?.match(/^magic-time:\/\/\/?/)) return null
	const seconds = Number(href.replace(/^magic-time:\/\/\/?/, ""))
	return Number.isFinite(seconds) ? seconds : null
}

/** Replaces matched markdown fragments with placeholders so later text transforms cannot corrupt them. */
function preserveMarkdownFragments(
	markdown: string,
	prefix: string,
	patterns: RegExp[],
): { text: string; restoreText: (value: string) => string } {
	const preservedFragments: string[] = []
	let text = markdown

	patterns.forEach((pattern) => {
		text = text.replace(pattern, (match) => {
			const index = preservedFragments.push(match) - 1
			return `${prefix}_${index}`
		})
	})

	return {
		text,
		restoreText: (value: string) => {
			const placeholderPattern = new RegExp(`${prefix}_(\\d+)`, "g")
			let restoredValue = value

			for (let depth = 0; depth < preservedFragments.length; depth += 1) {
				const nextValue = restoredValue.replace(
					placeholderPattern,
					(_match, index: string) => {
						return preservedFragments[Number(index)] ?? ""
					},
				)

				// Nested markdown syntax can produce placeholders inside restored fragments.
				if (nextValue === restoredValue) return restoredValue
				restoredValue = nextValue
			}

			return restoredValue
		},
	}
}

/** Converts speaker ids in markdown into internal links so every speaker pill opens settings. */
export function injectMarkdownSpeakerLinks(
	markdown: string,
	speakerNameMap: Record<string, string>,
): string {
	const preservedLinks: string[] = []
	const toSpeakerLink = (speakerId: string) => {
		const label = speakerNameMap[speakerId]?.trim() || speakerId
		const index =
			preservedLinks.push(`[${label}](magic-speaker://${encodeURIComponent(speakerId)})`) - 1
		return `MAGIC_SPEAKER_LINK_${index}`
	}

	// Preserve existing markdown links, inline code, and raw HTML so speaker injection only
	// touches plain text instead of rewriting href values or pre-authored rich content.
	const preservedContent = preserveMarkdownFragments(markdown, "MAGIC_PRESERVED_FRAGMENT", [
		MARKDOWN_LINK_REGEX,
		INLINE_CODE_REGEX,
		HTML_TAG_REGEX,
	])

	const withSpeakerLinks = preservedContent.text
		.replace(SPEAKER_GROUP_REGEX, (_match, group: string) =>
			group
				.split(/\s*,\s*/)
				.map((speakerId) => toSpeakerLink(speakerId))
				.join(" "),
		)
		.replace(SPEAKER_ID_REGEX, (speakerId) => toSpeakerLink(speakerId))
		.replace(
			/MAGIC_SPEAKER_LINK_(\d+)/g,
			(_match, index: string) => preservedLinks[Number(index)] ?? "",
		)

	return preservedContent.restoreText(withSpeakerLinks)
}

/** Rewrites plain speaker ids to display labels for non-interactive markdown renderers such as mind maps. */
export function resolveMarkdownSpeakerLabels(
	markdown: string,
	speakerNameMap: Record<string, string>,
): string {
	const preservedContent = preserveMarkdownFragments(markdown, "MAGIC_PRESERVED_FRAGMENT", [
		MARKDOWN_LINK_REGEX,
		HTML_TAG_REGEX,
	])

	const withSpeakerLabels = preservedContent.text.replace(SPEAKER_ID_REGEX, (speakerId) => {
		return speakerNameMap[speakerId]?.trim() || speakerId
	})

	return preservedContent.restoreText(withSpeakerLabels)
}

/** Reads the speaker id from an internal markdown speaker link href. */
export function parseMarkdownSpeakerLink(href: string | undefined): string | null {
	if (!href?.startsWith("magic-speaker://")) return null
	return decodeURIComponent(href.replace("magic-speaker://", ""))
}

/** Collects generated speaker ids from transcript and summary text. */
export function collectSpeakerIdsFromText(text: string): string[] {
	return Array.from(new Set(text.match(SPEAKER_ID_REGEX) ?? [])).sort()
}

/** Collects all unique speaker ids across transcript, notes, and summary text. */
export function collectRecordingSpeakerIds(contents: Array<string | undefined>): string[] {
	const allIds = contents.flatMap((content) => {
		if (!content) return []
		return collectSpeakerIdsFromText(content)
	})
	return Array.from(new Set(allIds)).sort()
}

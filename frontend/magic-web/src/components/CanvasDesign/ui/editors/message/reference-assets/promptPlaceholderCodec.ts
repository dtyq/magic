export interface PromptPlaceholderReference {
	path: string
	fileName: string
}

export interface PromptPlaceholderCodecOptions {
	buildToken: (index: number) => string
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replaceAll(text: string, pattern: RegExp, replacement: string): string {
	return text.replace(pattern, replacement)
}

export function encodePromptMentionsToPlaceholders(
	prompt: string,
	references: PromptPlaceholderReference[],
	options: PromptPlaceholderCodecOptions,
): string {
	let encoded = prompt
	for (let index = 0; index < references.length; index += 1) {
		const fileName = references[index]?.fileName?.trim()
		if (!fileName) continue
		const mentionPattern = new RegExp(`@${escapeRegex(fileName)}`, "gi")
		if (!mentionPattern.test(encoded)) continue
		// Reset lastIndex after test(); replace every repeated @fileName with the same token.
		mentionPattern.lastIndex = 0
		encoded = replaceAll(encoded, mentionPattern, options.buildToken(index + 1))
	}
	return encoded
}

export function decodePromptPlaceholdersToMentions(
	prompt: string,
	references: PromptPlaceholderReference[],
	options: PromptPlaceholderCodecOptions,
): string {
	let decoded = prompt
	for (let index = 0; index < references.length; index += 1) {
		const fileName = references[index]?.fileName?.trim()
		if (!fileName) continue
		const tokenPattern = new RegExp(escapeRegex(options.buildToken(index + 1)), "gi")
		if (!tokenPattern.test(decoded)) continue
		tokenPattern.lastIndex = 0
		decoded = replaceAll(decoded, tokenPattern, `@${fileName}`)
	}
	return decoded
}

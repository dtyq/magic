interface StyleDeclaration {
	property: string
	value: string
}

interface BackgroundStyleProbe {
	backgroundPosition: string
	backgroundSize: string
	backgroundRepeat: string
	backgroundAttachment: string
	backgroundOrigin: string
	backgroundClip: string
	backgroundColor: string
}

interface ParsedBackgroundShorthand {
	backgroundPosition: string
	backgroundSize: string
	backgroundRepeat: string
	backgroundAttachment: string
	backgroundOrigin: string
	backgroundClip: string
	backgroundColor: string
}

const BACKGROUND_RELATED_PROPERTIES = new Set([
	"background",
	"background-image",
	"background-position",
	"background-size",
	"background-repeat",
	"background-attachment",
	"background-origin",
	"background-clip",
	"background-color",
])

const BACKGROUND_LONGHAND_DEFAULTS: Record<string, string> = {
	"background-position": "0% 0%",
	"background-size": "auto",
	"background-repeat": "repeat",
	"background-attachment": "scroll",
	"background-origin": "padding-box",
	"background-clip": "border-box",
}

export function replaceBackgroundImageInStyleAttribute(data: {
	styleAttribute: string
	nextBackgroundImage: string
}): string {
	const { styleAttribute, nextBackgroundImage } = data
	const declarations = parseStyleDeclarations(styleAttribute)
	const preservedDeclarations = declarations.filter(
		(declaration) => !BACKGROUND_RELATED_PROPERTIES.has(declaration.property),
	)
	const probeStyle = createStyleProbe(styleAttribute)
	const nextDeclarations = [
		...preservedDeclarations,
		{
			property: "background-image",
			value: nextBackgroundImage,
		},
	]

	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-position",
		value: probeStyle.backgroundPosition,
	})
	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-size",
		value: probeStyle.backgroundSize,
	})
	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-repeat",
		value: probeStyle.backgroundRepeat,
	})
	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-attachment",
		value: probeStyle.backgroundAttachment,
	})
	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-origin",
		value: probeStyle.backgroundOrigin,
	})
	appendBackgroundLonghandIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		property: "background-clip",
		value: probeStyle.backgroundClip,
	})
	appendBackgroundColorIfNeeded({
		declarations: nextDeclarations,
		sourceDeclarations: declarations,
		value: probeStyle.backgroundColor,
	})

	return serializeStyleDeclarations(nextDeclarations)
}

export function normalizeConflictingBackgroundDeclarations(styleAttribute: string): string {
	const declarations = parseStyleDeclarations(styleAttribute)
	const hasBackgroundShorthand = declarations.some(
		(declaration) => declaration.property === "background",
	)
	const backgroundImageValue = getLastPropertyValue(declarations, "background-image")

	if (!hasBackgroundShorthand || !backgroundImageValue) return styleAttribute

	return replaceBackgroundImageInStyleAttribute({
		styleAttribute,
		nextBackgroundImage: backgroundImageValue,
	})
}

function appendBackgroundLonghandIfNeeded(data: {
	declarations: StyleDeclaration[]
	sourceDeclarations: StyleDeclaration[]
	property: string
	value: string
}): void {
	const { declarations, sourceDeclarations, property, value } = data
	if (!shouldPreserveBackgroundLonghand({ sourceDeclarations, property, value })) return

	declarations.push({
		property,
		value,
	})
}

function appendBackgroundColorIfNeeded(data: {
	declarations: StyleDeclaration[]
	sourceDeclarations: StyleDeclaration[]
	value: string
}): void {
	const { declarations, sourceDeclarations, value } = data
	if (!value) return

	if (
		hasExplicitProperty(sourceDeclarations, "background-color") ||
		!isTransparentBackgroundColor(value)
	) {
		declarations.push({
			property: "background-color",
			value,
		})
	}
}

function shouldPreserveBackgroundLonghand(data: {
	sourceDeclarations: StyleDeclaration[]
	property: string
	value: string
}): boolean {
	const { sourceDeclarations, property, value } = data
	if (!value) return false

	if (hasExplicitProperty(sourceDeclarations, property)) return true

	const defaultValue = BACKGROUND_LONGHAND_DEFAULTS[property]
	if (!defaultValue) return true

	return normalizeComparableValue(value) !== normalizeComparableValue(defaultValue)
}

function hasExplicitProperty(declarations: StyleDeclaration[], property: string): boolean {
	return declarations.some((declaration) => declaration.property === property)
}

function getLastPropertyValue(declarations: StyleDeclaration[], property: string): string {
	const declaration = [...declarations].reverse().find((item) => item.property === property)

	return declaration?.value || ""
}

function createStyleProbe(styleAttribute: string): BackgroundStyleProbe {
	const declarations = parseStyleDeclarations(styleAttribute)
	const shorthand = parseBackgroundShorthand(getLastPropertyValue(declarations, "background"))

	return {
		backgroundPosition:
			getLastPropertyValue(declarations, "background-position") ||
			shorthand.backgroundPosition,
		backgroundSize:
			getLastPropertyValue(declarations, "background-size") || shorthand.backgroundSize,
		backgroundRepeat:
			getLastPropertyValue(declarations, "background-repeat") || shorthand.backgroundRepeat,
		backgroundAttachment:
			getLastPropertyValue(declarations, "background-attachment") ||
			shorthand.backgroundAttachment,
		backgroundOrigin:
			getLastPropertyValue(declarations, "background-origin") || shorthand.backgroundOrigin,
		backgroundClip:
			getLastPropertyValue(declarations, "background-clip") || shorthand.backgroundClip,
		backgroundColor:
			getLastPropertyValue(declarations, "background-color") || shorthand.backgroundColor,
	}
}

function serializeStyleDeclarations(declarations: StyleDeclaration[]): string {
	return declarations
		.map((declaration) => `${declaration.property}: ${declaration.value};`)
		.join(" ")
		.trim()
}

function parseStyleDeclarations(styleAttribute: string): StyleDeclaration[] {
	return splitStyleDeclarations(styleAttribute)
		.map(parseStyleDeclaration)
		.filter((declaration): declaration is StyleDeclaration => Boolean(declaration))
}

function parseStyleDeclaration(declarationText: string): StyleDeclaration | null {
	const colonIndex = findTopLevelCharacterIndex(declarationText, ":")
	if (colonIndex <= 0) return null

	const property = declarationText.slice(0, colonIndex).trim().toLowerCase()
	const value = declarationText.slice(colonIndex + 1).trim()
	if (!property || !value) return null

	return { property, value }
}

function splitStyleDeclarations(styleAttribute: string): string[] {
	const declarations: string[] = []
	let buffer = ""
	let singleQuoteCount = 0
	let doubleQuoteCount = 0
	let parenthesisDepth = 0

	for (const character of styleAttribute) {
		if (character === "'" && doubleQuoteCount === 0) {
			singleQuoteCount = singleQuoteCount === 0 ? 1 : 0
		} else if (character === '"' && singleQuoteCount === 0) {
			doubleQuoteCount = doubleQuoteCount === 0 ? 1 : 0
		} else if (character === "(" && singleQuoteCount === 0 && doubleQuoteCount === 0) {
			parenthesisDepth += 1
		} else if (
			character === ")" &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth > 0
		) {
			parenthesisDepth -= 1
		}

		if (
			character === ";" &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth === 0
		) {
			const trimmedBuffer = buffer.trim()
			if (trimmedBuffer) declarations.push(trimmedBuffer)
			buffer = ""
			continue
		}

		buffer += character
	}

	const trimmedBuffer = buffer.trim()
	if (trimmedBuffer) declarations.push(trimmedBuffer)

	return declarations
}

function findTopLevelCharacterIndex(value: string, targetCharacter: string): number {
	let singleQuoteCount = 0
	let doubleQuoteCount = 0
	let parenthesisDepth = 0

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index]

		if (character === "'" && doubleQuoteCount === 0) {
			singleQuoteCount = singleQuoteCount === 0 ? 1 : 0
			continue
		}

		if (character === '"' && singleQuoteCount === 0) {
			doubleQuoteCount = doubleQuoteCount === 0 ? 1 : 0
			continue
		}

		if (character === "(" && singleQuoteCount === 0 && doubleQuoteCount === 0) {
			parenthesisDepth += 1
			continue
		}

		if (
			character === ")" &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth > 0
		) {
			parenthesisDepth -= 1
			continue
		}

		if (
			character === targetCharacter &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth === 0
		) {
			return index
		}
	}

	return -1
}

function parseBackgroundShorthand(backgroundValue: string): ParsedBackgroundShorthand {
	const fallbackValue: ParsedBackgroundShorthand = {
		backgroundPosition: "",
		backgroundSize: "",
		backgroundRepeat: "",
		backgroundAttachment: "",
		backgroundOrigin: "",
		backgroundClip: "",
		backgroundColor: "",
	}
	if (!backgroundValue || hasTopLevelComma(backgroundValue)) return fallbackValue

	const probedShorthand = parseBackgroundShorthandWithProbe(backgroundValue)
	if (probedShorthand) return probedShorthand

	const valueWithoutImage = backgroundValue
		.replace(/url\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi, "")
		.trim()
	if (!valueWithoutImage) return fallbackValue

	const tokens = tokenizeBackgroundValue(valueWithoutImage)
	const slashIndex = tokens.indexOf("/")
	const beforeSlashTokens = slashIndex >= 0 ? tokens.slice(0, slashIndex) : tokens
	const afterSlashTokens = slashIndex >= 0 ? tokens.slice(slashIndex + 1) : []
	const parsedValue: ParsedBackgroundShorthand = { ...fallbackValue }
	const positionTokens: string[] = []

	const assignToken = (token: string) => {
		if (!token) return

		if (isBackgroundRepeatToken(token)) {
			parsedValue.backgroundRepeat = joinBackgroundValue(parsedValue.backgroundRepeat, token)
			return
		}

		if (isBackgroundAttachmentToken(token)) {
			parsedValue.backgroundAttachment = token
			return
		}

		if (isBackgroundOriginOrClipToken(token)) {
			if (!parsedValue.backgroundOrigin) {
				parsedValue.backgroundOrigin = token
				return
			}

			if (!parsedValue.backgroundClip) parsedValue.backgroundClip = token
			return
		}

		if (isBackgroundColorToken(token)) {
			parsedValue.backgroundColor = token
			return
		}

		positionTokens.push(token)
	}

	beforeSlashTokens.forEach(assignToken)

	if (positionTokens.length > 0) {
		parsedValue.backgroundPosition = positionTokens.join(" ")
	}

	if (afterSlashTokens.length > 0) {
		const [sizeToken, ...remainingTokens] = afterSlashTokens
		if (sizeToken) parsedValue.backgroundSize = sizeToken
		remainingTokens.forEach(assignToken)
	}

	return parsedValue
}

function parseBackgroundShorthandWithProbe(
	backgroundValue: string,
): ParsedBackgroundShorthand | null {
	if (typeof document === "undefined") return null

	const probeElement = document.createElement("div")
	probeElement.style.background = ""
	probeElement.style.background = backgroundValue

	const probedShorthand: ParsedBackgroundShorthand = {
		backgroundPosition: probeElement.style.backgroundPosition || "",
		backgroundSize: probeElement.style.backgroundSize || "",
		backgroundRepeat: probeElement.style.backgroundRepeat || "",
		backgroundAttachment: probeElement.style.backgroundAttachment || "",
		backgroundOrigin: probeElement.style.backgroundOrigin || "",
		backgroundClip: probeElement.style.backgroundClip || "",
		backgroundColor: probeElement.style.backgroundColor || "",
	}

	// Some values (for example with unresolved CSS variables) may be partially
	// dropped by CSSOM in jsdom/runtime. Fallback to manual parsing when probe
	// cannot extract any meaningful longhand/color information.
	const hasMeaningfulParsedValue = Object.values(probedShorthand).some(Boolean)
	if (!hasMeaningfulParsedValue) return null

	return probedShorthand
}

function tokenizeBackgroundValue(value: string): string[] {
	const tokens: string[] = []
	let buffer = ""
	let parenthesisDepth = 0

	for (const character of value) {
		if (character === "(") {
			parenthesisDepth += 1
			buffer += character
			continue
		}

		if (character === ")" && parenthesisDepth > 0) {
			parenthesisDepth -= 1
			buffer += character
			continue
		}

		if (parenthesisDepth === 0 && (character === "/" || /\s/.test(character))) {
			const trimmedBuffer = buffer.trim()
			if (trimmedBuffer) tokens.push(trimmedBuffer)
			buffer = ""

			if (character === "/") tokens.push(character)
			continue
		}

		buffer += character
	}

	const trimmedBuffer = buffer.trim()
	if (trimmedBuffer) tokens.push(trimmedBuffer)

	return tokens
}

function hasTopLevelComma(value: string): boolean {
	let singleQuoteCount = 0
	let doubleQuoteCount = 0
	let parenthesisDepth = 0

	for (const character of value) {
		if (character === "'" && doubleQuoteCount === 0) {
			singleQuoteCount = singleQuoteCount === 0 ? 1 : 0
			continue
		}

		if (character === '"' && singleQuoteCount === 0) {
			doubleQuoteCount = doubleQuoteCount === 0 ? 1 : 0
			continue
		}

		if (character === "(" && singleQuoteCount === 0 && doubleQuoteCount === 0) {
			parenthesisDepth += 1
			continue
		}

		if (
			character === ")" &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth > 0
		) {
			parenthesisDepth -= 1
			continue
		}

		if (
			character === "," &&
			singleQuoteCount === 0 &&
			doubleQuoteCount === 0 &&
			parenthesisDepth === 0
		) {
			return true
		}
	}

	return false
}

function joinBackgroundValue(currentValue: string, nextToken: string): string {
	if (!currentValue) return nextToken

	return `${currentValue} ${nextToken}`
}

function isBackgroundRepeatToken(token: string): boolean {
	return ["repeat", "repeat-x", "repeat-y", "no-repeat", "space", "round"].includes(
		normalizeComparableValue(token),
	)
}

function isBackgroundAttachmentToken(token: string): boolean {
	return ["scroll", "fixed", "local"].includes(normalizeComparableValue(token))
}

function isBackgroundOriginOrClipToken(token: string): boolean {
	return ["border-box", "padding-box", "content-box"].includes(normalizeComparableValue(token))
}

function isBackgroundColorToken(token: string): boolean {
	const normalizedToken = normalizeComparableValue(token)
	if (isCssColorWithProbe(token)) return true

	return (
		normalizedToken === "transparent" ||
		normalizedToken === "currentcolor" ||
		normalizedToken.startsWith("#") ||
		normalizedToken.startsWith("rgb(") ||
		normalizedToken.startsWith("rgba(") ||
		normalizedToken.startsWith("hsl(") ||
		normalizedToken.startsWith("hsla(") ||
		normalizedToken.startsWith("oklch(") ||
		normalizedToken.startsWith("lab(") ||
		normalizedToken.startsWith("lch(") ||
		normalizedToken.startsWith("color(") ||
		normalizedToken.startsWith("var(")
	)
}

function isCssColorWithProbe(token: string): boolean {
	if (typeof document === "undefined") return false

	const probeElement = document.createElement("div")
	probeElement.style.color = ""
	probeElement.style.color = token.trim()

	return Boolean(probeElement.style.color)
}

function normalizeComparableValue(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function isTransparentBackgroundColor(value: string): boolean {
	const normalizedValue = normalizeComparableValue(value)
	return normalizedValue === "transparent" || normalizedValue === "rgba(0, 0, 0, 0)"
}

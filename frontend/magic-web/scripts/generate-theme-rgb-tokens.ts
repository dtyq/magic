import fs from "fs"
import path from "path"
import postcss from "postcss"
import postcssOklabFunction from "@csstools/postcss-oklab-function"

const TARGET_FILES = [
	"src/index.css",
]

// Match OKLCH channel tokens like:
// --primary: 0.205 0 0;
const OKLCH_CHANNEL_DECLARATION_PATTERN =
	/^(\s*)(--[a-z0-9-]+)(:\s*)([0-9.]+(?:\s+[0-9.]+){2})(;\s*)$/i

const processor = postcss([
	postcssOklabFunction({
		subFeatures: {
			displayP3: false,
		},
	}),
])

const rgbCache = new Map<string, string>()
const isCheckMode = process.argv.includes("--check")

function getWorkspaceRoot() {
	return process.cwd()
}

function getAbsolutePath(relativePath: string) {
	return path.resolve(getWorkspaceRoot(), relativePath)
}

async function convertOklchChannelsToRgb(channels: string) {
	const cached = rgbCache.get(channels)
	if (cached) return cached

	// Reuse the same conversion path as the CSS build pipeline.
	const css = `.token { color: oklch(${channels}); }`
	const result = await processor.process(css, { from: undefined })
	const match = result.css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)

	if (!match) {
		throw new Error(`Failed to convert OKLCH channels: ${channels}`)
	}

	const rgbValue = `${match[1]} ${match[2]} ${match[3]}`
	rgbCache.set(channels, rgbValue)
	return rgbValue
}

function createRgbDeclaration(params: {
	indentation: string
	tokenName: string
	separator: string
	rgbValue: string
	trailing: string
}) {
	const { indentation, tokenName, separator, rgbValue, trailing } = params

	return `${indentation}${tokenName}-rgb${separator}${rgbValue}${trailing}`
}

async function syncRgbTokensForFile(relativePath: string) {
	const absolutePath = getAbsolutePath(relativePath)
	const originalContent = fs.readFileSync(absolutePath, "utf8")
	const lines = originalContent.split("\n")
	const nextLines: string[] = []

	for (let index = 0; index < lines.length; index += 1) {
		const currentLine = lines[index]
		const declarationMatch = currentLine.match(OKLCH_CHANNEL_DECLARATION_PATTERN)
		if (!declarationMatch) {
			nextLines.push(currentLine)
			continue
		}

		const [, indentation, tokenName, separator, channels, trailing] = declarationMatch
		if (tokenName.endsWith("-rgb")) {
			nextLines.push(currentLine)
			continue
		}

		const rgbValue = await convertOklchChannelsToRgb(channels)
		const rgbDeclaration = createRgbDeclaration({
			indentation,
			tokenName,
			separator,
			rgbValue,
			trailing,
		})

		nextLines.push(currentLine)
		nextLines.push(rgbDeclaration)

		const nextLine = lines[index + 1]
		// Replace an existing sibling -rgb token in place.
		if (nextLine?.trimStart().startsWith(`${tokenName}-rgb:`)) {
			index += 1
		}
	}

	const nextContent = nextLines.join("\n")
	if (nextContent === originalContent) {
		return {
			relativePath,
			updated: false,
		}
	}

	// Check mode reports drift without mutating files.
	if (!isCheckMode) fs.writeFileSync(absolutePath, nextContent, "utf8")

	return {
		relativePath,
		updated: true,
	}
}

async function main() {
	const results = await Promise.all(TARGET_FILES.map(syncRgbTokensForFile))
	const updatedFiles = results.filter((result) => result.updated)

	if (updatedFiles.length === 0) {
		console.log("Theme RGB tokens are already in sync.")
		return
	}

	if (isCheckMode) {
		console.error("Theme RGB tokens are out of sync:")
		updatedFiles.forEach((result) => {
			console.error(`- ${result.relativePath}`)
		})
		console.error("Run `pnpm generate:theme-rgb-tokens` to fix them.")
		process.exitCode = 1
		return
	}

	console.log("Updated theme RGB tokens:")
	updatedFiles.forEach((result) => {
		console.log(`- ${result.relativePath}`)
	})
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})

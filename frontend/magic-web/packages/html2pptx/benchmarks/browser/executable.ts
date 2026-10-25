import { constants as fsConstants } from "node:fs"
import { accessSync, existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import puppeteer from "puppeteer"

export function resolveChromeExecutable(
	explicitPath: string | undefined,
	headful: boolean,
): string {
	const requested = explicitPath || process.env.PUPPETEER_EXECUTABLE_PATH
	if (requested) {
		const resolved = resolve(requested)
		if (isExecutable(resolved)) return resolved
		throw new Error(`Configured Chrome executable is unavailable: ${resolved}`)
	}

	let puppeteerDefault: string | undefined
	try {
		puppeteerDefault = puppeteer.executablePath()
	} catch {
		// A Puppeteer package may be installed without its pinned browser revision.
	}

	const cached: string[] = []
	for (const cacheRoot of puppeteerCacheRoots()) {
		cached.push(...findCachedChromeExecutables(cacheRoot))
	}
	const cachedHeadlessShell = cached.filter(isHeadlessShell)
	const cachedFullChrome = cached.filter((path) => !isHeadlessShell(path))
	const candidates = headful
		? [puppeteerDefault, ...cachedFullChrome, ...systemChromeCandidates()]
		: [
				...cachedHeadlessShell,
				puppeteerDefault,
				...cachedFullChrome,
				...systemChromeCandidates(),
			]

	const executable = unique(candidates).find(isExecutable)
	if (executable) return executable

	throw new Error(
		[
			"No usable Chrome/Chromium executable was found.",
			"Pass --chrome-path /absolute/path/to/chrome or set PUPPETEER_EXECUTABLE_PATH.",
			"To install Puppeteer's pinned browser, run:",
			"  pnpm exec puppeteer browsers install chrome",
		].join("\n"),
	)
}

function isHeadlessShell(path: string): boolean {
	return path.toLowerCase().includes("headless-shell")
}

function puppeteerCacheRoots(): string[] {
	return unique(
		[
			process.env.PUPPETEER_CACHE_DIR,
			join(homedir(), ".cache", "puppeteer"),
			join(homedir(), "Library", "Caches", "puppeteer"),
		].filter((value): value is string => Boolean(value)),
	)
}

function findCachedChromeExecutables(cacheRoot: string): string[] {
	if (!existsSync(cacheRoot)) return []
	const matches: string[] = []
	walk(cacheRoot, 0, 8, (path) => {
		const name = basename(path)
		if (
			name === "chrome" ||
			name === "chrome-headless-shell" ||
			name === "Google Chrome for Testing"
		) {
			matches.push(path)
		}
	})
	return matches.sort().reverse()
}

function walk(
	directory: string,
	depth: number,
	maxDepth: number,
	onFile: (path: string) => void,
): void {
	if (depth > maxDepth) return
	let entries
	try {
		entries = readdirSync(directory, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) walk(path, depth + 1, maxDepth, onFile)
		else if (entry.isFile()) onFile(path)
	}
}

function systemChromeCandidates(): string[] {
	if (process.platform === "darwin") {
		return [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		]
	}
	if (process.platform === "win32") {
		return [
			join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
			join(
				process.env["PROGRAMFILES(X86)"] ?? "",
				"Google",
				"Chrome",
				"Application",
				"chrome.exe",
			),
			join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
		]
	}
	return [
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	]
}

function isExecutable(path: string): boolean {
	if (!path) return false
	try {
		accessSync(path, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK)
		return true
	} catch {
		return false
	}
}

function unique(values: Array<string | undefined>): string[] {
	return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

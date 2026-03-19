import fs from "fs"
import path from "path"
import { URL } from "url"
import lighthouse, { type Flags, type RunnerResult } from "lighthouse"
import desktopConfig from "lighthouse/core/config/desktop-config.js"
import puppeteer, { type Browser, type ElementHandle, type Page } from "puppeteer"

interface Config {
	loginUrl: string
	targetUrl: string
	outputPath: string
	preset: "mobile" | "desktop"
	username: string
	password: string
	headless: boolean
}

const ENV_FILE = ".env.lighthouse"
const ENV_FILE_LOCAL = ".env.lighthouse.local"
const ENV_TEMPLATE = `MAGIC_USER=your_phone
MAGIC_PASS=your_password

# Optional overrides
# LH_TARGET=https://magic-web-beta.saas-test.cn-beijing.volce.teamshare.work/global/super/798545276362810363
# LH_LOGIN_URL=https://magic-web-beta.saas-test.cn-beijing.volce.teamshare.work/login
# LH_PRESET=desktop   # or mobile
# LH_OUTPUT=lh-audit.json
# LH_HEADLESS=true    # set false to watch the flow
# LH_SLOWMO=0        # optional, ms delay between puppeteer ops
`

function parseEnvFile(filePath: string): Record<string, string> {
	const content = fs.readFileSync(filePath, "utf-8")
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.reduce<Record<string, string>>((acc, line) => {
			const idx = line.indexOf("=")
			if (idx === -1) return acc
			const key = line.slice(0, idx).trim()
			const value = line.slice(idx + 1).trim()
			if (key) acc[key] = value
			return acc
		}, {})
}

function ensureEnvLoaded(): void {
	const cwd = process.cwd()
	const localPath = path.resolve(cwd, ENV_FILE_LOCAL)
	const defaultPath = path.resolve(cwd, ENV_FILE)

	let envPath: string | null = null
	if (fs.existsSync(localPath)) envPath = localPath
	else if (fs.existsSync(defaultPath)) envPath = defaultPath
	else {
		fs.writeFileSync(defaultPath, ENV_TEMPLATE, "utf-8")
		// eslint-disable-next-line no-console
		console.log(`${ENV_FILE} created. Please edit credentials before rerun.`)
		throw new Error(`${ENV_FILE} missing. Template created.`)
	}

	const parsed = parseEnvFile(envPath)
	Object.entries(parsed).forEach(([key, value]) => {
		if (process.env[key] === undefined) process.env[key] = value
	})
	// eslint-disable-next-line no-console
	console.log(`Loaded Lighthouse env from ${path.basename(envPath)}`)
}

function resolveChromeExecutable(): string | undefined {
	const candidates = [
		process.env.PUPPETEER_EXECUTABLE_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
		"/usr/bin/google-chrome",
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
	].filter(Boolean) as string[]

	return candidates.find((candidate) => fs.existsSync(candidate))
}

function resolveConfig(): Config {
	const { MAGIC_USER, MAGIC_PASS, LH_TARGET, LH_LOGIN_URL, LH_OUTPUT, LH_PRESET, LH_HEADLESS } =
		process.env

	if (!MAGIC_USER || !MAGIC_PASS) {
		throw new Error("MAGIC_USER and MAGIC_PASS are required")
	}

	const preset = LH_PRESET === "mobile" ? "mobile" : "desktop"
	const headless =
		LH_HEADLESS !== undefined ? LH_HEADLESS !== "false" && LH_HEADLESS !== "0" : true
	return {
		loginUrl:
			LH_LOGIN_URL ??
			"https://magic-web-beta.saas-test.cn-beijing.volce.teamshare.work/login",
		targetUrl:
			LH_TARGET ??
			"https://magic-web-beta.saas-test.cn-beijing.volce.teamshare.work/global/super/798545276362810363",
		outputPath: path.resolve(process.cwd(), LH_OUTPUT ?? "lh-audit.json"),
		preset,
		username: MAGIC_USER,
		password: MAGIC_PASS,
		headless,
	}
}

async function clickByText(page: Page, text: string): Promise<boolean> {
	const handle = await page.evaluateHandle((targetText) => {
		const snapshot = document.evaluate(
			`//*[contains(normalize-space(text()), "${targetText}")]`,
			document,
			null,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
			null,
		)
		if (!snapshot.snapshotLength) return null
		return snapshot.snapshotItem(0)
	}, text)

	const element = handle.asElement?.() as ElementHandle<Element> | null
	if (!element) return false
	await element.click()
	return true
}

async function clickButtonByText(page: Page, text: string, timeout = 5000): Promise<boolean> {
	await page.waitForSelector("body", { timeout: 500 }).catch(() => null)
	const clicked = await page.evaluate((targetText) => {
		const buttons = Array.from(document.querySelectorAll("button"))
		const match = buttons.find((btn) => btn.textContent?.trim().includes(targetText))
		if (!match) return false
		;(match as HTMLButtonElement).click()
		return true
	}, text)
	if (clicked) return true
	// fallback wait and retry once
	try {
		await page.waitForSelector("button", { timeout })
		const second = await page.evaluate((targetText) => {
			const buttons = Array.from(document.querySelectorAll("button"))
			const match = buttons.find((btn) => btn.textContent?.trim().includes(targetText))
			if (!match) return false
			;(match as HTMLButtonElement).click()
			return true
		}, text)
		return Boolean(second)
	} catch {
		return false
	}
}

async function waitForFirst(
	page: Page,
	selectors: string[],
	options?: { timeout?: number },
): Promise<ElementHandle<Element>> {
	for (const selector of selectors) {
		try {
			const handle = await page.waitForSelector(selector, options)
			if (handle) return handle as ElementHandle<Element>
		} catch {
			// try next selector
		}
	}
	throw new Error(`Failed to find selectors: ${selectors.join(", ")}`)
}

async function typeBySelectors(
	page: Page,
	selectors: string[],
	value: string,
	options?: { timeout?: number },
): Promise<void> {
	const input = await waitForFirst(page, selectors, options)
	await input.click({ clickCount: 3 })
	await input.type(value, { delay: 20 })
}

async function isLoginContext(page: Page): Promise<boolean> {
	const url = page.url()
	if (url.includes("/login")) return true
	const marker = await Promise.race([
		page
			.waitForSelector('input[placeholder*="密码"], input[type="password"]', {
				timeout: 2000,
			})
			.catch(() => null),
		page
			.waitForSelector(
				'input[placeholder*="手机"], input[placeholder*="手机号"], input[type="tel"]',
				{ timeout: 2000 },
			)
			.catch(() => null),
		page.waitForSelector("button", { timeout: 2000 }).catch(() => null),
	])
	return Boolean(marker)
}

function getViewport(preset: Config["preset"]) {
	if (preset === "mobile") {
		return { width: 390, height: 844, deviceScaleFactor: 1.25, isMobile: true }
	}
	return { width: 1440, height: 900, deviceScaleFactor: 1 }
}

async function performLogin(browser: Browser, config: Config): Promise<Page> {
	const page = await browser.newPage()
	await page.setViewport(getViewport(config.preset))
	if (config.preset === "mobile") {
		await page.setUserAgent(
			"Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36",
		)
	}

	await page.goto(config.loginUrl, { waitUntil: "networkidle2", timeout: 60000 })

	const shouldLogin = await isLoginContext(page)
	if (!shouldLogin) return page

	// 先切到密码登录，再同意弹窗，确保表单出现
	await clickByText(page, "密码登录")
	await clickButtonByText(page, "确 认")
	await clickByText(page, "确 认")

	await typeBySelectors(
		page,
		[
			'input[placeholder*="手机"]',
			'input[placeholder*="手机号"]',
			'input[placeholder*="mobile"]',
			'input[type="tel"]',
		],
		config.username,
		{ timeout: 20000 },
	)

	await typeBySelectors(
		page,
		['input[placeholder*="密码"]', 'input[type="password"]'],
		config.password,
		{ timeout: 20000 },
	)

	const clickedLogin = await clickByText(page, "登 录")
	if (!clickedLogin) throw new Error("Login button not found")

	await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
	if (typeof (page as any).waitForTimeout === "function") {
		await (page as any).waitForTimeout(3000)
	} else {
		await page.waitForSelector("body", { timeout: 3000 })
	}
	return page
}

async function run(): Promise<void> {
	ensureEnvLoaded()
	const config = resolveConfig()
	const executablePath = resolveChromeExecutable()
	if (!executablePath) {
		throw new Error(
			"Chrome not found. Run `pnpm lh:install` or set PUPPETEER_EXECUTABLE_PATH to your Chrome binary.",
		)
	}

	const browser = await puppeteer.launch({
		headless: config.headless,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
		executablePath,
		slowMo: Number(process.env.LH_SLOWMO ?? 0),
	})

	try {
		const page = await performLogin(browser, config)
		const port = Number(new URL(browser.wsEndpoint()).port)

		const flags: Flags = {
			onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
			output: "json",
			logLevel: "info",
			port,
		}

		const configOverrides = config.preset === "desktop" ? desktopConfig : undefined

		const result: RunnerResult | undefined = await lighthouse(
			config.targetUrl,
			flags,
			configOverrides,
			page as any,
		)

		if (!result) throw new Error("Lighthouse run returned no result")
		const { lhr } = result

		fs.writeFileSync(config.outputPath, JSON.stringify(lhr, null, 2), "utf-8")
		// eslint-disable-next-line no-console
		console.log(`Lighthouse report saved to ${config.outputPath}`)
	} finally {
		await browser.close()
	}
}

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error)
	process.exitCode = 1
})

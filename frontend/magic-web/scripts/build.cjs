#!/usr/bin/env node

/**
 * Build script
 * Builds iframe, syncs theme RGB tokens, obfuscates code, generates icon tags,
 * and builds main app
 */

const { spawn } = require("child_process")
const { env } = require("process")

// Color codes for output
const colors = {
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	reset: "\x1b[0m",
}

function log(message, color = "reset") {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: true,
			...options,
		})

		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`Command failed with code ${code}`))
			} else {
				resolve()
			}
		})

		child.on("error", reject)
	})
}

async function main() {
	try {
		log("Starting build process...", "green")

		// Step 1: Build iframe
		log("[1/4] Building iframe runtime...", "cyan")
		await runCommand("pnpm", ["run", "build:iframe"])
		log("Iframe runtime built successfully", "green")

		// Step 2: Sync theme RGB tokens
		log("[2/5] Syncing theme RGB tokens...", "cyan")
		await runCommand("pnpm", ["run", "generate:theme-rgb-tokens"])
		log("Theme RGB tokens synced successfully", "green")

		// Step 3: Generate icon tags
		log("[3/4] Generating icon tags...", "cyan")
		await runCommand("pnpm", ["run", "generate:icon-tags"])
		log("Icon tags generated successfully", "green")

		// Step 4: Build main app with increased memory
		log("[4/4] Building main application...", "cyan")
		await runCommand("vite", ["build"], {
			env: {
				...env,
				NODE_OPTIONS: "--max-old-space-size=16384",
			},
		})
		log("Main application built successfully", "green")

		log("\n✅ Build completed successfully!", "green")
	} catch (error) {
		log(`\n❌ Build failed: ${error.message}`, "red")
		process.exit(1)
	}
}

main()

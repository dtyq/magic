import { mkdirSync, readdirSync, copyFileSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { UserConfig } from "vite"

/** 是否为开发环境 */
export const isDev = process.env.NODE_ENV === "development"

function readPeerDependencyKeys(packageJsonPath: string): string[] {
	const raw = readFileSync(packageJsonPath, "utf8")
	const pkg = JSON.parse(raw) as { peerDependencies?: Record<string, string> }
	return Object.keys(pkg.peerDependencies || {})
}

/** Rollup external：读根 package.json 的 peers。 */
function getRollupExternalPeerKeys(projectRoot: string): string[] {
	return readPeerDependencyKeys(join(projectRoot, "package.json"))
}

// 递归复制目录
function copyDir(src: string, dest: string) {
	mkdirSync(dest, { recursive: true })
	const entries = readdirSync(src, { withFileTypes: true })

	for (const entry of entries) {
		const srcPath = join(src, entry.name)
		const destPath = join(dest, entry.name)

		if (entry.isDirectory()) {
			copyDir(srcPath, destPath)
		} else {
			copyFileSync(srcPath, destPath)
		}
	}
}

/** 复制 locales 下各语言目录到 dist（库构建产物） */
export function copyLocalesPlugin() {
	return {
		name: "copy-locales",
		closeBundle() {
			const srcLocales = resolve(process.cwd(), "src/locales")
			const destLocales = resolve(process.cwd(), "dist/src/locales")

			try {
				mkdirSync(destLocales, { recursive: true })
				const entries = readdirSync(srcLocales, { withFileTypes: true })
				for (const entry of entries) {
					if (!entry.isDirectory()) continue
					copyDir(join(srcLocales, entry.name), join(destLocales, entry.name))
				}
				console.log("✓ Locales copied to dist/src/locales/")
			} catch (error) {
				console.error("Failed to copy locales:", error)
			}
		},
	}
}

/**
 * 两版共享：server、alias、rollup external/output、不含 lib.entry / plugins / define。
 */
export function getBaseViteConfig(projectRoot: string): UserConfig {
	const peerDeps = getRollupExternalPeerKeys(projectRoot)

	return {
		server: {
			host: true,
			port: 443,
		},
		resolve: {
			alias: {
				"@admin": resolve(projectRoot, "./src"),
				"@admin-components": resolve(projectRoot, "./components/index.ts"),
			},
		},
		build: {
			target: "es2015",
			cssMinify: "esbuild",
			rollupOptions: {
				external: (id) => {
					if (["react", "react-dom", "react/jsx-runtime"].includes(id)) return true
					return peerDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))
				},
				output: {
					preserveModules: true,
					preserveModulesRoot: ".",
					entryFileNames: (chunkInfo) => {
						if (chunkInfo.name === "index") return "index.js"
						if (chunkInfo.name === "components") return "components/index.js"
						if (chunkInfo.name === "provider")
							return "src/provider/AdminProvider/index.js"
						if (chunkInfo.name === "ServiceIcon") {
							return "src/pages/PlatformPackage/components/ServiceIcon/index.js"
						}
						return "[name].js"
					},
				},
			},
		},
	}
}

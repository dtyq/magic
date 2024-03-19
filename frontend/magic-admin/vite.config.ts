import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve, join } from "path"
import dts from "vite-plugin-dts"
import mkcert from "vite-plugin-mkcert"
import pkg from "./package.json"
import { copyFileSync, mkdirSync, readdirSync } from "fs"

const peerDeps = Object.keys(pkg.peerDependencies || {})

/** 是否为开发环境 */
const isDev = process.env.NODE_ENV === "development"

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

// 自定义插件：复制 locales JSON 文件到 dist
function copyLocalesPlugin() {
	return {
		name: "copy-locales",
		closeBundle() {
			const srcLocales = resolve(__dirname, "src/locales")
			const destLocales = resolve(__dirname, "dist/src/locales")

			// 复制 zh_CN 和 en_US 目录
			const zh_CN_src = join(srcLocales, "zh_CN")
			const zh_CN_dest = join(destLocales, "zh_CN")
			const en_US_src = join(srcLocales, "en_US")
			const en_US_dest = join(destLocales, "en_US")

			try {
				copyDir(zh_CN_src, zh_CN_dest)
				copyDir(en_US_src, en_US_dest)
				console.log("✓ Locales JSON files copied to dist/src/locales/")
			} catch (error) {
				console.error("Failed to copy locales:", error)
			}
		},
	}
}

// https://vite.dev/config/
export default defineConfig({
	server: {
		host: true,
		proxy: {
			"/server": {
				target: process.env.VITE_PROXY_API_URL,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/server/, ""),
			},
		},
		port: 443,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			components: resolve(__dirname, "./components/index.ts"),
		},
	},
	plugins: [
		react(),
		dts({
			include: ["./src", "./components"],
			tsconfigPath: "./tsconfig.app.json",
		}),
		// 复制 locales JSON 文件到 dist
		!isDev && copyLocalesPlugin(),
		// 用于本地生成HTTPS证书
		isDev &&
			mkcert({
				// 本地配置该地址的 host, 满足文件私有桶上传
				hosts: ["magic.com"],
			}),
	],
	define: {
		global: "globalThis",
	},
	build: {
		target: "modules",
		lib: {
			// 多入口：同时构建 src 和 components
			entry: {
				index: "src/index.ts",
				"components/index": "components/index.ts",
			},
			formats: ["es"],
		},
		rollupOptions: {
			external: (id) => {
				// 匹配 react 相关
				if (["react", "react-dom", "react/jsx-runtime"].includes(id)) return true
				// 匹配所有 peerDependencies 及其子路径
				return peerDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))
			},
			output: {
				preserveModules: true,
				preserveModulesRoot: ".",
				// 自定义入口文件输出路径
				entryFileNames: (chunkInfo) => {
					// index 入口 (src/index.ts) -> dist/index.js
					if (chunkInfo.name === "index") {
						return "index.js"
					}
					// components/index 入口 -> dist/components/index.js
					if (chunkInfo.name === "components/index") {
						return "components/index.js"
					}
					// 其他文件保持原路径
					return "[name].js"
				},
			},
		},
	},
})

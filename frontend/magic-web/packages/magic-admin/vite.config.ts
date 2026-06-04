import { defineConfig, mergeConfig } from "vite"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { getBaseViteConfig } from "./vite/config/base"
import { getOpensourceEditionConfig } from "./vite/config/opensource"

const projectRoot = path.dirname(fileURLToPath(new URL(import.meta.url)))

export default defineConfig(({ command }) => {
	if (command === "build") {
		process.env.NODE_ENV ??= "production"
	}
	return mergeConfig(
		getBaseViteConfig(projectRoot),
		getOpensourceEditionConfig(projectRoot),
	)
})

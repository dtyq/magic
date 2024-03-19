import { defineConfig, mergeConfig } from "vite"
import buildConfig from "./vite.config.build"
import devConfig from "./vite.config.dev"

// https://vite.dev/config/
export default defineConfig(({ command }) => {
	if (command === "build") {
		return mergeConfig(devConfig, buildConfig)
	}

	return devConfig
})

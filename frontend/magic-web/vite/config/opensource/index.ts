import { resolve } from "node:path"
import type { UserConfig } from "vite"
import type { EditionConfig } from "../../edition"

function getOpenSourceBuildInputs({
	projectRoot,
	rootDir,
}: {
	projectRoot: string
	rootDir: string
}): Record<string, string> {
	return {
		main: resolve(rootDir, "index.html"),
		// AudioWorklet processor as separate entry for compilation
		// AudioWorklet 处理器作为独立入口进行编译
		"worklets/recorder-worklet-processor": resolve(
			projectRoot,
			"src/opensource/services/recordSummary/MediaRecorderService/worklets/recorder-worklet-processor.ts",
		),
	}
}

export function getOpenSourceViteConfig({
	projectRoot,
	editionConfig,
}: {
	projectRoot: string
	editionConfig: EditionConfig
}): UserConfig {
	const rootDir = projectRoot

	return {
		root: rootDir,
		publicDir: resolve(projectRoot, "public"),
		cacheDir: `${projectRoot}/node_modules/.vite/${editionConfig.resolvedEdition}`,
		server: {
			port: editionConfig.devServerPort,
		},
		build: {
			rollupOptions: {
				input: getOpenSourceBuildInputs({
					projectRoot,
					rootDir,
				}),
			},
		},
	}
}

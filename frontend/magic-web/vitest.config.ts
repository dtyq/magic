import { resolve } from "path"
import { defineConfig, mergeConfig } from "vitest/config"
import { getViteEditionConfig } from "./vite/edition"

const getVitestBaseConfig = () => {
	return {
		resolve: {
			alias: {
				"@/": `${resolve(__dirname, "./src/")}/`,
				"@dtyq/es6-template-strings": resolve(
					__dirname,
					"src/test/mocks/es6-template-strings.ts",
				),
			},
		},
		test: {
			environment: "jsdom",
			globals: true,
			setupFiles: [resolve(__dirname, "test/setup.ts")],
			env: {
				CI: process.env.CI === "true" ? "true" : undefined,
			},
			server: {
				deps: {
					inline: [
						"esdk-obs-browserjs",
						"@dtyq/upload-sdk",
						"@dtyq/es6-template-strings",
						"@dtyq/magic-flow",
						"@dtyq/upload-sdk",
					],
				},
			},
		},
	}
}

export default defineConfig(
	mergeConfig(getVitestBaseConfig(), {
		resolve: getViteEditionConfig({ projectRoot: __dirname }).resolve,
	}),
)

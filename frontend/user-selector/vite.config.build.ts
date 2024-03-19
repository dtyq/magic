import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import pkg from "./package.json"

const peerDeps = [
	"class-variance-authority",
	"clsx",
	"tailwind-merge",
	...Object.keys(pkg.peerDependencies ?? {}),
]
const isExternal = (id: string) => peerDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))
const sharedAssetFileNames = (assetInfo: { name?: string }) =>
	assetInfo.name?.endsWith(".css") ? "styles/index.css" : "assets/[name][extname]"

const buildConfig = defineConfig({
	plugins: [
		dts({
			tsconfigPath: "./tsconfig.build.json",
			outDir: "dist/types",
			entryRoot: "src",
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: "src/index.ts",
			name: "user-selector",
		},
		minify: false,
		emptyOutDir: true,
		rollupOptions: {
			external: isExternal,
			output: [
				{
					format: "es",
					dir: "dist",
					preserveModules: true,
					preserveModulesRoot: "src",
					entryFileNames: "es/[name].js",
					assetFileNames: sharedAssetFileNames,
				},
				{
					format: "cjs",
					dir: "dist",
					preserveModules: true,
					preserveModulesRoot: "src",
					entryFileNames: "lib/[name].js",
					assetFileNames: sharedAssetFileNames,
					exports: "named",
				},
			],
		},
	},
})

export default buildConfig

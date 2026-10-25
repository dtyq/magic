import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"
import type { UserConfig } from "vite"
import { copyLocalesPlugin, isDev } from "./base"

export function getOpensourceEditionConfig(_projectRoot: string): UserConfig {
	return {
		define: {
			global: "globalThis",
			__BUILD_EDITION__: JSON.stringify("opensource"),
		},
		plugins: [
			react(),
			dts({
				// 共享预览模块位于包外，固定声明根目录以保持公开类型路径稳定。
				entryRoot: _projectRoot,
				include: ["./src", "./components"],
				tsconfigPath: "./tsconfig.build.json",
				outDir: "dist/types",
			}),
			!isDev && copyLocalesPlugin(),
		].filter(Boolean),
		build: {
			lib: {
				entry: {
					index: "src/index.ts",
					components: "components/index.ts",
					provider: "src/provider/AdminProvider/index.tsx",
					ServiceIcon: "src/pages/PlatformPackage/components/ServiceIcon/index.tsx",
				},
				formats: ["es"],
			},
		},
	}
}

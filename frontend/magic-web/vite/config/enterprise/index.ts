import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import type { UserConfig } from "vite"
import vitePluginEnterpriseOverlay from "../../../plugins/vite-plugin-enterprise-overlay"
import type { EditionConfig } from "../../edition"

function getEnterpriseBuildInputs({
	projectRoot,
	rootDir,
}: {
	projectRoot: string
	rootDir: string
}): Record<string, string> {
	return {
		main: resolve(rootDir, "index.html"),
		shared: resolve(rootDir, "shared.html"),
		search: resolve(rootDir, "search.html"),
		loginPopupCallback: resolve(rootDir, "login-popup-callback.html"),
		// AudioWorklet processor as separate entry for compilation
		// AudioWorklet 处理器作为独立入口进行编译
		"worklets/recorder-worklet-processor": resolve(
			projectRoot,
			"src/services/recordSummary/MediaRecorderService/worklets/recorder-worklet-processor.ts",
		),
	}
}

function getEnterprisePublicDir({ projectRoot }: { projectRoot: string }): string {
	const openSourcePublicDir = resolve(projectRoot, "public")
	const enterprisePublicDir = resolve(projectRoot, "enterprise/public")

	// 企业版未提供独立静态资源目录时，直接复用开源版 public
	if (!existsSync(enterprisePublicDir)) return openSourcePublicDir

	const mergedPublicDir = resolve(projectRoot, "node_modules/.vite/enterprise-public")

	// 先复制开源版资源，再复制企业版资源以实现同名覆盖
	recreateDirectory({ targetDir: mergedPublicDir })
	copyDirectoryIfExists({
		sourceDir: openSourcePublicDir,
		targetDir: mergedPublicDir,
	})
	copyDirectoryIfExists({
		sourceDir: enterprisePublicDir,
		targetDir: mergedPublicDir,
	})

	return mergedPublicDir
}

function recreateDirectory({ targetDir }: { targetDir: string }): void {
	rmSync(targetDir, {
		force: true,
		recursive: true,
	})
	mkdirSync(targetDir, {
		recursive: true,
	})
}

function copyDirectoryIfExists({
	sourceDir,
	targetDir,
}: {
	sourceDir: string
	targetDir: string
}): void {
	if (!existsSync(sourceDir)) return

	cpSync(sourceDir, targetDir, {
		force: true,
		recursive: true,
	})
}

export function getEnterpriseViteConfig({
	projectRoot,
	editionConfig,
}: {
	projectRoot: string
	editionConfig: EditionConfig
}): UserConfig {
	// 企业版入口文件位于 enterprise 目录下
	const rootDir = resolve(projectRoot, "enterprise")

	return {
		root: rootDir,
		// 企业版静态资源由 enterprise/public 覆盖开源版 public
		publicDir: getEnterprisePublicDir({ projectRoot }),
		cacheDir: `${projectRoot}/node_modules/.vite/${editionConfig.resolvedEdition}`,
		server: {
			port: editionConfig.devServerPort,
		},
		build: {
			rollupOptions: {
				input: getEnterpriseBuildInputs({
					projectRoot,
					rootDir,
				}),
			},
		},
		plugins: [
			vitePluginEnterpriseOverlay({
				projectRoot,
				openSourceDir: "src",
				enterpriseDir: `${editionConfig.resolvedEdition}/src`,
			}),
		],
		resolve: {
			alias: {
				"@enterprise": resolve(projectRoot, "enterprise/src"),
			},
		},
	}
}

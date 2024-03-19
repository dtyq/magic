import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"

interface VitePluginEnterpriseOverlayOptions {
	projectRoot: string
	enterpriseDir?: string
	openSourceDir?: string
}

const RESOLVE_EXTENSIONS = [
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".json",
	".css",
	".less",
	".scss",
	".sass",
	".svg",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
]

function splitRequest(request: string): { pathname: string; suffix: string } {
	const matched = request.match(/^([^?#]*)(.*)$/)
	if (!matched) return { pathname: request, suffix: "" }

	return {
		pathname: matched[1],
		suffix: matched[2] ?? "",
	}
}

function isRelativeImport(source: string): boolean {
	return source.startsWith("./") || source.startsWith("../")
}

function resolveFilePathWithoutExtension(filePath: string): string | null {
	if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath
	if (path.extname(filePath)) return null

	for (const extension of RESOLVE_EXTENSIONS) {
		const fileWithExtension = `${filePath}${extension}`
		if (fs.existsSync(fileWithExtension) && fs.statSync(fileWithExtension).isFile())
			return fileWithExtension
	}

	return null
}

function resolveFilePath(filePath: string): string | null {
	const directResolvedPath = resolveFilePathWithoutExtension(filePath)
	if (directResolvedPath) return directResolvedPath
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) return null

	for (const extension of RESOLVE_EXTENSIONS) {
		const indexPath = path.join(filePath, `index${extension}`)
		if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return indexPath
	}

	return null
}

function isSubPath(filePath: string, parentPath: string): boolean {
	const normalizedFilePath = path.resolve(filePath)
	const normalizedParentPath = path.resolve(parentPath)
	const parentPathWithSeparator = `${normalizedParentPath}${path.sep}`

	return (
		normalizedFilePath === normalizedParentPath ||
		normalizedFilePath.startsWith(parentPathWithSeparator)
	)
}

export default function vitePluginEnterpriseOverlay(
	options: VitePluginEnterpriseOverlayOptions,
): Plugin {
	const enterpriseDir = options.enterpriseDir ?? "enterprise"
	const openSourceDir = options.openSourceDir ?? "src"
	const openSourceRoot = path.resolve(options.projectRoot, openSourceDir)
	const enterpriseRoot = path.resolve(options.projectRoot, enterpriseDir)

	function getLogicalPathFromAbsolutePath(filePath: string): string | null {
		const normalizedPath = path.resolve(filePath)
		if (isSubPath(normalizedPath, enterpriseRoot))
			return path.relative(enterpriseRoot, normalizedPath)
		if (isSubPath(normalizedPath, openSourceRoot))
			return path.relative(openSourceRoot, normalizedPath)
		return null
	}

	function getLogicalImportPath(
		sourcePath: string,
		importerLogicalPath: string | null,
	): string | null {
		// Build 阶段部分 "@/..." 导入会先被 Vite alias 展开成绝对路径。
		// 如果这里不把绝对的 src/enterprise 路径还原成逻辑路径，
		// enterprise/a 内部导入 "@/opensource/..." 时就会直接落到物理 src，
		// 从而绕过 overlay，导致 src 中已删除但仅存在于 enterprise 的模块加载失败。
		if (path.isAbsolute(sourcePath))
			return getLogicalPathFromAbsolutePath(sourcePath)
		if (sourcePath.startsWith("@/")) return sourcePath.slice(2)
		if (sourcePath.startsWith("/src/")) return sourcePath.slice("/src/".length)
		if (sourcePath.startsWith("/enterprise/"))
			return sourcePath.slice("/enterprise/".length)
		if (!isRelativeImport(sourcePath) || !importerLogicalPath) return null

		return path.normalize(path.join(path.dirname(importerLogicalPath), sourcePath))
	}

	function resolveFromLogicalPath(logicalPath: string): string | null {
		const enterpriseCandidate = resolveFilePath(path.join(enterpriseRoot, logicalPath))
		if (enterpriseCandidate) return enterpriseCandidate

		return resolveFilePath(path.join(openSourceRoot, logicalPath))
	}

	return {
		name: "vite-plugin-enterprise-overlay",
		enforce: "pre",
		resolveId(source, importer) {
			if (source.startsWith("\0")) return null

			const sourceRequest = splitRequest(source)
			const importerRequest = importer ? splitRequest(importer).pathname : ""
			const importerLogicalPath = importerRequest
				? getLogicalPathFromAbsolutePath(importerRequest)
				: null

			const logicalImportPath = getLogicalImportPath(
				sourceRequest.pathname,
				importerLogicalPath,
			)
			if (!logicalImportPath) return null

			const resolvedFilePath = resolveFromLogicalPath(logicalImportPath)
			if (!resolvedFilePath) return null

			return `${resolvedFilePath}${sourceRequest.suffix}`
		},
		configureServer(server) {
			server.watcher.add(enterpriseRoot)
			const shouldReload = (filePath: string): boolean => isSubPath(filePath, enterpriseRoot)
			const reload = (filePath: string) => {
				if (!shouldReload(filePath)) return
				server.ws.send({ type: "full-reload" })
			}

			server.watcher.on("add", reload)
			server.watcher.on("unlink", reload)
			server.watcher.on("addDir", reload)
			server.watcher.on("unlinkDir", reload)
		},
	}
}

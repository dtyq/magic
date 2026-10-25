import type { CanvasDesignPlugin } from "../document/types"
import type { ResolveCanvasResourceReference } from "../../public/resource-reference"
import { resolveCanvasStorageResourceReference } from "../shared/path/canvasResourcePath"
import { isSafePluginRelativePath } from "./resolve"

type GetFileInfo = (path: string, options?: { forceRefresh?: boolean }) => Promise<{ src: string }>

interface LoadUserPluginsOptions {
	rootPath?: string
	directories?: string[]
	getFileInfo?: GetFileInfo
	resolveResourceReference?: ResolveCanvasResourceReference
}

export interface CanvasPluginManagerSnapshot {
	plugins: CanvasDesignPlugin[]
	activePlugin: CanvasDesignPlugin | null
	sessionId: number
}

export class PluginManager {
	private plugins = new Map<string, CanvasDesignPlugin>()
	private listeners = new Set<() => void>()
	private activePluginName: string | null = null
	private sessionId = 0
	private destroyed = false
	private snapshot: CanvasPluginManagerSnapshot = {
		plugins: [],
		activePlugin: null,
		sessionId: 0,
	}

	public register(plugin: CanvasDesignPlugin): void {
		if (this.destroyed) return
		this.plugins.set(plugin.name, plugin)
		this.rebuildSnapshot()
	}

	public registerMany(plugins: CanvasDesignPlugin[]): void {
		if (this.destroyed) return
		plugins.forEach((plugin) => {
			this.plugins.set(plugin.name, plugin)
		})
		this.rebuildSnapshot()
	}

	public unregister(name: string): void {
		this.plugins.delete(name)
		if (this.activePluginName === name) {
			this.activePluginName = null
			this.sessionId += 1
		}
		this.rebuildSnapshot()
	}

	public get(name: string): CanvasDesignPlugin | undefined {
		return this.plugins.get(name)
	}

	public list(): CanvasDesignPlugin[] {
		return this.snapshot.plugins
	}

	public open(name: string): void {
		if (!this.plugins.has(name)) {
			throw new Error(`CanvasDesign plugin not found: ${name}`)
		}
		this.activePluginName = name
		this.sessionId += 1
		this.rebuildSnapshot()
	}

	public close(name?: string): void {
		if (name && this.activePluginName !== name) return
		if (!this.activePluginName) return
		this.activePluginName = null
		this.sessionId += 1
		this.rebuildSnapshot()
	}

	public subscribe(listener: () => void): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	public getSnapshot(): CanvasPluginManagerSnapshot {
		return this.snapshot
	}

	public async loadUserPluginsFromCanvasResources(
		options: LoadUserPluginsOptions,
	): Promise<void> {
		if (this.destroyed) return
		const { rootPath, directories, getFileInfo, resolveResourceReference } = options
		if (!rootPath) return
		if (!directories?.length) return
		if (!getFileInfo || !resolveResourceReference) {
			console.warn(
				"[PluginManager] Cannot load user plugins without getFileInfo and resolveResourceReference.",
			)
			return
		}

		const normalizedRootPath = normalizePluginResourcePath(rootPath)

		try {
			const userPlugins = await Promise.all(
				directories.map((pluginDir) =>
					loadUserPluginPackage({
						rootPath: normalizedRootPath,
						pluginDir,
						getFileInfo,
						resolveResourceReference,
					}),
				),
			)
			if (this.destroyed) return
			this.registerMany(userPlugins)
		} catch (error) {
			console.warn(
				"[PluginManager] Failed to load user plugins from canvas resources.",
				error,
			)
		}
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.plugins.clear()
		this.listeners.clear()
		this.activePluginName = null
		this.sessionId += 1
		this.rebuildSnapshot()
	}

	private rebuildSnapshot(): void {
		this.snapshot = {
			plugins: Array.from(this.plugins.values()),
			activePlugin: this.activePluginName
				? (this.plugins.get(this.activePluginName) ?? null)
				: null,
			sessionId: this.sessionId,
		}
		this.listeners.forEach((listener) => listener())
	}
}

async function loadUserPluginPackage(options: {
	rootPath: string
	pluginDir: string
	getFileInfo: GetFileInfo
	resolveResourceReference: ResolveCanvasResourceReference
}): Promise<CanvasDesignPlugin> {
	const { rootPath, pluginDir, getFileInfo, resolveResourceReference } = options
	const packageRootPath = joinPluginResourcePath(rootPath, pluginDir)
	const manifestPath = joinPluginResourcePath(packageRootPath, "manifest.json")

	const manifest = await fetchJsonResource<Omit<CanvasDesignPlugin, "source">>({
		path: manifestPath,
		getFileInfo,
		resolveResourceReference,
	})
	assertSafePluginRelativePath(manifest.entry, "entry")
	const entryPath = joinPluginResourcePath(packageRootPath, manifest.entry)
	const stylePaths = normalizePluginStylePaths(manifest.styles).map((stylePath) =>
		joinPluginResourcePath(packageRootPath, assertSafePluginRelativePath(stylePath, "styles")),
	)
	const resolveResourceUrl = async (relativePath: string): Promise<string> => {
		const resourcePath = joinPluginResourcePath(
			packageRootPath,
			assertSafePluginRelativePath(relativePath, "resource"),
		)
		const resolvedPath = resolvePluginResourcePath(resourcePath, resolveResourceReference)
		const fileInfo = await getFileInfo(resolvedPath, { forceRefresh: true })
		return fileInfo.src
	}
	const runtimeCode = await fetchTextResource({
		path: entryPath,
		getFileInfo,
		resolveResourceReference,
	})
	const styleCode = await Promise.all(
		stylePaths.map((stylePath) =>
			fetchTextResource({
				path: stylePath,
				getFileInfo,
				resolveResourceReference,
			}),
		),
	)

	return {
		...manifest,
		entry: entryPath,
		styles: stylePaths,
		runtimeCode,
		styleCode,
		resolveResourceUrl,
		source: "user",
	}
}

async function fetchJsonResource<T>(options: {
	path: string
	getFileInfo: GetFileInfo
	resolveResourceReference: ResolveCanvasResourceReference
}): Promise<T> {
	const text = await fetchTextResource(options)
	return JSON.parse(text) as T
}

async function fetchTextResource(options: {
	path: string
	getFileInfo: GetFileInfo
	resolveResourceReference: ResolveCanvasResourceReference
}): Promise<string> {
	const { path, getFileInfo, resolveResourceReference } = options
	const resolvedPath = resolvePluginResourcePath(path, resolveResourceReference)
	const fileInfo = await getFileInfo(resolvedPath, { forceRefresh: true })
	const response = await fetch(fileInfo.src)
	if (!response.ok) {
		throw new Error(`Failed to fetch plugin resource: ${path}`)
	}
	return response.text()
}

function resolvePluginResourcePath(
	path: string,
	resolveResourceReference: ResolveCanvasResourceReference,
): string {
	const resolution = resolveCanvasStorageResourceReference(path, resolveResourceReference, {
		requireAttachment: true,
	})
	if (resolution.status !== "resolved" || !resolution.workspacePath) {
		throw new Error(`Unable to resolve plugin resource: ${path}`)
	}
	return resolution.workspacePath
}

function normalizePluginResourcePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+$/g, "")
}

function joinPluginResourcePath(...parts: string[]): string {
	return parts
		.map((part, index) => {
			const normalized = normalizePluginResourcePath(part)
			return index === 0 ? normalized : normalized.replace(/^\/+/g, "")
		})
		.filter(Boolean)
		.join("/")
}

function normalizePluginStylePaths(styles: CanvasDesignPlugin["styles"]): string[] {
	if (!styles) return []
	return Array.isArray(styles) ? styles : [styles]
}

function assertSafePluginRelativePath(path: string, field: string): string {
	if (isSafePluginRelativePath(path)) return path
	throw new Error(`Invalid plugin ${field} path: ${path}`)
}

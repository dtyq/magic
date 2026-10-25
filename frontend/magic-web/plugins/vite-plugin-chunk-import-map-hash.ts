import type { Plugin, Rollup } from "vite"

interface ChunkImportNode {
	identity: string
	imports: readonly string[]
	dynamicImports: readonly string[]
	cssCount: number
	isEmpty: boolean
}

interface ViteChunkMetadata {
	importedCss: Set<string>
}

type ChunkImportGraph = Map<string, ChunkImportNode>
type DependencySignature = readonly [identity: string, cssCount: number, isEmpty: boolean]

/**
 * Vite 在 generateBundle 才填入预加载表，此时打包器已完成文件名哈希。
 * import map 保持导入标识稳定，会暴露「同名文件、不同依赖表」的问题（vitejs/vite#23225）。
 * 将依赖关系提前加入哈希：只改子模块内容仍复用父模块；增删 JS/CSS 依赖时更新父模块。
 */
export default function createChunkImportMapHashPlugin(): Plugin {
	const graphs = new Map<string, ChunkImportGraph>()

	return {
		name: "vite-plugin-chunk-import-map-hash",
		apply: "build",
		enforce: "post",
		applyToEnvironment(environment) {
			const config = environment.config
			return (
				config.consumer === "client" &&
				!config.isWorker &&
				!config.build.lib &&
				config.build.chunkImportMap
			)
		},
		renderStart() {
			graphs.set(this.environment.name, new Map())
		},
		renderChunk(code, chunk, options, { chunks }) {
			if (options.format !== "es") return null
			const graph = graphs.get(this.environment.name)
			if (!graph) this.error("Chunk import graph was not initialized before rendering")
			if (!graph.size) initializeGraph(graph, chunks)

			const node = graph.get(chunk.fileName)
			if (!node)
				this.error(`Rendered chunk is missing from the import graph: ${chunk.fileName}`)
			const metadata = chunk.viteMetadata as ViteChunkMetadata | undefined
			node.cssCount = metadata?.importedCss.size ?? 0
			// 共享模块变成空 JS／仅样式后，Vite 会在哈希完成后删除其静态 import。
			// 该状态也必须影响导入方，不能只比较依赖名称和 CSS 数量。
			node.isEmpty = code === "" && chunk.exports.length === 0
			return null
		},
		augmentChunkHash(chunk) {
			const graph = graphs.get(this.environment.name)
			const node = graph?.get(chunk.fileName)
			if (!graph || !node) return

			const preloads = node.dynamicImports.map((fileName) =>
				collectStaticDependencies(graph, fileName, chunk.fileName),
			)
			const emptyImports = node.imports.flatMap((fileName) => {
				const dependency = graph.get(fileName)
				return dependency ? [[dependency.identity, dependency.isEmpty]] : []
			})
			if (!preloads.length && !emptyImports.length) return
			return JSON.stringify({ preloads, emptyImports })
		},
	}
}

function initializeGraph(
	graph: ChunkImportGraph,
	chunks: Record<string, Rollup.RenderedChunk>,
): void {
	const usedNames = new Set<string>()
	for (const [fileName, chunk] of Object.entries(chunks)) {
		let identity: string
		if (!/!~\{[^}]+\}~/.test(fileName)) {
			// 显式固定文件名没有 import-map 标识，也不占用 Rolldown 的公共 chunk 名称。
			identity = `file:${fileName}`
		} else if (chunk.facadeModuleId) {
			identity = `facade:${chunk.facadeModuleId}`
		} else if (!usedNames.has(chunk.name)) {
			identity = `name:${chunk.name}`
			usedNames.add(chunk.name)
		} else {
			// Rolldown 按渲染图顺序保留第一个同名 chunk，后续使用最小模块 ID。
			// 不能用「名称是否全局唯一」替代此规则，否则首次同名对象改变时签名不变。
			identity = `module:${[...chunk.moduleIds].sort()[0]}`
		}
		graph.set(fileName, {
			identity,
			imports: [...chunk.imports],
			dynamicImports: [...chunk.dynamicImports],
			cssCount: 0,
			isEmpty: false,
		})
	}
}

function collectStaticDependencies(
	graph: ChunkImportGraph,
	fileName: string,
	importer: string,
): DependencySignature[] {
	const visited = new Set<string>()
	const dependencies: DependencySignature[] = []
	const visit = (dependencyFileName: string): void => {
		if (dependencyFileName === importer || visited.has(dependencyFileName)) return
		visited.add(dependencyFileName)
		const dependency = graph.get(dependencyFileName)
		if (!dependency) return
		dependencies.push([dependency.identity, dependency.cssCount, dependency.isEmpty])
		// 预加载只跟随当前动态入口的静态依赖；下一层动态页面仍按需加载。
		// 不包含子模块内容哈希，保留仅修改内容时的 import-map 缓存收益。
		dependency.imports.forEach(visit)
	}
	visit(fileName)
	return dependencies
}

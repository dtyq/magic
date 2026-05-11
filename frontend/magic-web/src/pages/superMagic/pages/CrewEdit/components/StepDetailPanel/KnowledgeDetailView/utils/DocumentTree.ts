import type { ContentNode } from "@/pages/superMagic/pages/CrewEdit/components/StepDetailPanel/KnowledgeDetailView/types/content-node"
import { Knowledge } from "@/types/knowledge"

export class DocumentTree {
	private nodeMap: Map<number, ContentNode>

	constructor(private nodes: ContentNode[]) {
		// 构建ID映射提升查询性能
		this.nodeMap = new Map(nodes.map((n) => [n.id, n]))
	}

	/** 根据ID获取节点 */
	getNode(id: number): ContentNode | undefined {
		return this.nodeMap.get(id)
	}

	/** 获取子节点 */
	getChildren(id: number): ContentNode[] {
		const node = this.getNode(id)
		if (!node) return []
		return node.children.map((cid) => this.getNode(cid)).filter(Boolean) as ContentNode[]
	}

	/** 获取父节点 */
	getParent(id: number): ContentNode | undefined {
		const node = this.getNode(id)
		if (!node || node.parent === -1) return undefined
		return this.getNode(node.parent)
	}

	/** 获取根节点 */
	getRoot(): ContentNode | undefined {
		return this.nodes.find((n) => n.parent === -1)
	}

	/** 获取节点路径 */
	getPath(id: number): ContentNode[] {
		const path: ContentNode[] = []
		let current = this.getNode(id)

		while (current) {
			path.unshift(current)
			current = current.parent !== -1 ? this.getNode(current.parent) : undefined
		}

		return path
	}

	/** 获取所有标题节点 */
	getTitles(): ContentNode[] {
		return this.nodes.filter(
			(n) =>
				n.type === Knowledge.DocumentNodeType.SECTION_TITLE ||
				n.type === Knowledge.DocumentNodeType.TITLE,
		)
	}

	/** 深度优先遍历 */
	traverse(callback: (node: ContentNode, depth: number) => void, startId?: number) {
		const start = startId !== undefined ? this.getNode(startId) : this.getRoot()
		if (!start) return

		const dfs = (node: ContentNode, depth: number) => {
			callback(node, depth)
			this.getChildren(node.id).forEach((child) => dfs(child, depth + 1))
		}

		dfs(start, 0)
	}
}

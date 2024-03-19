import type { ElementNode } from "../types/index"

/**
 * 按绘制顺序排序元素（模拟 CSS Stacking Context 规则）
 *
 * 算法原理：
 * CSS 的层叠顺序由 Stacking Context（层叠上下文）树决定。
 * 对每个元素，构建从根到该元素的"层叠上下文路径"，
 * 然后通过字典序比较路径来确定元素的绘制顺序。
 *
 * 路径构建规则：
 * - 只在层叠上下文边界（z-index !== 0 的祖先）和元素自身处记录节点
 * - 每个节点记录 [zIndex, domOrder] 作为排序键
 * - 字典序比较：先比 zIndex（大的在上），再比 domOrder（后来居上）
 * - 路径更长的（更深后代）在上层
 *
 * 排序完成后，将排序索引写入每个节点的 paintOrder 属性，
 * 供后续 calculateZOrder 直接读取。
 */
export function sortByZOrder(nodes: ElementNode[]): ElementNode[] {
	// 缓存每个节点的层叠路径，避免排序时重复计算
	const pathCache = new Map<string, number[]>()

	const sorted = [...nodes].sort((a, b) => {
		const pathA = getOrComputePath(a, pathCache)
		const pathB = getOrComputePath(b, pathCache)
		return comparePaths(pathA, pathB)
	})

	// 将排序索引写入节点，供 calculateZOrder 使用
	for (let i = 0; i < sorted.length; i++) {
		sorted[i].paintOrder = i
	}

	return sorted
}

/**
 * 计算元素的绘制顺序值（用于 PPTNode.zOrder）
 * 依赖 sortByZOrder 预先计算的 paintOrder
 */
export function calculateZOrder(node: ElementNode): number {
	return node.paintOrder ?? 0
}

// ============================================================================
// 内部实现
// ============================================================================

/**
 * 获取或计算节点的层叠上下文路径（带缓存）
 *
 * 路径是一个展平的 number 数组：[z1, d1, z2, d2, ...]
 * 每对 (zIndex, domOrder) 代表路径中一个关键节点。
 *
 * 路径只包含：
 * 1. 创建了 stacking context 的祖先节点（zIndex !== 0）
 * 2. 元素自身
 *
 * 非 stacking context 的中间祖先被跳过，
 * 这样子元素可以"穿透"普通祖先，在正确的 stacking context 级别参与比较。
 */
function getOrComputePath(
	node: ElementNode,
	cache: Map<string, number[]>,
): number[] {
	const cached = cache.get(node.id)
	if (cached) return cached

	const path = buildStackingPath(node)
	cache.set(node.id, path)
	return path
}

/**
 * 构建从根到节点的层叠上下文路径
 */
function buildStackingPath(node: ElementNode): number[] {
	// 从节点向上收集关键祖先
	const entries: Array<{ zIndex: number; domOrder: number }> = []
	let current: ElementNode | null = node

	while (current) {
		// 记录：层叠上下文根（zIndex !== 0）或目标节点本身
		if (current === node || current.zIndex !== 0) {
			entries.push({ zIndex: current.zIndex, domOrder: current.domOrder })
		}
		current = current.parent
	}

	// 反转为从根到节点的顺序，然后展平为 [z1, d1, z2, d2, ...]
	entries.reverse()
	const path: number[] = []
	for (const entry of entries) {
		path.push(entry.zIndex, entry.domOrder)
	}
	return path
}

/**
 * 字典序比较两条路径
 *
 * 比较规则：
 * 1. 逐对比较 [zIndex, domOrder]
 * 2. zIndex 大的在上层（后绘制）
 * 3. zIndex 相同则 domOrder 大的在上层（后来居上）
 * 4. 前缀完全相同时，路径更长的在上层（子元素在父元素之上）
 */
function comparePaths(a: number[], b: number[]): number {
	const len = Math.min(a.length, b.length)
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) return a[i] - b[i]
	}
	// 路径更长的（更深的后代）在上面
	return a.length - b.length
}

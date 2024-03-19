import type { ShortcutDisplay } from "../types"
import { shortcutRegistry } from "../canvas/interaction/shortcuts/ShortcutRegistry"
import type { LayerElement } from "../canvas/types"
import type { Canvas } from "../canvas/Canvas"
import type { TreeNode } from "../components/ui/custom/Tree/types"
import type { LayerTreeData } from "../components/Layers/types"

// 格式化单个修饰键（向后兼容）
export function formatShortcut(mod: string) {
	switch (mod) {
		case "ctrl":
			return "⌃"
		case "shift":
			return "⇧"
		case "alt":
			return "⌥"
		case "meta":
			return "⌘"
		case "mod":
			// 根据平台返回对应的符号
			return shortcutRegistry.getPlatform() === "mac" ? "⌘" : "Ctrl"
	}
	return mod
}

/**
 * 格式化完整快捷键显示
 */
export function formatShortcutDisplay(shortcut: ShortcutDisplay): string {
	const platform = shortcutRegistry.getPlatform()
	const modifiers = shortcut.modifiers || []

	const symbols = modifiers.map((mod) => {
		if (mod === "mod") {
			return platform === "mac" ? "⌘" : "Ctrl"
		}
		if (mod === "shift") return platform === "mac" ? "⇧" : "Shift"
		if (mod === "alt") return platform === "mac" ? "⌥" : "Alt"
		return mod
	})

	const keyDisplay = shortcut.key.toUpperCase()
	return [...symbols, keyDisplay].join(platform === "mac" ? "" : "+")
}

/**
 * 根据快捷键 ID 获取格式化的显示文本
 */
export function getShortcutDisplay(shortcutId: string): ShortcutDisplay | null {
	const definition = shortcutRegistry.get(shortcutId)
	if (!definition) {
		return null
	}

	return {
		key: definition.key,
		modifiers: definition.modifiers,
	}
}

// 将 DSL 图层数据转换为 Tree 组件需要的格式
export function convertLayerToTreeNode(
	layer: LayerElement,
	canvas?: Canvas | null,
): TreeNode<LayerTreeData> {
	// 使用元素实例的 getRenderName() 方法获取默认名称
	let defaultName = ""
	if (canvas) {
		const element = canvas.elementManager.getElementInstance(layer.id)
		if (element) {
			defaultName = element.getRenderName()
		}
	}

	const label = layer.name || defaultName || ""
	const treeNode: TreeNode<LayerTreeData> = {
		id: layer.id,
		label,
		data: {
			...layer,
			visible: layer.visible,
			locked: layer.locked,
			type: layer.type,
		},
	}
	// 如果有子节点，先按 zIndex 降序排序再递归转换（zIndex 大的在上面）
	if ("children" in layer && layer.children && layer.children.length > 0) {
		const sortedChildren = [...layer.children].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
		treeNode.children = sortedChildren.map((child) => convertLayerToTreeNode(child, canvas))
	}
	return treeNode
}

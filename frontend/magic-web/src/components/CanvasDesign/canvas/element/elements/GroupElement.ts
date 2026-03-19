import Konva from "konva"
import type { GroupElement as GroupElementData } from "../../types"
import { BaseElement } from "../BaseElement"
import type { Canvas } from "../../Canvas"

/**
 * 组元素类
 * 注意: 子元素的渲染由 ElementManager 统一处理
 */
export class GroupElement extends BaseElement<GroupElementData> {
	constructor(data: GroupElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取组默认配置
	 */
	static getDefaultConfig() {
		return {}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("group.defaultName", "组")
	}

	render(): Konva.Group | null {
		const group = new Konva.Group()

		// 如果 Group 有尺寸，创建事件代理 hit 节点
		if (this.data.width && this.data.height) {
			this.createHitNode(group, this.data.width, this.data.height)
		}

		this.finalizeNode(group)
		// 子元素将由外部的 ElementManager 递归处理
		return group
	}

	update(newData: GroupElementData): boolean {
		this.data = newData

		// 组元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Group) {
			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新 hit 节点尺寸（如果存在）
			if (newData.width && newData.height) {
				const hitRect = this.node.findOne(".hit-area") as Konva.Rect | undefined
				if (hitRect) {
					hitRect.setAttrs({
						width: newData.width,
						height: newData.height,
					})
				} else {
					// 如果不存在，创建一个新的
					this.createHitNode(this.node, newData.width, newData.height)
				}
			}
		}

		return false
	}

	/**
	 * 重写 getData 方法，动态获取子元素的最新数据
	 * 确保返回的 children 数组包含子元素的最新状态（如 zIndex）
	 */
	getData(): GroupElementData {
		// 如果没有 children，直接返回原始数据
		if (!this.data.children) {
			return this.data
		}

		// 动态获取所有子元素的最新数据
		const updatedChildren = this.data.children
			.map((child) => {
				const latestData = this.canvas.elementManager.getElementData(child.id)
				return latestData || child // 如果找不到最新数据，使用原始数据
			})
			.filter((child) => child !== null) // 过滤掉已删除的子元素

		// 返回包含最新子元素数据的 Group 数据
		return {
			...this.data,
			children: updatedChildren,
		}
	}
}

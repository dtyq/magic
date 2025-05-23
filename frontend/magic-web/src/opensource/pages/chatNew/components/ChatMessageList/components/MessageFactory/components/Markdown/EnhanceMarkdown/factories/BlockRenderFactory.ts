import { LazyExoticComponent, ComponentType, lazy } from "react"
import { RenderComponent } from "../components/Code/types"
import { BlockRenderProps, Block } from "../components/Block/types"
import BaseRenderFactory from "./BaseRenderFactory"

const Fallback = lazy(() => import("../components/Block/components/Fallback"))

// 内容分块渲染工厂
class BlockRenderFactory extends BaseRenderFactory<BlockRenderProps> {
	/**
	 * 切割规则（正则）
	 */
	protected splitters = new Map<string, RegExp>()

	/**
	 * 组件缓存
	 */
	protected componentCache = new Map<
		string,
		LazyExoticComponent<ComponentType<BlockRenderProps>>
	>()

	/**
	 * 组件
	 */
	protected components = new Map<string, RenderComponent<BlockRenderProps>>()

	/**
	 * 构造函数
	 */
	constructor() {
		super()
	}

	/**
	 * 获取默认组件
	 * @returns 默认组件
	 */
	public getFallbackComponent(): LazyExoticComponent<ComponentType<BlockRenderProps>> {
		return Fallback
	}

	/**
	 * 注册block识别器
	 */
	registerSplitters(lang: string, blockRecognizer: RegExp) {
		this.splitters.set(lang, blockRecognizer)
	}

	/**
	 * 提取符合规则的block
	 */
	private extractBlocks(content: string) {
		const extractedBlocks = []

		// 遍历每个定义的匹配器
		for (const [lang, regex] of this.splitters) {
			let match
			// 重置正则表达式的lastIndex
			regex.lastIndex = 0

			// 对当前类型进行匹配
			while ((match = regex.exec(content)) !== null) {
				const fullMatch = match[0] // 完整匹配（包括```标记）
				const content = match[1]?.trim() // 移除标记的内容
				const position = match.index // 代码块在原文中的位置

				// 保存提取结果
				extractedBlocks[position] = {
					lang,
					content,
					position: position,
					length: fullMatch.length,
				}
			}
		}

		return extractedBlocks
	}

	/**
	 * 生成切割后的block
	 */
	public getBlocks(content: string | undefined) {
		if (!content) return []

		if (this.splitters.size === 0) {
			return [content]
		}

		const extractedBlocks = this.extractBlocks(content)
		// 分块
		const blocks: Block[] = []
		let lastIndex = 0

		extractedBlocks.forEach((value) => {
			// 在文本的最前面
			if (value.position === 0) {
				blocks.push({
					component: this.getComponent(value.lang),
					props: {
						language: value.lang,
						data: value.content,
					},
				})
			} else {
				blocks.push(content.substring(lastIndex, value.position))
				blocks.push({
					component: this.getComponent(value.lang),
					props: {
						language: value.lang,
						data: value.content,
					},
				})
				lastIndex = value.position + value.length
			}
		})

		// 最后一块
		if (lastIndex < content.length) {
			blocks.push(content.substring(lastIndex))
		}

		return blocks
	}
}
export default new BlockRenderFactory()

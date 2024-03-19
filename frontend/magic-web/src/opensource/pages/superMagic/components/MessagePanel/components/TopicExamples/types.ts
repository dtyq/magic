import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"

export interface ExampleItem {
	id: number
	title: {
		zh_CN: string
		en_US: string
	}
	content: {
		zh_CN: string | object
		en_US: string | object
	}
}

export interface TopicExamplesProps {
	/** 是否显示组件 */
	visible: boolean
	/** 话题模式 */
	topicMode: TopicMode
	/** 点击示例项时的回调函数 */
	onExampleSelect: (content: string | object) => void
	/** 自定义类名 */
	className?: string
}

export type TopicExamplesList = Partial<Record<TopicMode, ExampleItem[]>>

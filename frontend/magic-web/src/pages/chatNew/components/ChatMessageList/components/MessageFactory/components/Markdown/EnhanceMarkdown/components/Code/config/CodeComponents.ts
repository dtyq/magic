import type React from "react"
import { CodeRenderProps } from "../types"
import { CodeLanguage } from "../const"

/**
 * 代码渲染组件
 */
export interface CodeRenderComponent {
	componentType: CodeLanguage
	propsParser?: (props: CodeRenderProps) => unknown
	loader: () => Promise<{
		default:
			| React.ComponentType<CodeRenderProps>
			| React.MemoExoticComponent<React.ComponentType<CodeRenderProps>>
	}>
}

const codeComponents: Partial<Record<CodeLanguage, CodeRenderComponent>> = {
	[CodeLanguage.Mermaid]: {
		componentType: CodeLanguage.Mermaid,
		propsParser: (props) => {
			return {
				...props,
				language: props.language,
			}
		},
		loader: () => import("../components/Mermaid"),
	},
	[CodeLanguage.Markdown]: {
		componentType: CodeLanguage.Markdown,
		propsParser: (props) => {
			return {
				...props,
				content: props.data,
				language: props.language,
			}
		},
		loader: () => import("../components/Markdown"),
	},
}

export default codeComponents

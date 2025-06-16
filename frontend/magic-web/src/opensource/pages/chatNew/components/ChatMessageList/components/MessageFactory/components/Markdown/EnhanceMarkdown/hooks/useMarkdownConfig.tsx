import { useMemo } from "react"
import { omit } from "lodash-es"
import { A as a } from "../components/A"
import Code from "../components/Code"
import KaTeX from "../components/KaTeX"
import TableCell from "../components/Table/TableCell"
import TableWrapper from "../components/Table/TableWrapper"
import Video from "../components/Video"
import Blockquote from "../components/Blockquote"
import type { MarkdownProps } from "../types"
import { RuleType } from "markdown-to-jsx"
import type { MarkdownToJSX } from "markdown-to-jsx"
import { useMemoizedFn } from "ahooks"
import MagicCitation from "../components/MagicCitation"
import InlineCodeRenderFactory from "../factories/InlineCodeRenderFactory"
import PreprocessService from "../factories/PreprocessService"
import CustomComponentService from "../factories/CustomComponentService"
import ImageWrapper from "@/opensource/pages/chatNew/components/AiImageStartPage/components/ImageWrapper"

/**
 * 构建 markdown-to-jsx 组件所需的配置
 */
export const useMarkdownConfig = (props: MarkdownProps) => {
	// 解构需要的props
	const { allowHtml = true, enableLatex = true, components: componentsInProps } = props

	// 基础组件配置
	const baseOverrides = useMemo(() => {
		return {
			a: {
				component: a,
			},
			blockquote: {
				component: Blockquote,
			},
			table: {
				component: TableWrapper,
			},
			td: {
				component: (tdProps: any) => <TableCell {...tdProps} />,
			},
			th: {
				component: (thProps: any) => <TableCell isHeader {...thProps} />,
			},
			code: {
				component: (codeProps: any) => {
					return <Code markdownProps={omit(props, "content")} {...codeProps} />
				},
			},
			img: ImageWrapper,
			video: {
				component: Video,
			},
			// 添加 LaTeX 支持
			math: enableLatex
				? {
						component: (mathProps: { children: string }) => (
							<KaTeX math={mathProps.children} inline={false} />
						),
				  }
				: undefined,
			// 添加LaTeX组件支持
			MagicLatexInline: {
				component: (props: any) => {
					if (!enableLatex) return <span>{`$${props.math}$`}</span>

					// 解码HTML实体
					const decodedMath = props.math
						.replace(/&amp;/g, "&")
						.replace(/&quot;/g, '"')
						.replace(/&#39;/g, "'")
						.replace(/&lt;/g, "<")
						.replace(/&gt;/g, ">")

					return <KaTeX math={decodedMath} inline={true} />
				},
			},
			MagicLatexBlock: {
				component: (props: any) => {
					if (!enableLatex) return <div>{`$$${props.math}$$`}</div>

					// 解码HTML实体
					const decodedMath = props.math
						.replace(/&amp;/g, "&")
						.replace(/&quot;/g, '"')
						.replace(/&#39;/g, "'")
						.replace(/&lt;/g, "<")
						.replace(/&gt;/g, ">")

					return <KaTeX math={decodedMath} inline={false} />
				},
			},
			// 添加处理删除线的标签
			span: {
				component: (props: any) => {
					// 处理删除线 (GFM)
					if (props.className === "strikethrough") {
						return <del>{props.children}</del>
					}
					return <span {...props} />
				},
			},
			// 处理任务列表 (GFM)
			li: {
				component: (props: any) => {
					// 新的多级任务列表已经在预处理阶段生成了正确的HTML结构
					// 这里只需要保持原有的行为，让HTML直接渲染
					if (props.className === "task-list-item") {
						// 对于新的任务列表，直接返回li，不再添加额外的复选框
						// 因为复选框已经在预处理阶段的HTML中生成了
						return <li {...props} />
					}
					return <li {...props} />
				},
			},
			MagicCitation: {
				component: MagicCitation,
			},
			// 添加上标和下标支持
			sup: {
				component: (props: any) => <sup {...props} />,
			},
			sub: {
				component: (props: any) => <sub {...props} />,
			},
		}
	}, [props, enableLatex])

	// 合并自定义组件配置
	const customOverrides = useMemo(() => {
		if (!componentsInProps) return {}

		// 将 react-markdown 格式的 components 转换为 markdown-to-jsx 格式的 overrides
		const converted: Record<string, { component: any; props: Record<string, never> }> = {}
		Object.entries(componentsInProps).forEach(([tag, Component]) => {
			if (Component) {
				converted[tag] = {
					component: Component,
					props: {} as Record<string, never>,
				}
			}
		})

		return converted
	}, [componentsInProps])

	// 合并所有 overrides
	const overrides = useMemo(() => {
		return {
			...baseOverrides,
			...CustomComponentService.getAllComponents(),
			...customOverrides,
		} as MarkdownToJSX.Overrides
	}, [baseOverrides, customOverrides])

	// 自定义的 markdown-to-jsx 预处理函数
	const preprocess = useMemoizedFn((markdown: string) => {
		if (!markdown) return []

		return PreprocessService.preprocess(markdown, {
			enableLatex,
		})
	})

	// 配置 markdown-to-jsx options
	const options = useMemo<MarkdownToJSX.Options>(() => {
		return {
			overrides,
			forceWrapper: true,
			disableParsingRawHTML: !allowHtml,
			// 使用更新的API方式配置预处理函数
			renderRule: (next: () => any, node: any) => {
				if (node.type === RuleType.codeInline) {
					const InlineCodeComponent = InlineCodeRenderFactory.getComponent(node.className)
					return <InlineCodeComponent className={node.className} data={node.text} />
				}

				return next()
			},
		}
	}, [overrides, allowHtml])

	return {
		options,
		preprocess,
	}
}

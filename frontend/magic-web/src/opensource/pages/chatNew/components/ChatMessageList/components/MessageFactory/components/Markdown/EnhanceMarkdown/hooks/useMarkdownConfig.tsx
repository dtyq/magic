import { useMemo } from "react"
import { omit } from "lodash-es"
import type { Options as MarkdownOptions } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"

import defaultRemarkPlugins from "../remarkPlugins"
import { A as a } from "../components/A"
import Code from "../components/Code"
import Pre from "../components/Pre"
import Sup from "../components/Sup"
import TableCell from "../components/Table/TableCell"
import TableWrapper from "../components/Table/TableWrapper"
import type { MarkdownProps } from "../types"

/**
 * 构建markdown组件所需的各种插件和组件
 */
export const useMarkdownConfig = (props: MarkdownProps) => {
	// 解构需要的props
	const {
		allowHtml = true,
		enableLatex = true,
		rehypePlugins: rehypePluginsInProps,
		remarkPlugins: remarkPluginsInProps,
		components: componentsInProps,
	} = props

	// 配置rehype插件
	const rehypePlugins = useMemo(
		() =>
			[
				allowHtml && rehypeRaw,
				allowHtml && rehypeSanitize,
				enableLatex && rehypeKatex,
				...(rehypePluginsInProps ?? []),
			].filter(Boolean) as any,
		[allowHtml, rehypePluginsInProps, enableLatex],
	)

	// 配置remark插件
	const remarkPlugins = useMemo(
		() => [...defaultRemarkPlugins, ...(remarkPluginsInProps ?? [])],
		[remarkPluginsInProps],
	)

	// 基础组件配置
	const baseComponents = useMemo<MarkdownOptions["components"]>(() => {
		return {
			pre: Pre,
			a,
			table: TableWrapper,
			td: (tdProps) => <TableCell {...tdProps} />,
			th: (thProps) => <TableCell isHeader {...thProps} />,
			code: (codeProps) => {
				return <Code markdownProps={omit(props, "content")} {...codeProps} />
			},
			sup: Sup,
		}
	}, [props])

	// 合并自定义组件
	const components = useMemo(
		() => ({ ...baseComponents, ...componentsInProps }),
		[baseComponents, componentsInProps],
	)

	return {
		rehypePlugins,
		remarkPlugins,
		components,
	}
}

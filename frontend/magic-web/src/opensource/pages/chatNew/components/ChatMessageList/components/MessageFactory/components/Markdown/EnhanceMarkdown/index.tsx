import Markdown from "react-markdown"
import { memo, useMemo, useRef } from "react"
import { nanoid } from "nanoid"
import MessageRenderProvider from "@/opensource/components/business/MessageRenderProvider"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import { useStyles as useMarkdownStyles } from "./styles/markdown.style"
import type { MarkdownProps } from "./types"
import { useMarkdownConfig, useClassName } from "./hooks"
import { useUpdateEffect } from "ahooks"
import { cx } from "antd-style"
import { useTyping } from "@/opensource/hooks/useTyping"

/**
 * EnhanceMarkdown - 增强的Markdown渲染器
 * 支持流式渲染、代码高亮、数学公式等功能
 */
const EnhanceMarkdown = memo(
	function EnhanceMarkdown(props: MarkdownProps) {
		const {
			content,
			allowHtml = true,
			enableLatex = true,
			className,
			isSelf,
			isStreaming = false,
			hiddenDetail = false,
			...otherProps
		} = props

		const { fontSize } = useFontSize()
		const classNameRef = useRef<string>(`markdown-${nanoid(10)}`)

		// 使用样式hooks
		const { styles: mdStyles } = useMarkdownStyles(
			useMemo(
				() => ({ fontSize: hiddenDetail ? 12 : fontSize, isSelf, hiddenDetail }),
				[fontSize, isSelf, hiddenDetail],
			),
		)

		// 使用Markdown配置hook
		const markdownConfig = useMarkdownConfig({
			...props,
			allowHtml: allowHtml && !hiddenDetail,
			enableLatex,
		})

		const { content: typedContent, typing, add, start, done } = useTyping(content as string)

		const lastContentRef = useRef(content ?? "")

		useUpdateEffect(() => {
			if (content) {
				add(content.substring(lastContentRef.current.length))
				lastContentRef.current = content
				if (!typing) {
					start()
				}
			}
		}, [content])

		useUpdateEffect(() => {
			if (!isStreaming) {
				done()
			}
		}, [isStreaming])

		// 使用类名处理hook
		const combinedClassName = useClassName({
			mdStyles,
			className: className || "",
			classNameRef,
		})

		// // 切割内容，分离oss-file文件
		// const blocks = useMemo(() => {
		// 	return BlockRenderFactory.getBlocks(content || "")
		// }, [content])

		// 如果没有内容则不渲染
		if (!typedContent) return null

		return (
			<MessageRenderProvider hiddenDetail={hiddenDetail}>
				<Markdown
					className={cx(combinedClassName, "markdown-content")}
					rehypePlugins={markdownConfig.rehypePlugins}
					remarkPlugins={markdownConfig.remarkPlugins}
					components={markdownConfig.components}
					{...otherProps}
				>
					{content as string}
				</Markdown>
			</MessageRenderProvider>
		)
	},
	(prevProps, nextProps) => {
		return (
			prevProps.content === nextProps.content &&
			prevProps.isStreaming === nextProps.isStreaming
		)
	},
)

export default EnhanceMarkdown

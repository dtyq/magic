import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconBrain, IconChevronUp } from "@tabler/icons-react"
import { useUpdateEffect } from "ahooks"
import { Flex } from "antd"
import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./useStyles"
import EnhanceMarkdown from "../EnhanceMarkdown"

/**
 * 推理内容
 * @param content 推理内容
 * @returns 推理内容
 */
const ReasoningContent = ({
	content,
	isStreaming = false,
	className,
}: {
	content?: string
	isStreaming?: boolean
	className?: string
}) => {
	const { t } = useTranslation("interface")
	const [isCollapse, setIsCollapse] = useState(!isStreaming)
	const { styles, cx } = useStyles()
	const contentRef = useRef<HTMLDivElement>(null)
	const [contentVisible, setContentVisible] = useState(false)

	// 设置内容高度变量
	useEffect(() => {
		if (!isCollapse && contentRef.current) {
			const height = contentRef.current.scrollHeight
			contentRef.current.style.setProperty("--content-max-height", `${height}px`)

			// 使用 double requestAnimationFrame 代替固定延迟
			let raf2: number
			const raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => {
					setContentVisible(true)
				})
			})

			return () => {
				cancelAnimationFrame(raf1)
				if (raf2) cancelAnimationFrame(raf2)
			}
		}
		setContentVisible(false)
		return undefined
	}, [isCollapse, content])

	useUpdateEffect(() => {
		if (!isStreaming && !isCollapse) {
			setIsCollapse(true)
		}
	}, [isStreaming])

	if (!content) return null

	// 折叠状态：只渲染按钮
	if (isCollapse) {
		return (
			<div className={cx(styles.buttonWrapper, className)}>
				<Flex
					className={styles.collapseTitle}
					align="center"
					gap={2}
					onClick={() => setIsCollapse(false)}
				>
					<MagicIcon component={IconBrain} color="currentColor" size={14} />
					{t("chat.message.thought_process")}
					<MagicIcon
						component={IconChevronUp}
						size={14}
						color="currentColor"
						style={{
							transform: "rotate(180deg)",
							transition: "transform 0.3s ease-in-out",
						}}
					/>
				</Flex>
			</div>
		)
	}

	// 展开状态：渲染按钮和内容
	return (
		<div className={cx(styles.expandedWrapper, className)}>
			<Flex
				className={styles.collapseTitle}
				align="center"
				gap={2}
				onClick={() => setIsCollapse(true)}
			>
				<MagicIcon component={IconBrain} color="currentColor" size={14} />
				{t("chat.message.thought_process")}
				<MagicIcon
					component={IconChevronUp}
					size={14}
					color="currentColor"
					style={{
						transform: "rotate(0deg)",
						transition: "transform 0.3s ease-in-out",
					}}
				/>
			</Flex>
			<div
				ref={contentRef}
				className={cx(styles.contentContainer, contentVisible && "visible")}
			>
				<EnhanceMarkdown
					content={content}
					className={styles.markdown}
					isStreaming={isStreaming}
					allowHtml={false}
				/>
			</div>
		</div>
	)
}

export default ReasoningContent

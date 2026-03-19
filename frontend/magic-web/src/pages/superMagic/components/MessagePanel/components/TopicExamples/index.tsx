import { useEffect, useRef, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { IconRefresh } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useStyles } from "./styles"
import type { ExampleItem, TopicExamplesProps } from "./types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { SupportLocales } from "@/constants/locale"
import { Collapse } from "antd"
import { Editor } from "@tiptap/core"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text as TiptapText } from "@tiptap/extension-text"
import { HardBlock } from "@/pages/superMagic/components/MessageEditor/extensions"
import MentionExtension from "@/components/business/MentionPanel/tiptap-plugin"
import { SuperPlaceholderExtension } from "@/pages/superMagic/components/MessageEditor/extensions/super-placeholder"
import SummaryExampleIcon1 from "./icons/recording-summary-1.webp"
import SummaryExampleIcon2 from "./icons/recording-summary-2.webp"
import SummaryExampleIcon3 from "./icons/recording-summary-3.webp"
import SummaryGuide, { SummaryGuideType } from "./SummaryGuide"
import { useTopicExamples } from "./hooks/useTopicExamples"

const TopicExamples = ({
	visible = true,
	topicMode,
	onExampleSelect,
	className,
}: TopicExamplesProps) => {
	const { styles, cx } = useStyles()
	const { i18n, t } = useTranslation("super")
	const lastValidExampleList = useRef<ExampleItem[]>([])
	const isExiting = useRef(false)

	// Use custom hook for data fetching and random selection
	const { exampleList, refreshExamples, rotationCount } = useTopicExamples({
		topicMode,
		count: 5,
		enabled: visible,
	})

	// Summary指引状态
	const [summaryGuideType, setSummaryGuideType] = useState<SummaryGuideType | null>(null)

	// 选择话题案例，触发回调
	const handleSetExampleContent = useMemoizedFn((content: string | object) => {
		onExampleSelect?.(content)
	})

	const handleRefreshClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
		e.preventDefault()
		refreshExamples()
	})

	const getExampleContent = (content: string | object) => {
		if (typeof content === "string") {
			return content
		}

		let editor: Editor | null = null
		try {
			editor = new Editor({
				content: content,
				extensions: [
					Document,
					Paragraph,
					TiptapText,
					HardBlock,
					MentionExtension,
					SuperPlaceholderExtension,
				],
			})
			const contentText = editor.getText()
			return contentText
		} catch (error) {
			console.error("Error parsing content with Editor:", error)
			return "内容解析失败"
		} finally {
			// 清理 Editor 实例
			if (editor) {
				editor.destroy()
			}
		}
	}

	// 优先响应 visible 属性，避免内容清空但容器还在的问题
	const shouldShow = visible
		? exampleList.length > 0 || topicMode === TopicMode.RecordSummary
		: isExiting.current
	const displayExampleList = exampleList.length > 0 ? exampleList : lastValidExampleList.current

	const handleSummaryGuide = useMemoizedFn((type: SummaryGuideType) => {
		setSummaryGuideType(type)
	})

	const handleSummaryGuideClose = useMemoizedFn(() => {
		setSummaryGuideType(null)
	})

	const ExampleList = useMemo(() => {
		if (topicMode === TopicMode.RecordSummary) {
			return (
				<div className={styles.summaryExampleList}>
					<motion.div
						className={cx(styles.summaryExampleItem, styles.summaryExampleItem1)}
						initial={{ opacity: 0, y: 15, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{
							duration: 0.3,
							delay: 0.2 + 1 * 0.04,
							ease: [0.16, 1, 0.3, 1],
						}}
						onClick={() => {
							handleSummaryGuide(SummaryGuideType.StartRecording)
						}}
					>
						<div className={styles.summaryExampleItemContent}>
							<SmartTooltip className={styles.summaryExampleItemTitle}>
								{t("guide.summaryGuide.enableRealTimeRecording")}
							</SmartTooltip>
							<SmartTooltip
								maxLines={3}
								className={styles.summaryExampleItemDescription}
							>
								{t("guide.summaryGuide.realTimeRecordingDescription")}
							</SmartTooltip>
						</div>
						<img
							src={SummaryExampleIcon1}
							alt=""
							className={styles.summaryExampleItemIcon}
							draggable={false}
						/>
					</motion.div>
					<motion.div
						className={cx(styles.summaryExampleItem, styles.summaryExampleItem2)}
						initial={{ opacity: 0, y: 15, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{
							duration: 0.3,
							delay: 0.2 + 2 * 0.04,
							ease: [0.16, 1, 0.3, 1],
						}}
						onClick={() => {
							handleSummaryGuide(SummaryGuideType.UploadVideoFile)
						}}
					>
						<div className={styles.summaryExampleItemContent}>
							<SmartTooltip className={styles.summaryExampleItemTitle}>
								{t("guide.summaryGuide.uploadAudioToSummary")}
							</SmartTooltip>
							<SmartTooltip
								maxLines={3}
								className={styles.summaryExampleItemDescription}
							>
								{t("guide.summaryGuide.uploadAudioDescription")}
							</SmartTooltip>
						</div>
						<img
							src={SummaryExampleIcon2}
							alt=""
							className={styles.summaryExampleItemIcon}
							draggable={false}
						/>
					</motion.div>
					<motion.div
						className={cx(styles.summaryExampleItem, styles.summaryExampleItem3)}
						initial={{ opacity: 0, y: 15, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{
							duration: 0.3,
							delay: 0.2 + 3 * 0.04,
							ease: [0.16, 1, 0.3, 1],
						}}
						onClick={() => {
							handleSummaryGuide(SummaryGuideType.EditPrompt)
						}}
					>
						<div className={styles.summaryExampleItemContent}>
							<SmartTooltip className={styles.summaryExampleItemTitle}>
								{t("guide.summaryGuide.summaryWithDocumentAndAudio")}
							</SmartTooltip>
							<SmartTooltip
								maxLines={3}
								className={styles.summaryExampleItemDescription}
							>
								{t("guide.summaryGuide.uploadDocumentAndAudioDescription")}
							</SmartTooltip>
						</div>
						<img
							src={SummaryExampleIcon3}
							alt=""
							className={styles.summaryExampleItemIcon}
							draggable={false}
						/>
					</motion.div>
				</div>
			)
		}
		return (
			<div className={styles.exampleList}>
				{displayExampleList.slice(0, 5).map((item, index) => (
					<motion.div
						key={index}
						initial={{ opacity: 0, y: 15, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{
							duration: 0.3,
							delay: 0.2 + index * 0.04,
							ease: [0.16, 1, 0.3, 1],
						}}
						className={styles.exampleItem}
						onClick={() =>
							handleSetExampleContent(
								item.content[
								i18n.language as SupportLocales.zhCN | SupportLocales.enUS
								],
							)
						}
					>
						<SmartTooltip className={styles.exampleItemTitle}>
							{item.title[i18n.language as keyof typeof item.title]}
						</SmartTooltip>
						<div className={styles.exampleItemContent}>
							{getExampleContent(
								item.content[
								i18n.language as SupportLocales.zhCN | SupportLocales.enUS
								],
							)}
						</div>
					</motion.div>
				))}
			</div>
		)
	}, [
		topicMode,
		styles.exampleList,
		styles.summaryExampleList,
		styles.summaryExampleItem,
		styles.summaryExampleItem1,
		styles.summaryExampleItemContent,
		styles.summaryExampleItemTitle,
		styles.summaryExampleItemDescription,
		styles.summaryExampleItemIcon,
		styles.summaryExampleItem2,
		styles.summaryExampleItem3,
		styles.exampleItem,
		styles.exampleItemTitle,
		styles.exampleItemContent,
		displayExampleList,
		cx,
		t,
		handleSummaryGuide,
		i18n.language,
		handleSetExampleContent,
	])

	const items = useMemo(() => {
		return [
			{
				key: "1",
				label: (
					<div className={styles.exampleHeader}>
						<div>{t("ui.quickStart")}</div>
						{topicMode !== TopicMode.RecordSummary && (
							<div className={styles.exampleItemRefresh} onClick={handleRefreshClick}>
								<IconRefresh
									size={20}
									style={{
										transform: `rotate(${rotationCount * 360}deg)`,
										transition: "transform 0.5s ease-in-out",
									}}
								/>
							</div>
						)}
					</div>
				),
				children: ExampleList,
			},
		]
	}, [
		styles.exampleHeader,
		styles.exampleItemRefresh,
		t,
		topicMode,
		rotationCount,
		ExampleList,
		handleRefreshClick,
	])

	// 保存有效的 exampleList，用于退出动画期间显示
	useEffect(() => {
		if (exampleList.length > 0) {
			lastValidExampleList.current = exampleList
			isExiting.current = false
		}
	}, [exampleList])

	// 监听 visible 变化，管理退出状态
	useEffect(() => {
		if (!visible && lastValidExampleList.current.length > 0) {
			isExiting.current = true
		}
	}, [visible])

	return (
		<>
			<AnimatePresence mode="popLayout">
				{shouldShow && (
					<motion.div
						key="topic-examples"
						initial={{
							opacity: 0,
							clipPath: "inset(0 0 100% 0)",
							y: -10,
						}}
						animate={{
							opacity: 1,
							clipPath: "inset(0 0 0% 0)",
							y: 0,
						}}
						exit={{
							opacity: 0,
							clipPath: "inset(0 0 100% 0)",
							y: -10,
						}}
						transition={{
							duration: 0.35,
							ease: [0.16, 1, 0.3, 1],
							clipPath: {
								duration: 0.35,
								ease: [0.16, 1, 0.3, 1],
							},
						}}
						onAnimationComplete={() => {
							if (!visible) {
								isExiting.current = false
							}
						}}
						className={cx(styles.exampleContainer, className)}
					>
						<Collapse
							className={styles.exampleCollapse}
							defaultActiveKey={["1"]}
							ghost
							items={items}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Summary模式新人指引 */}
			<SummaryGuide
				type={summaryGuideType}
				onClose={handleSummaryGuideClose}
				onFinish={handleSummaryGuideClose}
			/>
		</>
	)
}

export default TopicExamples

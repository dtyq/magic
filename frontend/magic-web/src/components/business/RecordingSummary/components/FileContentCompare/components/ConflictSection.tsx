import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconAlertTriangle, IconCircleCheck, IconSparkles } from "@tabler/icons-react"
import type { ConflictInfo } from "../utils/diff"
import { useStyles } from "../styles"
import MagicIcon from "@/components/base/MagicIcon"
import MagicSelect from "@/components/base/MagicSelect"
import { ConflictResolution } from "../types"
import { Input } from "antd"

interface ConflictSectionProps {
	/** 冲突信息 */
	conflict: ConflictInfo
	/** 项目编号（全局索引） */
	itemNumber: number
	/** 总项目数（冲突 + 变更） */
	totalItems: number
	/** 当前版本的行号 */
	currentLinesNumbers: number[]
	/** 服务器版本的行号 */
	serverLinesNumbers: number[]
	/** 当前选择（current/server/custom/null） */
	selection: ConflictResolution | undefined
	/** 自定义内容 */
	customContent: string
	/** 是否已通过推荐解决 */
	resolved?: boolean
	/** 是否由 AI 解决 */
	resolvedByAI?: boolean
	/** 冲突操作回调 */
	onSelectCurrent: () => void
	onSelectServer: () => void
	onStartEdit: () => string
	onSaveEdit: (content: string) => void
	showRecommendation?: boolean
	scrollToNextUnresolved: (trigger: { type: "conflict" | "change"; id: string }) => void
}

/**
 * 冲突区域组件
 * 显示单个冲突的内容和操作按钮
 */
function ConflictSection({
	conflict,
	itemNumber,
	totalItems,
	currentLinesNumbers,
	serverLinesNumbers,
	selection,
	customContent,
	resolved: _resolved = false,
	resolvedByAI: _resolvedByAI = false,
	onSelectCurrent,
	onSelectServer,
	onStartEdit,
	onSaveEdit,
	showRecommendation = false,
	scrollToNextUnresolved,
}: ConflictSectionProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const [isEditing, setIsEditing] = useState(false)
	const [editContent, setEditContent] = useState(customContent)

	const handleEdit = (content?: string) => {
		setIsEditing(true)
		setEditContent(content || customContent)
	}

	const handleBlur = () => {
		setIsEditing(false)
		onSaveEdit(editContent)
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleBlur()
		}
		// esc 键退出编辑
		else if (e.key === "Escape") {
			e.preventDefault()
			setEditContent(customContent)
			setIsEditing(false)
		}
		// shift+enter 换行
		else if (e.key === "Enter" && e.shiftKey) {
			e.preventDefault()
			setEditContent((prev) => prev + "\n")
		}
	}

	const conflictIncompleteText = t("recordingSummary.fileChangeModal.conflictIncomplete")

	const handleSelect = (value: ConflictResolution) => {
		switch (value) {
			case ConflictResolution.CURRENT:
				onSelectCurrent()
				scrollToNextUnresolved({ type: "conflict", id: conflict.id })
				break
			case ConflictResolution.SERVER:
				onSelectServer()
				scrollToNextUnresolved({ type: "conflict", id: conflict.id })
				break
			case ConflictResolution.CUSTOM:
				const customContent = onStartEdit()
				handleEdit(customContent)
				break
			default:
				break
		}
	}

	// 未解决 - 显示两个版本和操作按钮
	const result: JSX.Element[] = []

	// 冲突头部和推荐
	const isAIRecommendation = conflict.recommendationSource === "ai"
	result.push(
		<div className={styles.conflictHeader}>
			<div
				key={`conflict-header-${conflict.id}`}
				className={cx(styles.conflictMarker, styles.marker, {
					[styles.conflictMarkerResolved]: Boolean(selection),
				})}
			>
				<MagicIcon
					component={selection ? IconCircleCheck : IconAlertTriangle}
					color="currentColor"
					size={14}
				/>
				{selection
					? t("recordingSummary.fileChangeModal.conflictResolved")
					: t("recordingSummary.fileChangeModal.conflictUnresolved")}{" "}
				{itemNumber}/{totalItems} {conflict.incomplete ? `(${conflictIncompleteText})` : ""}
				{showRecommendation && conflict.recommendation && (
					<span
						className={
							isAIRecommendation
								? styles.recommendationBadgeAI
								: styles.recommendationBadge
						}
					>
						<IconSparkles size={12} />
						{t("recordingSummary.fileChangeModal.recommended")}:{" "}
						{conflict.recommendation === "current"
							? t("recordingSummary.fileChangeModal.useCurrent")
							: t("recordingSummary.fileChangeModal.useServer")}{" "}
						- {conflict.recommendationReason}
					</span>
				)}
			</div>
			<MagicSelect
				size="small"
				className={styles.conflictSelect}
				options={[
					{
						label: t("recordingSummary.fileChangeModal.useCurrent"),
						value: ConflictResolution.CURRENT,
					},
					{
						label: t("recordingSummary.fileChangeModal.useServer"),
						value: ConflictResolution.SERVER,
					},
					{
						label: t("recordingSummary.fileChangeModal.selectMerge"),
						value: ConflictResolution.CUSTOM,
					},
				]}
				placeholder={t("recordingSummary.fileChangeModal.placeholder")}
				value={selection}
				onChange={(value) => handleSelect(value as ConflictResolution)}
			/>
		</div>,
	)

	// 如果已解决，显示解决后的内容
	if (selection) {
		let resolvedLines: string[] = []
		let resolvedNumbers: number[] = []

		const isCustom = selection === "custom"

		if (selection === "current") {
			resolvedLines = conflict.currentLines
			resolvedNumbers = currentLinesNumbers
		} else if (selection === "server") {
			resolvedLines = conflict.serverLines
			resolvedNumbers = serverLinesNumbers
		} else if (isCustom) {
			// 自定义内容使用第一个当前行号作为起始
			const startNum = currentLinesNumbers[0] || 1
			resolvedLines = customContent.split("\n")
			resolvedNumbers = resolvedLines.map((_, idx) => startNum + idx)
		}

		if (isEditing) {
			result.push(
				<Input.TextArea
					className={styles.conflictEditTextarea}
					value={editContent}
					autoFocus
					onChange={(e) => setEditContent(e.target.value)}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					style={{ height: resolvedLines.length * 20 }}
				/>,
			)
		} else {
			// 显示已解决的内容
			resolvedLines.forEach((resolvedLine, lineIdx) => {
				const resolvedNumber = resolvedNumbers[lineIdx]
				result.push(
					<div
						key={`resolved-${conflict.id}-${lineIdx}`}
						className={styles.codeLineWithNumber}
					>
						<div className={styles.inlineLineNumber} data-line-number={resolvedNumber}>
							{resolvedNumber ?? ""}
						</div>
						<div
							className={`${styles.diffLine} ${styles.conflictResolved} ${styles.inlineCodeContent}`}
							onClick={() => isCustom && handleEdit()}
						>
							{resolvedLine}
						</div>
					</div>,
				)
			})
		}

		return <>{result}</>
	}

	// 显示当前版本
	conflict.currentLines.forEach((conflictLine, lineIdx) => {
		const lineNumberValue = currentLinesNumbers[lineIdx]
		const isLastLine = lineIdx === conflict.currentLines.length - 1
		result.push(
			<div
				key={`conflict-current-${conflict.id}-${lineIdx}`}
				className={styles.codeLineWithNumber}
			>
				<div className={styles.inlineLineNumber} data-line-number={lineNumberValue}>
					{lineNumberValue ?? ""}
				</div>
				<div className={`${styles.diffLine} ${styles.deleted} ${styles.inlineCodeContent}`}>
					{conflictLine}
					{isLastLine && (
						<span className={`${styles.versionLabel} ${styles.currentVersionLabel}`}>
							{t("recordingSummary.fileChangeModal.currentVersion")}
						</span>
					)}
				</div>
			</div>,
		)
	})

	// 显示服务器版本
	conflict.serverLines.forEach((conflictLine, lineIdx) => {
		const lineNumberValue = serverLinesNumbers[lineIdx]
		const isLastLine = lineIdx === conflict.serverLines.length - 1
		result.push(
			<div
				key={`conflict-server-${conflict.id}-${lineIdx}`}
				className={styles.codeLineWithNumber}
			>
				<div className={styles.inlineLineNumber} data-line-number={lineNumberValue}>
					{lineNumberValue ?? ""}
				</div>
				<div className={`${styles.diffLine} ${styles.added} ${styles.inlineCodeContent}`}>
					{conflictLine}
					{isLastLine && (
						<span className={`${styles.versionLabel} ${styles.serverVersionLabel}`}>
							{t("recordingSummary.fileChangeModal.serverVersion")}
						</span>
					)}
				</div>
			</div>,
		)
	})
	return <>{result}</>
}

export default memo(ConflictSection)

import { Search as SearchIcon } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
// import BrowserHeader from "../../components/BrowserHeader"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import SearchBody, { SearchGroup } from "./components/SearchBody"
import SearchGroupTabs from "./components/SearchGroupTabs"
import { useStyles } from "./styles"

interface SearchProps {
	data: { groups?: SearchGroup[] }
	userSelectDetail: any
	isFromNode: boolean
	setUserSelectDetail: (detail: any) => void
	onClose: () => void
	// Props from Render component
	type?: string
	currentIndex?: number
	totalFiles?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	hasUserSelectDetail?: boolean
	isFullscreen?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	isFavorited?: boolean
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	allowEdit?: boolean
}

export default memo(function Search(props: SearchProps) {
	const {
		data = {},
		isFromNode,
		// Props from Render component
		type,
		onFullscreen,
		onDownload,
		isFullscreen,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		// File sharing props
		currentFile,
		className,
		allowEdit,
	} = props

	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const { groups = [] } = data

	// Use state to track the selected keyword
	const [selectedKeyword, setSelectedKeyword] = useState<string>(groups?.[0]?.keyword || "")
	// 回放切到另一批结果时，查询栏、Tab 和正文必须回退到同一组，不能各自保留旧选择。
	const currentGroup = groups.find((group) => group.keyword === selectedKeyword) || groups[0]
	const currentKeyword = currentGroup?.keyword || ""

	// Update selected keyword when groups change
	useEffect(() => {
		setSelectedKeyword(currentKeyword)
	}, [currentKeyword])

	return (
		<div className={cx(styles.searchContainer, className)}>
			<div className={styles.queryArea}>
				{currentGroup && (
					<div
						className={styles.query}
						role="group"
						aria-label={t("search.queryReadOnly")}
					>
						<span className={styles.queryIcon} aria-hidden>
							<SearchIcon size={16} />
						</span>
						<span className={styles.queryText}>
							{currentGroup.query?.trim() || t("search.queryUnavailable")}
						</span>
					</div>
				)}
				{groups.length === 1 && (
					<span className={styles.resultCount}>
						{t("search.resultCount", { count: groups[0].results.length })}
					</span>
				)}
				<div className={styles.headerActions}>
					<CommonHeaderV2
						renderMode="actions"
						type={type}
						onFullscreen={onFullscreen}
						onDownload={onDownload}
						isFromNode={isFromNode}
						isFullscreen={isFullscreen}
						// Pass new props for ActionButtons functionality
						viewMode={viewMode}
						onViewModeChange={onViewModeChange}
						onCopy={onCopy}
						fileContent={fileContent || currentKeyword}
						// File sharing props
						currentFile={currentFile}
						allowEdit={allowEdit}
					/>
				</div>
			</div>
			<SearchGroupTabs
				groups={groups}
				value={currentKeyword}
				onValueChange={setSelectedKeyword}
			>
				{/* 切换组时重新挂载结果区，重置滚动及摘要展开；同组重渲染保持阅读位置。 */}
				<SearchBody key={currentKeyword} currentGroup={currentGroup} />
			</SearchGroupTabs>
		</div>
	)
})

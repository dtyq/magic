import { Flex, Tooltip } from "antd"
import { memo, useMemo, useState } from "react"
// import BrowserHeader from "../../components/BrowserHeader"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import SearchBody, { SearchGroup } from "./components/SearchBody"
import { useStyles } from "./styles"

interface SearchProps {
	data: any
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

	const { groups = [] } = data

	// Use state to track the selected keyword
	const [selectedKeyword, setSelectedKeyword] = useState<string>(groups?.[0]?.keyword || "")

	// Update selected keyword when groups change
	useMemo(() => {
		if (groups.length > 0 && !selectedKeyword) {
			setSelectedKeyword(groups[0].keyword)
		}
	}, [groups, selectedKeyword])

	const SuffixComponent = useMemo(() => {
		// Show all available keywords as suffixes
		const showGroups = groups.slice(0, 5)
		return (
			<Flex gap={4} className={styles.suffixContainer}>
				{showGroups.map((group: SearchGroup) => {
					const isSelected = group.keyword === selectedKeyword
					return (
						<Tooltip title={group.keyword} key={group.keyword}>
							<div
								className={`${styles.suffix} ${
									isSelected ? styles.suffixSelected : styles.suffixDefault
								}`}
								onClick={(e) => {
									e.stopPropagation()
									setSelectedKeyword(group.keyword)
								}}
								style={{ cursor: "pointer" }}
							>
								{group.keyword}
							</div>
						</Tooltip>
					)
				})}
			</Flex>
		)
	}, [
		groups,
		selectedKeyword,
		styles.suffix,
		styles.suffixContainer,
		styles.suffixSelected,
		styles.suffixDefault,
	])

	const headerActionConfig = useMemo(
		() => ({
			customActions: [
				{
					key: "search-keyword-tabs",
					zone: "primary" as const,
					render: () => SuffixComponent,
				},
			],
		}),
		[SuffixComponent],
	)

	return (
		<div className={cx(styles.searchContainer, className)}>
			<CommonHeaderV2
				type={type}
				onFullscreen={onFullscreen}
				onDownload={onDownload}
				isFromNode={isFromNode}
				isFullscreen={isFullscreen}
				// Pass new props for ActionButtons functionality
				viewMode={viewMode}
				onViewModeChange={onViewModeChange}
				onCopy={onCopy}
				fileContent={fileContent || selectedKeyword}
				// File sharing props
				currentFile={currentFile}
				allowEdit={allowEdit}
				actionConfig={headerActionConfig}
			/>
			<SearchBody keyword={selectedKeyword} groups={groups} />
		</div>
	)
})

import { memo, useMemo, useState } from "react"
import { useStyles } from "./styles"
import ToolCard from "../../ToolCard"
import SearchBody from "@/pages/superMagic/components/Detail/contents/Search/components/SearchBody"
import type { SearchGroup } from "@/pages/superMagic/components/Detail/contents/Search/components/SearchBody"
import type { BaseToolProps } from "../../../types"
import ToolContainer from "../../ToolContainer"
import { Flex, Tooltip } from "antd"
import ToolDetailContainer from "../../ToolDetail/ToolDetailContainer"
import ToolIcon from "../../ToolIcon"
import { cx } from "antd-style"
import { useCollapse } from "../hooks/useCollapse"

interface WebSearchToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: {
			groups: Array<SearchGroup>
		}
	}
}

export default memo(function WebSearchTool({
	identifier,
	action,
	detail,
	remark,
}: WebSearchToolProps) {
	const { styles } = useStyles()

	const { collapsed, setCollapsed, DropdownIcon, collapseCardClassName, expandedCardClassName } =
		useCollapse()

	const groups = detail?.data?.groups || []

	// Use state to track the selected keyword for suffix interaction
	const [selectedKeyword, setSelectedKeyword] = useState<string>(groups?.[0]?.keyword || "")

	// Update selected keyword when groups change
	useMemo(() => {
		if (groups.length > 0 && !selectedKeyword) {
			setSelectedKeyword(groups[0].keyword)
		}
	}, [groups, selectedKeyword])

	const SuffixComponent = useMemo(() => {
		const showGroups = groups.slice(0, 2)
		return (
			<Flex gap={4} className={styles.suffixContainer}>
				{showGroups.map((group: SearchGroup) => {
					const isSelected = group.keyword === selectedKeyword
					return (
						<Tooltip title={group.keyword} key={group.keyword}>
							<div
								className={`${styles.suffix} ${isSelected ? styles.suffixSelected : styles.suffixDefault
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
				{groups.length > 2 && (
					<div className={cx(styles.suffix, styles.suffixMore)}>+{groups.length - 2}</div>
				)}
			</Flex>
		)
	}, [
		groups,
		selectedKeyword,
		styles.suffix,
		styles.suffixContainer,
		styles.suffixMore,
		styles.suffixSelected,
		styles.suffixDefault,
	])

	// 如果折叠，只显示 ToolCard 带 suffix
	if (collapsed) {
		return (
			<ToolContainer>
				<ToolCard
					identifier={identifier}
					action={action}
					remark={SuffixComponent}
					showRemark
					suffix={DropdownIcon}
					cardClassName={collapseCardClassName}
				/>
			</ToolContainer>
		)
	}

	// 展开状态显示完整内容
	return (
		<ToolContainer withDetail>
			<ToolCard
				identifier={identifier}
				action={action}
				remark={remark}
				showRemark={false}
				suffix={DropdownIcon}
				cardClassName={expandedCardClassName}
			/>
			<ToolDetailContainer
				title={action}
				icon={<ToolIcon type={identifier} />}
				suffix={SuffixComponent}
				showTitle={false}
			>
				<SearchBody keyword={selectedKeyword} groups={groups} />
			</ToolDetailContainer>
		</ToolContainer>
	)
})

import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import ToolCard from "../../ToolCard"
import type { BaseToolProps } from "../../../types"
import ToolContainer from "../../ToolContainer"
import ToolDetailContainer from "../../ToolDetail/ToolDetailContainer"
import { useCollapse } from "../hooks/useCollapse"
import McpInitToolContent from "./components/McpInitToolContent"
import { McpInitToolDetail, ServerResult } from "./components/McpInitToolContent/types"
import { Flex, Tooltip } from "antd"

interface McpInitToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: McpInitToolDetail
	}
}

export default memo(function McpInitTool({ identifier, detail }: McpInitToolProps) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()

	const { collapsed, DropdownIcon, collapseCardClassName, expandedCardClassName } = useCollapse()

	const groups = detail?.data?.server_results || []

	const SuffixComponent = useMemo(() => {
		const showGroups = groups.slice(0, 1)
		return (
			<Flex gap={4} className={styles.suffixContainer}>
				{showGroups.map((group: ServerResult) => {
					return (
						<Tooltip title={group.name} key={group.name}>
							<div className={styles.suffix} style={{ cursor: "pointer" }}>
								{group?.label_name || group.name}
							</div>
						</Tooltip>
					)
				})}
				{groups.length > 1 && (
					<div className={cx(styles.suffix, styles.suffixMore)}>+{groups.length - 1}</div>
				)}
			</Flex>
		)
	}, [groups, styles.suffixContainer, styles.suffix, styles.suffixMore, cx])

	// 如果折叠，只显示 ToolCard 带 suffix
	if (collapsed) {
		return (
			<ToolContainer>
				<ToolCard
					identifier={identifier}
					action={t("tool.initPlugin")}
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
		<ToolContainer withDetail className={styles.mcpInitToolContainer}>
			<ToolCard
				identifier={identifier}
				action={t("tool.initPlugin")}
				showRemark={false}
				suffix={DropdownIcon}
				cardClassName={expandedCardClassName}
			/>
			<ToolDetailContainer showHeader={false} contentClassName={styles.mcpInitToolContent}>
				{detail?.data && <McpInitToolContent detail={detail.data} />}
			</ToolDetailContainer>
		</ToolContainer>
	)
})

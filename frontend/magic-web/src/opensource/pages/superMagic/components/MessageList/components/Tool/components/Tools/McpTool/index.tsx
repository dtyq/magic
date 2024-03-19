import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import ToolCard from "../../ToolCard"
import type { BaseToolProps } from "../../../types"
import ToolContainer from "../../ToolContainer"
import ToolDetailContainer from "../../ToolDetail/ToolDetailContainer"
import ToolIcon from "../../ToolIcon"
import { useCollapse } from "../hooks/useCollapse"
import McpToolContent from "./components/McpToolContent"
import { McpToolDetail } from "./components/McpToolContent/types"
import { IconCheck, IconX } from "@tabler/icons-react"

interface McpToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: McpToolDetail
	}
}

export default memo(function McpTool({ identifier, detail, remark }: McpToolProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	const { collapsed, setCollapsed, DropdownIcon, collapseCardClassName, expandedCardClassName } =
		useCollapse()

	const mcpName =
		detail?.data?.tool_definition?.label_name || detail?.data?.tool_definition?.original_name

	const HeaderIcon =
		detail?.data?.execution_result?.status === "success" ? (
			<IconCheck size={18} className={styles.successIcon} />
		) : (
			<IconX size={18} className={styles.errorIcon} />
		)

	// 如果折叠，只显示 ToolCard 带 suffix
	if (collapsed) {
		return (
			<ToolContainer>
				<ToolCard
					identifier={identifier}
					action={t("tool.callTool")}
					remark={mcpName}
					showRemark
					suffix={DropdownIcon}
					cardClassName={collapseCardClassName}
				/>
			</ToolContainer>
		)
	}

	// 展开状态显示完整内容
	return (
		<ToolContainer withDetail className={styles.mcpToolContainer}>
			<ToolCard
				identifier={identifier}
				action={t("tool.callTool")}
				remark={mcpName}
				showRemark={false}
				suffix={DropdownIcon}
				cardClassName={expandedCardClassName}
			/>
			<ToolDetailContainer
				title={mcpName}
				icon={HeaderIcon}
				contentClassName={styles.mcpToolContent}
			>
				{detail?.data && <McpToolContent detail={detail.data} />}
			</ToolDetailContainer>
		</ToolContainer>
	)
})

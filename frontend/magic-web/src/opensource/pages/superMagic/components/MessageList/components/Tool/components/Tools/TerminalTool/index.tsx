import { memo, useState } from "react"
import ToolCard from "../../ToolCard"
import ToolContainer from "../../ToolContainer"
import type { BaseToolProps } from "../../../types"
import TerminalDisplay from "../../../../../../Detail/contents/Terminal/components/TerminalDisplay"
import { useStyles } from "./styles"
import { useCollapse } from "../hooks/useCollapse"

interface TerminalToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: {
			output?: string
			command?: string
			exit_code?: number
		}
	}
}

function TerminalTool(props: TerminalToolProps) {
	const { styles } = useStyles()
	const { collapsed, setCollapsed, DropdownIcon, collapseCardClassName, expandedCardClassName } =
		useCollapse()

	// 如果折叠，只显示 ToolCard 带 suffix
	if (collapsed) {
		return (
			<ToolContainer>
				<ToolCard
					{...props}
					showRemark
					remark={props.remark}
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
				{...props}
				showRemark={false}
				remark={props.remark}
				suffix={DropdownIcon}
				cardClassName={expandedCardClassName}
			/>
			<TerminalDisplay
				command={props.detail?.data?.command || ""}
				output={props.detail?.data?.output || ""}
				exitCode={props.detail?.data?.exit_code || 0}
				className={styles.terminal}
			/>
		</ToolContainer>
	)
}

export default memo(TerminalTool)

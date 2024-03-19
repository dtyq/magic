import { Flex } from "antd"
import { memo, useMemo } from "react"
import { Flow } from "@/opensource/types/flow"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconCheck } from "@tabler/icons-react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useTranslation } from "react-i18next"
import useStyles from "./style"
import type { MCPSelectedItem } from "../../../types"
import { useMCPPanel } from "../context/MCPPanelProvider"
import DefaultMCPAvatar from "@/opensource/assets/logos/mcp.png"
import { createHighlightSegments } from "@/opensource/pages/flow/utils/helpers"

interface ToolAddableCardProps {
	mcp: Flow.Mcp.Detail
	lineCount?: number
	fontSize14?: boolean
	textGap4?: boolean
	height?: number
	onClick?: (id: string) => void
	selectedMCPs?: MCPSelectedItem[]
}

const MCPAddableCard = memo(
	({
		mcp,
		textGap4 = false,
		lineCount = 1,
		fontSize14 = false,
		height = 40,
		onClick,
		selectedMCPs,
		...props
	}: ToolAddableCardProps) => {
		const { t } = useTranslation()
		const { currentNode } = useCurrentNode()

		const { id: code, name: title, description } = mcp

		const { keyword, onAddMCP } = useMCPPanel()

		const { styles, cx } = useStyles()

		const titleList = useMemo(() => {
			return createHighlightSegments(title, keyword)
		}, [title, keyword])

		const descList = useMemo(() => {
			return createHighlightSegments(description, keyword)
		}, [description, keyword])

		const isDisabled = useMemo(() => {
			const isNodeSelectedMCP = !!currentNode?.params?.mcp_list?.find?.(
				(v: MCPSelectedItem) => v?.id === mcp?.id,
			)
			const isSelectedMCP = !!selectedMCPs?.find?.((v: MCPSelectedItem) => v?.id === mcp?.id)

			return isNodeSelectedMCP || isSelectedMCP
		}, [currentNode?.params?.mcp_list, mcp?.id, selectedMCPs])

		return (
			<Flex
				vertical
				className={cx(styles.container)}
				onClick={(e) => {
					e.stopPropagation()
					onClick?.(code ?? "")
				}}
				{...props}
			>
				<Flex
					gap={10}
					style={{ minHeight: height }}
					align={height === 40 ? "center" : "flex-start"}
				>
					<img src={mcp.icon || DefaultMCPAvatar} style={{ width: 40, height: 40 }} />
					<Flex vertical gap={textGap4 ? 4 : 8} flex={1}>
						<Flex
							gap={6}
							className={cx(styles.title, { [styles.title14]: fontSize14 })}
							align="center"
						>
							<div>
								{titleList.map((titleItem, index) => {
									return (
										<span
											key={`title-${index}-${titleItem.type}`}
											className={cx({
												[styles.highlight]: titleItem.type === "highlight",
											})}
										>
											{titleItem.value}
										</span>
									)
								})}
							</div>
						</Flex>

						<div
							className={cx(styles.description, {
								[styles.lineClamp2]: lineCount === 2,
							})}
						>
							{descList.map((descItem, index) => {
								return (
									<span
										key={`desc-${index}-${descItem.type}`}
										className={cx({
											[styles.highlight]: descItem.type === "highlight",
										})}
									>
										{descItem.value}
									</span>
								)
							})}
						</div>
					</Flex>
					{!isDisabled && (
						<MagicButton
							type="default"
							onClick={() => {
								onAddMCP({
									id: mcp.id,
									icon: mcp.icon,
									type: mcp.type,
									description: mcp.description,
								})
							}}
							disabled={isDisabled}
							className={styles.enableBtn}
						>
							{t("common.enable", { ns: "flow" })}
						</MagicButton>
					)}
					{isDisabled && (
						<div className={styles.checkBtn}>
							<IconCheck size={20} color="#315CEC" />
						</div>
					)}
				</Flex>
			</Flex>
		)
	},
)

export default MCPAddableCard

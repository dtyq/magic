import { useFlowStore } from "@/opensource/stores/flow"
import type { FormInstance, FormListFieldData } from "antd"
import { Tooltip, Flex } from "antd"
import { useMemo } from "react"
import DefaultMCPAvatar from "@/opensource/assets/logos/mcp.png"
import { useTranslation } from "react-i18next"
import type { MCPSelectedItem } from "../../types"
import { useStyles } from "./style"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconCircleMinus } from "@tabler/icons-react"

type MCPSelectedCardProps = {
	mcp: MCPSelectedItem
	field: FormListFieldData
	removeFn: (index: number) => void
	form: FormInstance<any>
	index: number
}
export default function MCPSelectedCard({ mcp, field, removeFn }: MCPSelectedCardProps) {
	const { t } = useTranslation()
	const { useableMCPs } = useFlowStore()
	const { styles, cx } = useStyles()

	const targetDetail = useMemo(() => {
		return useableMCPs.find((useableMcp) => useableMcp.id === mcp.id)
	}, [useableMCPs, mcp.id])

	const defaultText = useMemo(() => {
		return t("common.invalidMCP", { ns: "flow" })
	}, [t])

	return (
		<Flex className={styles.toolsSelectedCard} align="center" justify="space-between">
			<Flex>
				<img
					src={targetDetail?.icon || DefaultMCPAvatar}
					alt=""
					className={styles.avatar}
				/>
			</Flex>
			<Flex vertical gap={2} flex={1}>
				<Flex
					className={cx(styles.title, { [styles.danger]: !targetDetail })}
					align="center"
					gap={6}
				>
					<Tooltip title={targetDetail?.name || defaultText} placement="topLeft">
						{targetDetail?.name || defaultText}
					</Tooltip>
				</Flex>
				{targetDetail?.description && (
					<Tooltip title={targetDetail?.description} placement="topLeft">
						<div className={styles.desc}>{targetDetail?.description}</div>
					</Tooltip>
				)}
			</Flex>
			<Flex align="center" gap={4} className={styles.deleteBtn}>
				<MagicIcon
					component={IconCircleMinus}
					onClick={(e) => {
						e.stopPropagation()
						removeFn(field.name)
					}}
					stroke={2}
					color="#1C1D2399"
				/>
			</Flex>
		</Flex>
	)
}

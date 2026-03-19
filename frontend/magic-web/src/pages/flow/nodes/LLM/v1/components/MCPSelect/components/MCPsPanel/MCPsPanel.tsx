import MagicModal from "@/components/base/MagicModal"
import { Avatar, Flex, Spin } from "antd"
import SearchInput from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/SearchInput"
import MCPsEmptyImage from "@/assets/logos/mcp.png"
import { useTranslation } from "react-i18next"
import type { MCPSelectedItem } from "../../types"
import useMCPsPanel from "./hooks/useMCPsPanel"
import React, { Suspense } from "react"
import { useStyles } from "./style"
import { MCPPanelProvider } from "./context/MCPPanelProvider"

// use React.lazy to dynamically import MCPList component
const MCPList = React.lazy(() => import("./components/MCPList"))

type MCPsPanelModalProps = {
	open: boolean
	onClose: () => void
	onAddMCP: (MCP: MCPSelectedItem) => void
	selectedMCPs?: MCPSelectedItem[]
}

export default function MCPsPanel({ open, onAddMCP, onClose, selectedMCPs }: MCPsPanelModalProps) {
	const { filteredUseableMCPs, keyword, setKeyword } = useMCPsPanel({ open })
	const { t } = useTranslation()
	const { styles } = useStyles()

	return (
		<MagicModal
			title={t("common.addMCPs", { ns: "flow" })}
			open={open}
			onCancel={onClose}
			maskClosable={false}
			width={800}
			footer={null}
			wrapClassName={styles.modalWrap}
		>
			<MCPPanelProvider keyword={keyword} onAddMCP={onAddMCP}>
				<Flex className={styles.header} justify="space-between">
					<SearchInput
						placeholder={t("common.search", { ns: "flow" })}
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
					/>
				</Flex>
				{filteredUseableMCPs.length > 0 && (
					<Suspense
						fallback={
							<Flex justify="center" style={{ padding: "20px" }}>
								<Spin />
							</Flex>
						}
					>
						<MCPList
							filteredUseableMCPs={filteredUseableMCPs}
							selectedMCPs={selectedMCPs}
						/>
					</Suspense>
				)}
				{filteredUseableMCPs.length === 0 && (
					<Flex vertical gap={4} align="center" justify="center" flex={1}>
						<Avatar src={MCPsEmptyImage} size={80} />
						<div className={styles.emptyTips}>{t("common.noMCPs", { ns: "flow" })}</div>
					</Flex>
				)}
			</MCPPanelProvider>
		</MagicModal>
	)
}

import type { FormInstance } from "antd"
import { Form, Flex } from "antd"
import TSIcon from "@/opensource/components/base/TSIcon"
import { useTranslation } from "react-i18next"
import useFormListRemove from "@/opensource/pages/flow/common/hooks/useFormListRemove"
import { useStyles } from "./style"
import useMCPPanel from "./hooks/useMCPPanelVisible"
import MCPPanel from "./components/MCPsPanel/MCPsPanel"
import MCPSelectedCard from "./components/MCPSelectedCard/MCPSelectedCard"
import { MCPSelectedItem } from "./types"

type MCPSelectProps = {
	form: FormInstance<any>
}

export default function MCPSelect({ form }: MCPSelectProps) {
	const { styles } = useStyles()
	const { removeFormListItem } = useFormListRemove()

	const { t } = useTranslation()
	// const { updateNodeConfig } = useFlow()
	const { openMCPPanel, isMCPPanelOpen, closeMCPPanel } = useMCPPanel()

	return (
		<Form.Item className={styles.toolsSelect} label={t("common.mcp", { ns: "flow" })}>
			<Form.List name="mcp_list">
				{(fields, { add }) => {
					return (
						<Flex className={styles.toolsWrap} vertical gap={6} justify="center">
							<Flex vertical gap={6} justify="center">
								{fields.map((field, i) => {
									const mcp = form.getFieldValue([
										"mcp_list",
										i,
									]) as MCPSelectedItem

									return (
										<MCPSelectedCard
											key={field.key}
											mcp={mcp}
											field={field}
											removeFn={(index) =>
												removeFormListItem(
													form,
													["mcp_list"],
													Number(index),
												)
											}
											form={form}
											index={i}
										/>
									)
								})}
							</Flex>
							<Flex
								className={styles.addToolBtn}
								justify="center"
								align="center"
								gap={4}
								onClick={() => {
									// add()
									openMCPPanel()
								}}
							>
								<TSIcon type="ts-add" />
								{t("common.addMCPs", { ns: "flow" })}
							</Flex>
							<MCPPanel
								open={isMCPPanelOpen}
								onClose={closeMCPPanel}
								onAddMCP={async (mcp) => {
									add(mcp)
								}}
							/>
						</Flex>
					)
				}}
			</Form.List>
		</Form.Item>
	)
}

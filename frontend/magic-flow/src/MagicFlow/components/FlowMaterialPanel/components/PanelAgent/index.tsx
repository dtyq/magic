import { prefix } from "@/MagicFlow/constants"
import { useMaterialSource } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { MagicFlow } from "@/MagicFlow/types/flow"
import { Empty, Select } from "antd"
import { IconCaretDownFilled } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import { usePanel } from "../../context/PanelContext/usePanel"
import MaterialItem from "../PanelMaterial/MaterialItem"
import usePanelAgent from "./hooks/usePanelAgent"
import styles from "./index.module.less"

export default function PanelAgent() {
	const { t } = useTranslation()
	const { agent } = useMaterialSource()

	const { schema, options } = usePanelAgent()

	const { agentType, setAgentType } = usePanel()

	return (
		<div className={clsx(styles.panelAgent, `${prefix}panel-agent`)}>
			<Select
				options={options}
				popupClassName={clsx(styles.select, `${prefix}panel-select`)}
				suffixIcon={<IconCaretDownFilled />}
				value={agentType}
				onChange={setAgentType}
			/>
			<div className={clsx(styles.panelAgentList, `${prefix}panel-agent-list`)}>
				{schema &&
					agent?.list?.map?.((flow: Partial<MagicFlow.Flow>) => {
						return (
							<MaterialItem
								{...schema}
								label={flow.name || ""}
								key={flow.id}
								desc={flow.description || ""}
								params={{ sub_flow_id: flow.id }}
								output={flow.output}
								input={flow.input}
								avatar={flow.icon}
							/>
						)
					})}
				{(agent?.list || []).length === 0 && (
					<Empty description={i18next.t("flow.withoutAgentTips", { ns: "magicFlow" })} />
				)}
			</div>
		</div>
	)
}

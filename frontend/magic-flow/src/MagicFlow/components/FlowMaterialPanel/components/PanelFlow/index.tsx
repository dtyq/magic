import { prefix } from "@/MagicFlow/constants"
import { useMaterialSource } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { MagicFlow } from "@/MagicFlow/types/flow"
import { Empty } from "antd"
import clsx from "clsx"
import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import MaterialItem from "../PanelMaterial/MaterialItem"
import usePanelFlow from "./hooks/usePanelFlow"
import styles from "./index.module.less"

export default function PanelFlow() {
	const { t } = useTranslation()
	const { subFlow } = useMaterialSource()

	const { schema } = usePanelFlow()

	return (
		<div className={clsx(styles.panelFlow, `${prefix}panel-flow`)}>
			<div className={clsx(styles.panelFlowList, `${prefix}panel-flow-list`)}>
				{schema &&
					subFlow?.list?.map?.((flow: Partial<MagicFlow.Flow>) => {
						return (
							<MaterialItem
								{...schema}
								key={flow.id}
								label={flow.name || ""}
								desc={flow.description || ""}
								params={{ sub_flow_id: flow.id }}
								output={flow.output}
								input={flow.input}
								avatar={flow.icon}
							/>
						)
					})}
				{(subFlow?.list || []).length === 0 && (
					<Empty description={i18next.t("flow.withoutFlowTips", { ns: "magicFlow" })} />
				)}
			</div>
		</div>
	)
}

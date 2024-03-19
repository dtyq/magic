import { prefix } from "@/MagicFlow/constants"
import { useMaterialSource } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { Empty } from "antd"
import clsx from "clsx"
import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import MaterialItem from "../PanelMaterial/MaterialItem"
import SubGroup from "../PanelMaterial/components/SubGroup/SubGroup"
import usePanelTools from "./hooks/usePanelTools"
import styles from "./index.module.less"

export default function PanelTools() {
	const { t } = useTranslation()
	const { tools } = useMaterialSource()

	const { schema, getGroupListByToolSetId } = usePanelTools()

	return (
		<div className={clsx(styles.panelTools, `${prefix}panel-tools`)}>
			<div className={clsx(styles.panelToolsList, `${prefix}panel-tool-list`)}>
				{schema &&
					(tools?.groupList || []).map((nodeGroup, subGroupIndex) => {
						const getGroupNodeList = () => {
							return getGroupListByToolSetId(nodeGroup.id)
						}

						return (
							<SubGroup
								subGroup={nodeGroup}
								// @ts-ignore
								getGroupNodeList={getGroupNodeList}
								key={`sub-group-${subGroupIndex}`}
								materialFn={(n, extraProps) => (
									<MaterialItem {...n.schema} {...extraProps} />
								)}
							/>
						)
					})}
				{(tools?.groupList || []).length === 0 && (
					<Empty description={i18next.t("flow.withoutToolsTips", { ns: "magicFlow" })} />
				)}
			</div>
		</div>
	)
}

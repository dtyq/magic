import { Dropdown, Tooltip } from "antd"
import { IconCirclePlus } from "@tabler/icons-react"
import i18next from "i18next"
import React, { ReactElement, useContext } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react"
import { useExportFields } from "../../../context/ExportFieldsContext/useExportFields"
import { SchemaMobxContext } from "../../.."
import { useGlobal } from "../../../context/GlobalContext/useGlobal"

interface DropPlusProp {
	prefix: string[]
	name: string
}

const DropPlus = observer((props: DropPlusProp): ReactElement => {
	const { t } = useTranslation()
	const { prefix, name } = props

	const context = useContext(SchemaMobxContext)

	const { exportFields } = useExportFields()
	const { relativeAppendPosition } = useGlobal()

	return (
		<Tooltip placement="top" title={i18next.t("jsonSchema.addField", { ns: "magicFlow" })}>
			<Dropdown
				menu={{
					items: [
						{
							label: (
								<span className="add-sibling">
									{i18next.t("jsonSchema.addSiblingField", { ns: "magicFlow" })}
								</span>
							),
							key: "sibling_node",
							onClick: (e) => {
								e?.domEvent?.stopPropagation?.()
								context.addField({
									keys: prefix,
									name,
									position: relativeAppendPosition,
								})
								exportFields.addField({
									keys: prefix,
									name,
									position: relativeAppendPosition,
								})
							},
						},
						{
							label: (
								<span className="add-child">
									{i18next.t("jsonSchema.addSubField", { ns: "magicFlow" })}
								</span>
							),
							key: "child_node",
							onClick: (e) => {
								e?.domEvent?.stopPropagation?.()
								context.setOpenValue({
									key: prefix.concat(name, "properties"),
									value: true,
								})
								context.addChildField({
									keys: prefix.concat(name, "properties"),
								})

								exportFields.setOpenValue({
									key: prefix.concat(name, "properties"),
									value: true,
								})
								exportFields.addChildField({
									keys: prefix.concat(name, "properties"),
								})
							},
						},
					],
				}}
			>
				<IconCirclePlus stroke={1} size={20} color="#315CEC" />
			</Dropdown>
		</Tooltip>
	)
})

export default DropPlus

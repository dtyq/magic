import { SchemaMobxContext } from "@/MagicJsonSchemaEditor"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import MagicInput from "@/common/BaseUI/Input"
import { Cascader, Form, Modal, Select, Tooltip, message } from "antd"
import { IconFileImport } from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import i18next from "i18next"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type IconImportProps = {
	onImport: (value: Schema) => boolean
}

export enum ImportType {
	/** 替换式 */
	Replace = 1,
	/** 插入式 */
	Insert = 2,
	/** 追加式 */
	Push = 3,
}

export default function IconImport({ onImport }: IconImportProps) {
	const { t } = useTranslation()
	const schemaMobx = useContext(SchemaMobxContext)
	const [form] = Form.useForm()
	const [open, setOpen] = useState(false)

	const [formData, setFormData] = useState({})

	const onOk = useMemoizedFn(() => {
		const success = onImport(form.getFieldsValue())
		if (success) {
			setOpen(false)
			return
		}
		message.warning(i18next.t("jsonSchema.invalidValue", { ns: "magicFlow" }))
	})

	useUpdateEffect(() => {
		if (open) {
			form.resetFields()
			setFormData({})
		}
	}, [open])

	const initialValues = useMemo(() => {
		return {
			type: ImportType.Push,
			content: "",
		}
	}, [])

	const formValues = form.getFieldsValue()

	const onValuesChange = useMemoizedFn((changeValues) => {
		setFormData({
			...formData,
			...changeValues,
		})
	})

	const fieldOptions = useMemo(() => {
		const options = [] as any[]

		const genKeyOptions = (schema: Schema, parentOption?: any) => {
			Object.entries(schema.properties || {}).forEach(([key, subSchema]) => {
				const option = {
					label: key,
					value: key,
					children: [],
				}
				if (parentOption) {
					parentOption.children.push(option)
				} else {
					options.push(option)
				}
				genKeyOptions(subSchema, option)
			})
		}

		genKeyOptions(schemaMobx.schema)

		return options
	}, [schemaMobx.schema])

	return (
		<>
			<Tooltip title={i18next.t("common.import", { ns: "magicFlow" })}>
				<span
					className="add-icon"
					onClick={() => {
						setOpen(true)
					}}
				>
					<IconFileImport size={16} stroke={1} color="#FF7D00" />
				</span>
			</Tooltip>

			<Modal
				title={i18next.t("common.import", { ns: "magicFlow" })}
				open={open}
				onCancel={() => setOpen(false)}
				onOk={onOk}
				okText={i18next.t("common.confirm", { ns: "magicFlow" })}
				cancelText={i18next.t("common.cancel", { ns: "magicFlow" })}
			>
				<Form
					form={form}
					initialValues={initialValues}
					layout="vertical"
					onValuesChange={onValuesChange}
				>
					<Form.Item
						name="type"
						label={i18next.t("jsonSchema.importMethod", { ns: "magicFlow" })}
					>
						<Select
							placeholder={i18next.t("jsonSchema.importMethodPlaceholder", {
								ns: "magicFlow",
							})}
							options={[
								{
									label: i18next.t("jsonSchema.importFromTail", {
										ns: "magicFlow",
									}),
									value: ImportType.Push,
								},
								{
									label: i18next.t("jsonSchema.importReplace", {
										ns: "magicFlow",
									}),
									value: ImportType.Replace,
								},
								{
									label: i18next.t("jsonSchema.importInsert", {
										ns: "magicFlow",
									}),
									value: ImportType.Insert,
								},
							]}
						></Select>
					</Form.Item>
					{formValues.type === ImportType.Insert && (
						<Form.Item
							name="fieldKeys"
							label={i18next.t("jsonSchema.selectField", { ns: "magicFlow" })}
						>
							<Cascader
								placeholder={i18next.t("jsonSchema.selectField", {
									ns: "magicFlow",
								})}
								options={fieldOptions}
								changeOnSelect
								multiple={false}
							></Cascader>
						</Form.Item>
					)}
					<Form.Item
						name="content"
						label={i18next.t("jsonSchema.importContent", { ns: "magicFlow" })}
					>
						<MagicInput.TextArea
							style={{ minHeight: "138px" }}
							placeholder={i18next.t("jsonSchema.importContentPlaceholder", {
								ns: "magicFlow",
							})}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</>
	)
}

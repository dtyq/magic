import { useState } from "react"
import { cloneDeep } from "lodash-es"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import { Form } from "antd"
import { useTranslation } from "react-i18next"
import TSIcon from "@dtyq/magic-flow/dist/common/BaseUI/TSIcon"

import type { ConditionContainerProps } from "./types"
import "./index.less"
import { addCondition, getNotSupportedFilterColumns } from "./helpers"
import ConditionItem from "./ConditionItem"

const ConditionContainer = ({
	value = [],
	onChange,
	addButtonText,
	isEnableDel = false,
	isSupportRowId = true, // 过滤条件是否支持默认行ID
	columns,
	sheetId,
	dataTemplate,
}: ConditionContainerProps) => {
	const { t } = useTranslation()
	const [notSupportedFilterColumns] = useState(() => getNotSupportedFilterColumns())
	const [form] = Form.useForm()

	const handleAdd = useMemoizedFn((addFn) => {
		const condition = addCondition(dataTemplate, sheetId, notSupportedFilterColumns)
		addFn(condition)
	})

	useMount(() => {
		if (value?.length === 0) {
			const condition = addCondition(dataTemplate, sheetId, notSupportedFilterColumns)
			if (condition) onChange?.([condition])
		}
	})

	const handleValueChange = useMemoizedFn((_changedValues, allValues) => {
		if (!form) return
		const formData = cloneDeep(allValues.conditions)
		onChange?.(formData)
	})

	const setFormData = useMemoizedFn((formData) => {
		form.setFieldsValue({ conditions: formData })
	})

	useUpdateEffect(() => {
		setFormData(value)
	}, [value])

	return (
		<div className="magic-condition-container">
			<Form
				form={form}
				initialValues={{ conditions: value }}
				onValuesChange={handleValueChange}
				preserve={false}
			>
				<Form.List name="conditions">
					{(fields, { add, remove }) => {
						return (
							<>
								{fields.map((field) => {
									return (
										<Form.Item {...field} key={field.key}>
											<ConditionItem
												handleDel={() => {
													remove(field.name)
												}}
												isEnableDel={isEnableDel || value.length > 0}
												columns={columns}
												sheetId={sheetId}
												dataTemplate={dataTemplate}
												isSupportRowId={isSupportRowId}
											/>
										</Form.Item>
									)
								})}
								<div
									className="add-condition"
									onClick={() => {
										handleAdd(add)
									}}
								>
									<TSIcon type="ts-add" />
									{addButtonText || t("common.addConditions", { ns: "flow" })}
								</div>
							</>
						)
					}}
				</Form.List>
			</Form>
		</div>
	)
}

export default ConditionContainer

import { checkIsReferenceNode } from "@/MagicExpressionWidget/helpers"
import { EXPRESSION_ITEM, WithReference } from "@/MagicExpressionWidget/types"
import { getColor } from "@/MagicExpressionWidget/utils"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import React, { useState } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import useDeleteReferenceNode from "../../hooks/useDeleteReferenceNode"
import MultipleItem from "../LabelMultiple/MultipleSelect/components/MultipleItem/MultipleItem"
import { MultipleOption } from "../LabelMultiple/types"
import { LabelNode } from "../LabelNode/LabelNode"
import "./index.less"

interface LabelDepartmentNamesProps {
	config: EXPRESSION_ITEM
	updateFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export type Department = {
	id: string
	name: string
}

export default function LabelDepartmentNames({
	config,
	updateFn,
	wrapperWidth,
}: LabelDepartmentNamesProps) {
	const [departmentNames, setDepartmentNames] = useState(
		config.department_names_value as WithReference<Department>[],
	)

	useUpdateEffect(() => {
		setDepartmentNames(config?.department_names_value)
	}, [config?.department_names_value])

	const { datasetProps } = useDatasetProps({ config })

	const onDeleteCurrentItem = useMemoizedFn((department: Department) => {
		const index = departmentNames.findIndex((d) => d.id === department.id)
		if (index === -1) return
		departmentNames.splice(index, 1)
		setDepartmentNames([...departmentNames])
		updateFn({
			...config,
			department_names_value: departmentNames,
		})
	})

	const { onDeleteReferenceNode } = useDeleteReferenceNode({
		values: departmentNames,
		setValues: setDepartmentNames,
		config,
		updateFn,
		valueName: "department_names_value",
	})

	return (
		<div className="magic-label-department-names" {...datasetProps}>
			{departmentNames.map((department: WithReference<Department>) => {
				const isReference = checkIsReferenceNode(department)

				if (isReference)
					return (
						<LabelNode
							selected={false}
							config={department as EXPRESSION_ITEM}
							deleteFn={onDeleteReferenceNode}
							wrapperWidth={wrapperWidth}
						/>
					)

				const { name } = department
				const color = getColor(name as string)

				const targetItem = {
					id: name,
					label: name,
					color: color.backgroundColor,
				}

				return (
					<MultipleItem
						className="magic-label-department-name"
						item={targetItem as MultipleOption}
						itemClick={() => {}}
						showCheck={false}
						value={departmentNames.map((department) => department.name) as string[]}
						onDelete={() => onDeleteCurrentItem(department as Department)}
						{...datasetProps}
						closeColor={color.textColor}
						style={{
							color: color.textColor,
						}}
					/>
				)
			})}
		</div>
	)
}

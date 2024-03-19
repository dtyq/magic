/**
 * 表达式组件的自定义渲染属性
 */

import { Department } from "@/MagicExpressionWidget/components/nodes/LabelDepartmentNames/LabelDepartmentNames"
import DepartmentModalFC from "@/MagicExpressionWidget/mock/DepartmentModal"
import { EXPRESSION_VALUE, LabelTypeMap } from "@/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React from "react"
import { FilterTargetTypes } from "../constants"

export type DepartmentSelectItem = {
	id: string
	name: string
}

export default function useRenderConfig() {
	const getRenderConfig = useMemoizedFn(
		(filterItem: { left: FilterTargetTypes; right: LabelTypeMap; operator: string }) => {
			if (filterItem?.left === FilterTargetTypes.DepartmentName) {
				let departmentValues = _.get(filterItem, ["right", "structure", "const_value"], [])
				departmentValues =
					departmentValues?.find?.(
						(departmentValue: EXPRESSION_VALUE) =>
							departmentValue.type === LabelTypeMap.LabelDepartmentNames,
					)?.department_names_value || []
				return {
					type: LabelTypeMap.LabelDepartmentNames,
					props: {
						editComponent: ({
							onChange,
							closeModal,
							isOpen,
						}: {
							isOpen: boolean
							closeModal: () => void
							onChange: (departmentNames: Department[]) => void
						}) => {
							console.log("isOpen", isOpen)
							return (
								<DepartmentModalFC
									isOpen={isOpen}
									closeModal={closeModal}
									onChange={onChange}
								/>
							)
						},
					},
				}
			}
			return undefined
		},
	)

	const getExtraConfig = useMemoizedFn((leftKey: FilterTargetTypes) => {
		if (leftKey === FilterTargetTypes.DepartmentName) {
			return {
				multiple: false,
			}
		}
		return {}
	})

	return {
		getRenderConfig,
		getExtraConfig,
	}
}

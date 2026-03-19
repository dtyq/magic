/**
 * 表达式组件的自定义渲染属性
 */

import { useMemoizedFn } from "ahooks"
import type { EXPRESSION_VALUE } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import AuthManagerModal from "@/pages/flow/components/AuthControlButton/AuthManagerModal/index"
import { ManagerModalType } from "@/pages/flow/components/AuthControlButton/AuthManagerModal/types"
import { get } from "lodash-es"
import { useTranslation } from "react-i18next"
import { FilterTargetTypes } from "../constants"
import { TreeNode } from "@dtyq/user-selector"

export default function useRenderConfig() {
	const { t } = useTranslation()

	const getRenderConfig = useMemoizedFn(
		(filterItem: { left: FilterTargetTypes; right: LabelTypeMap; operator: string }) => {
			if (filterItem?.left === FilterTargetTypes.DepartmentName) {
				let departmentValues = get(filterItem, ["right", "structure", "const_value"], [])
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
							onChange: (departmentNames: { id: string; name: string }[]) => void
						}) => {
							return (
								<AuthManagerModal
									open={isOpen}
									title={t("searchMembers.selectDepartment", { ns: "flow" })}
									defaultValues={departmentValues}
									type={ManagerModalType.Department}
									onClose={closeModal}
									onOk={(data: TreeNode[]) => {
										const departmentNames = data.map((item) => {
											return {
												id: item.id,
												name: item.name || "",
											}
										})
										onChange(departmentNames)
									}}
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

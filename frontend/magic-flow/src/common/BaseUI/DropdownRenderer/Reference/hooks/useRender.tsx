/**
 * 根据渲染属性，返回相对应的渲染组件
 */
import ExpressionCheckbox from "@/MagicExpressionWidget/components/nodes/LabelCheckbox/ExpressionCheckbox/ExpressionCheckbox"
import TimeSelect from "@/MagicExpressionWidget/components/nodes/LabelDatetime/TimeSelect/TimeSelect"
import { TimeSelectValue } from "@/MagicExpressionWidget/components/nodes/LabelDatetime/TimeSelect/type"
import { Department } from "@/MagicExpressionWidget/components/nodes/LabelDepartmentNames/LabelDepartmentNames"
import MemberSelect from "@/MagicExpressionWidget/components/nodes/LabelMember/MemberSelect"
import { Member } from "@/MagicExpressionWidget/components/nodes/LabelMember/types"
import MultipleSelect from "@/MagicExpressionWidget/components/nodes/LabelMultiple/MultipleSelect"
import { Multiple } from "@/MagicExpressionWidget/components/nodes/LabelMultiple/types"
import { NameValue } from "@/MagicExpressionWidget/components/nodes/LabelNames/LabelNames"
import NamesSelect from "@/MagicExpressionWidget/components/nodes/LabelNames/NamesSelect"
import SingleSelect from "@/MagicExpressionWidget/components/nodes/LabelSelect/SingleSelect/SingleSelect"
import { SnowflakeId } from "@/MagicExpressionWidget/helpers"
import { LabelTypeMap, RenderConfig, VALUE_TYPE } from "@/MagicExpressionWidget/types"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { useMemo } from "react"
import { ReferenceCascaderOnChange } from ".."
import useDepartmentModal from "./useDepartmentModal"

type RenderProps = {
	renderConfig?: RenderConfig
	onChange: ReferenceCascaderOnChange
	valueType?: VALUE_TYPE
	dropdownOpen?: boolean
}

type ValueType =
	| Member[]
	| Multiple[]
	| TimeSelectValue
	| boolean
	| null
	| Department[]
	| NameValue[]

export const multipleTypes = [
	LabelTypeMap.LabelDepartmentNames,
	LabelTypeMap.LabelMember,
	LabelTypeMap.LabelMultiple,
	LabelTypeMap.LabelNames,
]

export default function useRender({
	renderConfig,
	onChange,
	valueType,
	dropdownOpen,
}: RenderProps) {
	const commonOnChange = useMemoizedFn((val: ValueType) => {
		if (!renderConfig) return

		onChange({
			type: renderConfig.type,
			uniqueId: SnowflakeId(),
			[`${renderConfig.type}_value`]: val,
			value: "",
		})
	})

	const { open: departmentOpen, closeModal: closeDepartmentModal } = useDepartmentModal({
		dropdownOpen,
	})

	const RenderComponent = useMemo(() => {
		if (valueType === VALUE_TYPE.EXPRESSION) return null
		switch (renderConfig?.type) {
			case LabelTypeMap.LabelMember:
				return <MemberSelect {...renderConfig!.props} onChange={commonOnChange} />

			case LabelTypeMap.LabelMultiple:
				return <MultipleSelect {...renderConfig!.props} onChange={commonOnChange} />

			case LabelTypeMap.LabelDateTime:
				return <TimeSelect {...renderConfig!.props} onChange={commonOnChange} />

			case LabelTypeMap.LabelCheckbox:
				return <ExpressionCheckbox {...renderConfig!.props} onChange={commonOnChange} />

			case LabelTypeMap.LabelSelect:
				return (
					<SingleSelect
						{...renderConfig!.props}
						onChange={commonOnChange}
						isMultiple={false}
					/>
				)
			case LabelTypeMap.LabelDepartmentNames:
				const RenderComp = renderConfig!.props?.editComponent || (() => <div></div>)
				const resetProps = _.omit(renderConfig!.props, ["editComponent"])
				return (
					<RenderComp
						isOpen={departmentOpen}
						closeModal={closeDepartmentModal}
						onChange={(departmentNames: Department[]) => {
							commonOnChange(departmentNames)
							closeDepartmentModal()
						}}
						{...resetProps}
					/>
				)
			case LabelTypeMap.LabelNames:
				return <NamesSelect {...renderConfig!.props} onChange={commonOnChange} />
			default:
				return null
		}
	}, [renderConfig, valueType, departmentOpen])

	return {
		RenderComponent,
	}
}

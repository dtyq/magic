import { useEffect, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { get } from "lodash-es"
import TSIcon from "@dtyq/magic-flow/dist/common/BaseUI/TSIcon"
import usePrevious from "@/pages/flow/common/hooks/usePrevious"
import type { Schema } from "@/types/sheet"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import type { ConditionItemProps } from "./types"
import { getColumnTargetType, getColumnType } from "../helpers"
import "./index.less"
import { AutomateFlowFieldGroup, getDefaultConstValue } from "../constants"
import { Operators } from "../types"
import useComponentProps from "./hooks/useComponentProps"
import { getExpressionRenderConfig } from "../../../utils/helpers"

const ConditionItem = ({
	handleDel,
	onChange,
	columns = {},
	isEnableDel,
	value,
	isShowColumnOption = true,
	sheetId,
	dataTemplate,
	isSupportRowId,
}: ConditionItemProps) => {
	const { leftColumnOptions, rightExpressionProps, centerConditionOptions } = useComponentProps({
		condition: value!,
		columns,
		isSupportRowId,
		sheetId,
		dataTemplate,
	})

	// const [isShowColumnChangeTip, setIsShowColumnChangeTip] = useState(false)
	const updateColumnId = useMemoizedFn((val) => {
		const columnType = getColumnType(columns, val)
		const displayType = getColumnTargetType(sheetId, val, dataTemplate)
		const operator = get(AutomateFlowFieldGroup, [displayType, "conditions", 0, "id"])
		onChange?.({
			operator,
			column_type: columnType,
			value: getDefaultConstValue(),
			column_id: val,
		})
	})

	const updateOperator = useMemoizedFn((val) => {
		const columnType = getColumnType(columns, value?.column_id ?? "")
		onChange?.({
			...value!,
			column_type: columnType,
			operator: val,
			value: getDefaultConstValue(),
		})
	})

	const updateValue = useMemoizedFn((val) => {
		const columnType = getColumnType(columns, value?.column_id ?? "")
		const v = val?.currentTarget ? val.currentTarget.value : val
		onChange?.({
			...value!,
			column_type: columnType,
			value: v,
		})
	})

	const isExistColumn = useMemo(() => {
		if (!leftColumnOptions) return true

		const flag = leftColumnOptions.some((item: any) => item.id === value?.column_id)
		// if (!flag && value?.column_id)
		// 	onChange?.({ column_id: "", operator: null, value: undefined })
		return flag
	}, [leftColumnOptions, value?.column_id])

	const isShowValueOption = useMemo(() => {
		// @ts-ignore
		return ![Operators.EMPTY, Operators.NOT_EMPTY].includes(value?.operator ?? "")
	}, [value])

	useEffect(() => {
		if (!isExistColumn) return
		if (value?.column_type === rightExpressionProps.columnType) return

		// setIsShowColumnChangeTip(true)
		const columnType = getColumnType(columns, value?.column_id ?? "")
		onChange?.({
			column_id: value?.column_id ?? "",
			column_type: columnType,
			operator: AutomateFlowFieldGroup[columnType]?.conditions[0]?.id,
			value: getDefaultConstValue(),
		})
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const renderConfig = useMemo(() => {
		const columnId = value?.column_id
		return getExpressionRenderConfig(columns?.[columnId!])
	}, [columns, value?.column_id])

	const { expressionDataSource } = usePrevious()

	// 这是每一项不用Form.Item的原因是因为这三项之间属于联级关系，用Form.Item不好处理数据
	return (
		<div className="magic-condition-item">
			{isShowColumnOption && (
				<div className="column-container">
					<div>
						<MagicSelect
							value={value?.column_id}
							onChange={updateColumnId}
							className="column-option nodrag"
							onDropdownVisibleChange={() => {
								// setIsShowColumnChangeTip((old) => (old ? false : old))
							}}
							getPopupContainer={(triggerNode: any) => triggerNode.parentNode}
							popupClassName="nowheel"
						>
							{leftColumnOptions.map((item: any) => {
								return (
									<MagicSelect.Option key={item.id}>
										<TSIcon
											style={{ marginRight: "5px" }}
											type={
												AutomateFlowFieldGroup[item.columnType as Schema]
													.icon
											}
										/>
										{item.label}
									</MagicSelect.Option>
								)
							})}
						</MagicSelect>
					</div>
					{/* {(!isExistColumn || isShowColumnChangeTip) && <div>字段不存在或字段已变更</div>} */}
				</div>
			)}
			<MagicSelect
				value={value?.operator}
				onChange={updateOperator}
				options={centerConditionOptions}
				className="compare-option nodrag"
				disabled={!isExistColumn}
				fieldNames={{
					label: "label",
					value: "id",
				}}
				getPopupContainer={(triggerNode: any) => triggerNode.parentNode}
				popupClassName="nowheel"
			/>
			{isShowValueOption && (
				<div className="value-option">
					<MagicExpressionWrap
						value={value?.value}
						onChange={updateValue}
						// @ts-ignore
						renderConfig={renderConfig}
						dataSource={expressionDataSource}
						{...rightExpressionProps}
					/>
				</div>
			)}

			{isEnableDel ? <TSIcon className="del" type="ts-trash" onClick={handleDel} /> : ""}
		</div>
	)
}

export default ConditionItem

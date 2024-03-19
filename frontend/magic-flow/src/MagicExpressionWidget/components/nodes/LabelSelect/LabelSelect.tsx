import { useGlobalContext } from "@/MagicExpressionWidget/context/GlobalContext/useGlobalContext"
import { checkIsReferenceNode } from "@/MagicExpressionWidget/helpers"
import { EXPRESSION_ITEM, WithReference } from "@/MagicExpressionWidget/types"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import React, { useState } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import useDeleteReferenceNode from "../../hooks/useDeleteReferenceNode"
import { MultipleSelectProps } from "../LabelMultiple/MultipleSelect/Select"
import MultipleItem from "../LabelMultiple/MultipleSelect/components/MultipleItem/MultipleItem"
import "../LabelMultiple/index.less"
import { Multiple, MultipleOption } from "../LabelMultiple/types"
import { LabelNode } from "../LabelNode/LabelNode"

interface LabelSelectProps {
	config: EXPRESSION_ITEM
	updateFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export default function LabelSelect({ config, updateFn, wrapperWidth }: LabelSelectProps) {
	const { renderConfig } = useGlobalContext()

	const [selectValue, setSelectValue] = useState(config.select_value as WithReference<Multiple>[])

	useUpdateEffect(() => {
		setSelectValue(config?.select_value)
	}, [config?.select_value])

	const { datasetProps } = useDatasetProps({ config })

	const onDeleteCurrentItem = useMemoizedFn(() => {
		setSelectValue([])
		updateFn({
			...config,
			select_value: [],
		})
	})

	const { onDeleteReferenceNode } = useDeleteReferenceNode({
		values: selectValue,
		setValues: setSelectValue,
		config,
		updateFn,
		valueName: "select_value",
	})

	return (
		<>
			{selectValue.map((val: WithReference<Multiple>) => {
				const isReference = checkIsReferenceNode(val)
				const targetItem = (renderConfig?.props as MultipleSelectProps)?.options?.find(
					(o: any) => o.id === val,
				)
				return isReference ? (
					<LabelNode
						selected={false}
						config={val as EXPRESSION_ITEM}
						deleteFn={onDeleteReferenceNode}
						wrapperWidth={wrapperWidth}
					/>
				) : (
					<MultipleItem
						className="magic-label-multiple"
						item={targetItem as MultipleOption}
						itemClick={() => {}}
						showCheck={false}
						value={selectValue as Multiple[]}
						onDelete={() => onDeleteCurrentItem()}
						{...datasetProps}
					/>
				)
			})}
		</>
	)
}

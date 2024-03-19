import { useGlobalContext } from "@/MagicExpressionWidget/context/GlobalContext/useGlobalContext"
import { checkIsReferenceNode } from "@/MagicExpressionWidget/helpers"
import { EXPRESSION_ITEM, WithReference } from "@/MagicExpressionWidget/types"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import React, { useState } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import useDeleteReferenceNode from "../../hooks/useDeleteReferenceNode"
import { LabelNode } from "../LabelNode/LabelNode"
import { MultipleSelectProps } from "./MultipleSelect/Select"
import MultipleItem from "./MultipleSelect/components/MultipleItem/MultipleItem"
import "./index.less"
import { Multiple, MultipleOption } from "./types"

interface LabelMultipleProps {
	config: EXPRESSION_ITEM
	updateFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export default function LabelMultiple({ config, updateFn, wrapperWidth }: LabelMultipleProps) {
	const { renderConfig } = useGlobalContext()

	const [multipleValue, setMultipleValue] = useState(
		config.multiple_value as WithReference<Multiple>[],
	)

	useUpdateEffect(() => {
		setMultipleValue(config?.multiple_value)
	}, [config?.multiple_value])

	const { datasetProps } = useDatasetProps({ config })

	const onDeleteCurrentItem = useMemoizedFn((id: string) => {
		const index = multipleValue.indexOf(id)
		if (index === -1) return
		multipleValue.splice(index, 1)
		setMultipleValue([...multipleValue])
		updateFn({
			...config,
			multiple_value: multipleValue,
		})
	})

	const { onDeleteReferenceNode } = useDeleteReferenceNode({
		values: multipleValue,
		setValues: setMultipleValue,
		config,
		updateFn,
		valueName: "multiple_value",
	})

	return (
		<>
			{multipleValue.map((val: WithReference<Multiple>) => {
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
						value={multipleValue as Multiple[]}
						onDelete={() => onDeleteCurrentItem(val as Multiple)}
						{...datasetProps}
					/>
				)
			})}
		</>
	)
}

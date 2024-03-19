import { useGlobalContext } from "@/MagicExpressionWidget/context/GlobalContext/useGlobalContext"
import { checkIsReferenceNode } from "@/MagicExpressionWidget/helpers"
import { EXPRESSION_ITEM, NamesRenderConfig, WithReference } from "@/MagicExpressionWidget/types"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import React, { useState } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import useDeleteReferenceNode from "../../hooks/useDeleteReferenceNode"
import { MultipleOption } from "../LabelMultiple/types"
import { LabelNode } from "../LabelNode/LabelNode"
import NamesItem from "./NamesSelect/components/NamesItem/NamesItem"
import "./index.less"

interface LabelNamesProps {
	config: EXPRESSION_ITEM
	updateFn: (val: EXPRESSION_ITEM) => void
	wrapperWidth: number
}

export type NameValue = {
	id: string
	name: string
}

export default function LabelNames({ config, updateFn, wrapperWidth }: LabelNamesProps) {
	const [names, setNames] = useState(config.names_value as WithReference<NameValue>[])

	const { renderConfig } = useGlobalContext()

	useUpdateEffect(() => {
		setNames(config?.names_value)
	}, [config?.names_value])

	const { datasetProps } = useDatasetProps({ config })

	const onDeleteCurrentItem = useMemoizedFn((name: NameValue) => {
		const index = names.findIndex((d) => d.id === name.id)
		if (index === -1) return
		names.splice(index, 1)
		setNames([...names])
		updateFn({
			...config,
			names_value: names,
		})
	})

	const { onDeleteReferenceNode } = useDeleteReferenceNode({
		values: names,
		setValues: setNames,
		config,
		updateFn,
		valueName: "names_value",
	})

	return (
		<div className="magic-label-names" {...datasetProps}>
			{names.map((nameValue: WithReference<NameValue>) => {
				const isReference = checkIsReferenceNode(nameValue)
				const { name } = nameValue

				const targetItem = {
					id: nameValue.id,
					label: name,
				}

				return isReference ? (
					<LabelNode
						selected={false}
						config={nameValue as EXPRESSION_ITEM}
						deleteFn={onDeleteReferenceNode}
						wrapperWidth={wrapperWidth}
					/>
				) : (
					<NamesItem
						className="magic-label-name"
						item={targetItem as MultipleOption}
						itemClick={() => {}}
						showCheck={false}
						value={names as NameValue[]}
						onDelete={() => onDeleteCurrentItem(nameValue as NameValue)}
						{...datasetProps}
						suffix={(renderConfig as NamesRenderConfig)?.props?.suffix}
					/>
				)
			})}
		</div>
	)
}

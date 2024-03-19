import _ from "lodash"
import React, { useMemo, useRef } from "react"
import Options from "./Options"

import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import { Multiple, MultipleOption } from "../types"
import "./styles/select.less"

export type MultipleSelectProps = {
	options: MultipleOption[]
	value: Multiple[]
	onChange: (multiple: Multiple[]) => void
	placeholder?: string
	size?: "small" | "large"
	isMultiple?: boolean
	filterOption?: boolean | ((keyword: string, options: Multiple[]) => Multiple[])
}

function MultipleSelect({
	options,
	value,
	onChange,
	placeholder = i18next.t("common.pleaseSelect", { ns: "magicFlow" }),
	size,
	isMultiple = true,
	filterOption,
	...props
}: MultipleSelectProps) {
	const domRef = useRef<HTMLDivElement>(null)

	const { edges } = useFlow()
	const { currentNode } = useCurrentNode()

	const displayValue = useMemo(() => {
		return _.cloneDeep(value)
	}, [value, edges, currentNode])

	const itemClick = useMemoizedFn((val: Multiple) => {
		const newValues = [...value, val] as Multiple[]
		onChange(isMultiple ? newValues : [val])
	})

	return (
		<div className="magic-multiple-select">
			<Options
				{...{
					itemClick,
					parent: domRef,
					value: displayValue,
					options,
					filterOption,
					...props,
				}}
			/>
		</div>
	)
}

export default MultipleSelect

import _ from "lodash"
import React, { useMemo, useRef } from "react"
import Options from "./Options"

import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import { Names, NamesOption } from "../types"
import "./styles/select.less"

export type NamesSelectProps = {
	options: NamesOption[]
	value: Names[]
	onChange: (names: Names[]) => void
	placeholder?: string
	size?: "small" | "large"
	isMultiple?: boolean
	filterOption?: boolean | ((keyword: string, options: Names[]) => Names[])
	[key: string]: any
}

function NamesSelect({
	options,
	value,
	onChange,
	placeholder = i18next.t("common.pleaseSelect", { ns: "magicFlow" }),
	size,
	isMultiple = true,
	filterOption,
	...props
}: NamesSelectProps) {
	const domRef = useRef<HTMLDivElement>(null)

	const { edges } = useFlow()
	const { currentNode } = useCurrentNode()

	const displayValue = useMemo(() => {
		return _.cloneDeep(value)
	}, [value, edges, currentNode])

	const itemClick = useMemoizedFn((val: Names) => {
		const newValues = [...(value || []), val] as Names[]
		onChange(isMultiple ? newValues : [val])
	})

	return (
		<div className="magic-names-select">
			<Options
				{...{
					itemClick,
					parent: domRef,
					value: displayValue,
					options: options,
					filterOption: filterOption,
					...props,
				}}
			/>
		</div>
	)
}

export default NamesSelect

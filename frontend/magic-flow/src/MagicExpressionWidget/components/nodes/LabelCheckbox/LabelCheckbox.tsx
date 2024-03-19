import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import React, { useMemo } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import { getTargetCheckboxOption } from "./ExpressionCheckbox/constants"
import "./index.less"

interface LabelCheckboxProps {
	config: EXPRESSION_ITEM
}

export default function LabelCheckbox({ config }: LabelCheckboxProps) {
	const renderBlock = useMemo(() => {
		const checkbox = !!config.checkbox_value
		const targetOption = getTargetCheckboxOption(checkbox)
		return targetOption?.label
	}, [config])

	const { datasetProps } = useDatasetProps({ config })

	return (
		<div className="magic-label-checkbox" {...datasetProps}>
			{renderBlock}
		</div>
	)
}

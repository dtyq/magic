import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import React, { useMemo } from "react"
import useDatasetProps from "../../hooks/useDatasetProps"
import { getTargetDateTimeOption } from "./TimeSelect/constants"
import { TimeSelectType } from "./TimeSelect/type"
import "./index.less"

interface LabelDatetimeProps {
	config: EXPRESSION_ITEM
}

export default function LabelDatetime({ config }: LabelDatetimeProps) {
	const renderBlock = useMemo(() => {
		const datetimeType = config.datetime_value.type
		if (datetimeType === TimeSelectType.Designation) return config.datetime_value.value
		const targetOption = getTargetDateTimeOption(datetimeType)
		return targetOption?.label
	}, [config])

	const { datasetProps } = useDatasetProps({ config })

	return (
		<div className="magic-label-datetime" {...datasetProps}>
			{renderBlock}
		</div>
	)
}

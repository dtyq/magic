import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import { Flex } from "antd"
import { IconPassword } from "@tabler/icons-react"
import React from "react"
import useDatasetProps from "../../hooks/useDatasetProps"

interface LabelPasswordProps {
	config: EXPRESSION_ITEM
}

export function LabelPassword({ config }: LabelPasswordProps) {
	const { datasetProps } = useDatasetProps({ config })
	return (
		<Flex
			style={{
				marginLeft: "4px",
				marginRight: "4px",
			}}
			{...datasetProps}
		>
			<IconPassword stroke={1.5} size={23} />
			<IconPassword stroke={1.5} size={23} />
		</Flex>
	)
}

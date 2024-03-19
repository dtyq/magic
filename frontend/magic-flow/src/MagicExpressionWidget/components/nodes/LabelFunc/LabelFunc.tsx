/* eslint-disable @typescript-eslint/no-use-before-define */
import { useArgsModalContext } from "@/MagicExpressionWidget/context/ArgsModalContext/useArgsModalContext"
import { Splitor } from "@/common/BaseUI/DropdownRenderer/Reference/constants"
import { ExpandAltOutlined } from "@ant-design/icons"
import { IconClose } from "@douyinfe/semi-icons"
import { Tooltip } from "antd"
import _ from "lodash"
import React from "react"
import { LabelFuncStyle } from "../../../style"
import {
	EXPRESSION_ITEM,
	EXPRESSION_VALUE,
	InputExpressionValue,
	LabelTypeMap,
	VALUE_TYPE,
} from "../../../types"
import useDatasetProps from "../../hooks/useDatasetProps"

export function flatStringifyFunArg(arg: InputExpressionValue) {
	if (!arg) return
	let output = ""
	const argValueKey = `${arg.type}_value`
	// 取到对应类型的value
	const argValue = (arg[argValueKey as keyof InputExpressionValue] || []) as EXPRESSION_VALUE[]
	// console.log("argValue", argValue)
	argValue.forEach((item) => {
		if (item.type === LabelTypeMap.LabelFunc) {
			output += `${item.name}(`
			if (item.args && item.args.length > 0) {
				output += item.args.map((j) => flatStringifyFunArg(j)).join(",")
			}
			output += ")"
		}
		if (item.type === LabelTypeMap.LabelText) {
			output += item.value
		}
		if (item.type === LabelTypeMap.LabelNode) {
			// item.value = nodeId.key，只显示key
			const key = item.value?.split?.(Splitor)?.[1]
			output += key
		}
	})
	return output
}

interface LabelFuncProps {
	config: EXPRESSION_ITEM
	disabled: boolean
	selected: boolean
	deleteFn: (val: EXPRESSION_ITEM) => void
}

export function LabelFunc({ config, disabled, selected, deleteFn }: LabelFuncProps) {
	/** 参数项配置弹窗 */
	const { onPopoverModalClick } = useArgsModalContext()

	const { datasetProps } = useDatasetProps({ config })

	return (
		<Tooltip
			className="expression-block"
			title={config.name || config.value}
			overlayStyle={{ maxWidth: 600 }}
		>
			<LabelFuncStyle
				contentEditable={false}
				id={config.uniqueId}
				disabled={disabled}
				selected={selected}
				{...datasetProps}
			>
				<div className="text" {...datasetProps}>
					{config.name || config.value}
				</div>
				<div className="args" {...datasetProps}>
					{"(  "}
					{config?.args?.length &&
						config.args.map(
							(
								arg: {
									[x: string]: any
									type: VALUE_TYPE
									const_value: EXPRESSION_VALUE[]
									expression_value: EXPRESSION_VALUE[]
								},
								index: number,
							) => (
								<React.Fragment key={_.uniqueId("label-func-")}>
									{index !== 0 && ", "}
									{flatStringifyFunArg(arg)}
									{!disabled && (
										<ExpandAltOutlined
											key={_.uniqueId("label-func-icon-")}
											onClick={(e) =>
												onPopoverModalClick(e, config, arg, index)
											}
										/>
									)}
								</React.Fragment>
							),
						)}
					{"  )"}
				</div>

				{!disabled && <IconClose onClick={() => deleteFn(config)} />}
			</LabelFuncStyle>
		</Tooltip>
	)
}

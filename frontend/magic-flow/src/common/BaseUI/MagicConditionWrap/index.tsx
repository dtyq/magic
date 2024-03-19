/** 多增加了一层渲染结构的条件组件
 * {
        "id": "component-66399f15d691c",
        "version": "1",
        "type": "value",
        "structure": null
    }
 */

import { CustomConditionContainerProps } from "@/MagicConditionEdit"
import { Expression } from "@/MagicConditionEdit/types/expression"
import { MagicConditionEdit } from "@/index"
import { useMemoizedFn } from "ahooks"
import React from "react"

export type WidgetConditionValue = {
	id: string
	version: string
	type: string
	structure: Expression.Condition
}

//@ts-ignore
interface MagicConditionWrapProps extends CustomConditionContainerProps {
	value?: WidgetConditionValue
	onChange?: (value: WidgetConditionValue) => void
}

export default function MagicConditionWrap({ ...props }: MagicConditionWrapProps) {
	// 暂时不需要外层的结构，只需要更改structure的数据即可
	const onChange = useMemoizedFn((value: Expression.Condition) => {
		if (!props.onChange || !props.value) return
		props.onChange({
			...props.value,
			structure: value,
		})
	})

	return <MagicConditionEdit {...props} value={props?.value?.structure} onChange={onChange} />
}

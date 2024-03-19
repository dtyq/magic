/** 多增加了一层渲染结构的条件组件
 * {
        "id": "component-66399f15d691c",
        "version": "1",
        "type": "value",
        "structure": null
    }
 */

import MagicConditionEdit from "@dtyq/magic-flow/dist/MagicConditionEdit"
import type { Expression } from "@dtyq/magic-flow/dist/MagicConditionEdit/types/expression"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"

export type WidgetConditionValue = {
	id: string
	version: string
	type: string
	structure: Expression.Condition
}

// @ts-ignore
interface MagicConditionWrapProps {
	value?: WidgetConditionValue
	onChange?: (value: WidgetConditionValue) => void
	[key: string]: any
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

	// 避免每次因为Form.Item onChange导致重新渲染
	const MemoComponent = useMemo(() => {
		return <MagicConditionEdit {...props} value={props?.value?.structure} onChange={onChange} />
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return MemoComponent
}

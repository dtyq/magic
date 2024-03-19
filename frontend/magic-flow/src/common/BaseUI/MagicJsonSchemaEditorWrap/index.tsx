/** 多增加了一层渲染结构的表单组件
 * {
        "id": "component-66399f15d691c",
        "version": "1",
        "type": "form",
        "structure": {}
    }
 */

import { JsonSchemaEditorProps } from "@/MagicJsonSchemaEditor"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import { MagicJsonSchemaEditor } from "@/index"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React from "react"

export type WidgetJSONSchemaValue = {
	id: string
	version: string
	type: string
	structure: Schema
}

//@ts-ignore
interface MagicJSONSchemaEditorWrap extends JsonSchemaEditorProps {
	value?: WidgetJSONSchemaValue
	onChange?: (value: WidgetJSONSchemaValue) => void
}

function MagicJSONSchemaEditorWrap({ ...props }: MagicJSONSchemaEditorWrap) {
	// 暂时不需要外层的结构，只需要更改structure的数据即可
	const onChange = useMemoizedFn((value: Schema) => {
		if (!props.onChange || !props.value) return

		/** 值相等，不进行派发 */
		if (_.isEqual(props.value?.structure, value)) return
		props.onChange({
			...props.value,
			structure: value,
		})
	})

	return <MagicJsonSchemaEditor {...props} data={props?.value?.structure} onChange={onChange} />
}

export default MagicJSONSchemaEditorWrap as any

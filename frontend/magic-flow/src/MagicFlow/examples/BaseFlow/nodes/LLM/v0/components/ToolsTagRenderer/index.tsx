import { Tag, type SelectProps } from "antd"
import React, { useMemo } from "react"
import { useToolOptions } from "../../context/useTools"
import ToolsOptionWrapper from "../ToolsOptionWrapper"

type TagRenderProps = SelectProps["tagRender"]

const ToolsTagRenderer: TagRenderProps = (props: any) => {
	const { label, closable, onClose } = props
	const { tools } = useToolOptions()
	const onPreventMouseDown = (event: any) => {
		event.preventDefault()
		event.stopPropagation()
	}

	const tool = useMemo(() => {
		return tools?.find?.((t) => t.label === label)
	}, [tools])

	return (
		<Tag
			onMouseDown={onPreventMouseDown}
			closable={closable}
			onClose={onClose}
			style={{ marginInlineEnd: 4 }}
		>
			<ToolsOptionWrapper tool={tool!}>{label}</ToolsOptionWrapper>
		</Tag>
	)
}

export default ToolsTagRenderer

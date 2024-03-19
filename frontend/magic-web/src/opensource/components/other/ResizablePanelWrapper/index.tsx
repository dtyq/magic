import { memo } from "react"
import type { PanelProps, PanelResizeHandleProps } from "react-resizable-panels"
import { Panel, PanelResizeHandle } from "react-resizable-panels"

interface ResizablePanelWrapperProps extends PanelProps {
	visible?: boolean
	resizeHandleProps?: PanelResizeHandleProps
}

const ResizablePanelWrapper = memo(
	({ visible = true, children, resizeHandleProps, ...props }: ResizablePanelWrapperProps) => {
		if (!visible) return null
		return (
			<>
				<PanelResizeHandle {...resizeHandleProps} />
				<Panel {...props}>{children}</Panel>
			</>
		)
	},
)

export default ResizablePanelWrapper

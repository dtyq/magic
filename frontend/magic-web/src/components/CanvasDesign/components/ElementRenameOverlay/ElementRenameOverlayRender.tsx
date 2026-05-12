import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasRenameUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import useRenameLabelPositionEffect from "../../hooks/useRenameLabelPositionEffect"
import { cn } from "../../lib/utils"
import { Input } from "../ui/input"
import styles from "./index.module.css"

export interface ElementRenameOverlayRenderProps {
	elementId: string
}

export default function ElementRenameOverlayRender({ elementId }: ElementRenameOverlayRenderProps) {
	const { canvas } = useCanvas()
	const { setCanvasRenamingElementId } = useCanvasRenameUI()
	const element = useCanvasElement(elementId)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const [value, setValue] = useState("")
	const [isComposing, setIsComposing] = useState(false)

	const closeRename = useCallback(() => {
		canvas?.elementRenameManager.cancelRename()
		setCanvasRenamingElementId(null)
	}, [canvas, setCanvasRenamingElementId])

	const commitRename = useCallback(() => {
		if (!elementId || !canvas) {
			closeRename()
			return
		}

		canvas.elementRenameManager.commitRename(value)
		setCanvasRenamingElementId(null)
	}, [canvas, elementId, closeRename, setCanvasRenamingElementId, value])

	const { containerRef: positionRef } = useRenameLabelPositionEffect({
		elementId,
		inputRef,
		value,
		onTargetDeleted: closeRename,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "element-rename-overlay",
		enableWheelForwarding: true,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	useEffect(() => {
		if (!elementId) {
			setValue("")
			return
		}

		const labelText =
			canvas?.elementManager.getElementInstance(elementId)?.getNameLabelText() || ""
		setValue(labelText)
		setIsComposing(false)
	}, [canvas, elementId])

	useEffect(() => {
		if (elementId && !element) {
			closeRename()
		}
	}, [elementId, closeRename, element])

	useLayoutEffect(() => {
		if (!elementId || !inputRef.current) {
			return
		}

		requestAnimationFrame(() => {
			if (!inputRef.current) return
			inputRef.current.focus()
			inputRef.current.select()
		})
	}, [elementId])

	if (!elementId || !element) {
		return null
	}

	return (
		<div ref={setRefs} className={styles.renameOverlayRoot} data-canvas-ui-component>
			<Input
				ref={inputRef}
				className={cn(
					"box-border min-h-0 w-auto min-w-[72px] px-1.5 py-0 leading-[1.2]",
					"rounded border border-blue-500 bg-background shadow-[0_0_0_1px_rgb(59_130_246/0.08)]",
					"text-base focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-0 md:text-base",
				)}
				value={value}
				onChange={(e) => {
					setValue(e.target.value)
				}}
				onBlur={commitRename}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						if (
							isComposing ||
							e.nativeEvent.isComposing ||
							e.nativeEvent.keyCode === 229
						) {
							return
						}
						e.preventDefault()
						commitRename()
						return
					}

					if (e.key === "Escape") {
						e.preventDefault()
						closeRename()
					}
				}}
				onCompositionStart={() => {
					setIsComposing(true)
				}}
				onCompositionEnd={() => {
					setIsComposing(false)
				}}
			/>
		</div>
	)
}

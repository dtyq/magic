import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "../../../runtime/shared/lib/utils"
import { usePortalContainer } from "../custom/PortalContainerContext"
import {
	PRESERVE_TEXT_EDITOR_FOCUS_ATTR,
	useShouldPreserveTextEditorFocus,
} from "../../../runtime/shared/dom/preserveTextEditorFocus"
import { useFloatingSurfaceId } from "./floatingSurfaceContext"
import { useFloatingBoundary } from "../../../app/providers/FloatingUIProvider"
export { FloatingSurfaceScope } from "./floatingSurfaceContext"

interface PopoverContextValue {
	setAnchorElement: (element: HTMLElement | null) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function hasIntersection(left: DOMRect, right: DOMRect): boolean {
	return (
		left.right > right.left &&
		left.left < right.right &&
		left.bottom > right.top &&
		left.top < right.bottom
	)
}

function Popover(props: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) {
	const { onOpenChange } = props
	const floatingBoundary = useFloatingBoundary()
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(props.defaultOpen ?? false)
	const isControlled = props.open !== undefined
	const isOpen = isControlled ? props.open === true : uncontrolledOpen
	const triggerElementRef = React.useRef<HTMLElement | null>(null)
	const setAnchorElement = React.useCallback((element: HTMLElement | null) => {
		triggerElementRef.current = element
	}, [])
	const handleOpenChange = React.useCallback(
		(nextOpen: boolean) => {
			if (!isControlled) setUncontrolledOpen(nextOpen)
			onOpenChange?.(nextOpen)
		},
		[isControlled, onOpenChange],
	)

	React.useEffect(() => {
		if (!floatingBoundary || !isOpen) return

		let frameId: number | null = null
		let disposed = false
		const checkTriggerVisibility = () => {
			if (disposed) return
			const triggerElement = triggerElementRef.current
			if (
				triggerElement &&
				!hasIntersection(
					triggerElement.getBoundingClientRect(),
					floatingBoundary.getBoundingClientRect(),
				)
			) {
				handleOpenChange(false)
				return
			}
			frameId = window.requestAnimationFrame(checkTriggerVisibility)
		}
		frameId = window.requestAnimationFrame(checkTriggerVisibility)

		return () => {
			disposed = true
			if (frameId !== null) window.cancelAnimationFrame(frameId)
		}
	}, [floatingBoundary, handleOpenChange, isOpen])

	return (
		<PopoverContext.Provider value={{ setAnchorElement }}>
			<PopoverPrimitive.Root {...props} onOpenChange={handleOpenChange} />
		</PopoverContext.Provider>
	)
}

function assignForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
	if (typeof ref === "function") {
		ref(value)
		return
	}
	if (ref) {
		;(ref as React.MutableRefObject<T | null>).current = value
	}
}

function useAnchorRef<T extends HTMLElement>(ref: React.ForwardedRef<T>) {
	const context = React.useContext(PopoverContext)
	return React.useCallback(
		(element: T | null) => {
			context?.setAnchorElement(element)
			assignForwardedRef(ref, element)
		},
		[context, ref],
	)
}

const PopoverTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>((props, ref) => {
	const setRefs = useAnchorRef(ref)
	return <PopoverPrimitive.Trigger ref={setRefs} {...props} />
})

const PopoverAnchor = React.forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Anchor>
>((props, ref) => {
	const setRefs = useAnchorRef(ref)
	return <PopoverPrimitive.Anchor ref={setRefs} {...props} />
})

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, collisionBoundary, ...props }, ref) => {
	const container = usePortalContainer()
	const shouldPreserveTextEditorFocus = useShouldPreserveTextEditorFocus()
	const floatingSurfaceId = useFloatingSurfaceId()
	const floatingBoundary = useFloatingBoundary()
	return (
		<PopoverPrimitive.Portal container={container || undefined}>
			<PopoverPrimitive.Content
				ref={ref}
				align={align}
				sideOffset={sideOffset}
				data-floating-surface-popover={floatingSurfaceId ? "" : undefined}
				data-floating-surface-owner={floatingSurfaceId ?? undefined}
				/** 与 SelectContent 一致：避免 Canvas 全局点击取消选中时把 Portal 内点击当成「画布外」 */
				data-canvas-ui-component
				collisionBoundary={
					collisionBoundary ?? (floatingBoundary ? [floatingBoundary] : undefined)
				}
				{...(shouldPreserveTextEditorFocus
					? { [PRESERVE_TEXT_EDITOR_FOCUS_ATTR]: "" }
					: {})}
				className={cn(
					"z-50 w-72 origin-[--radix-popover-content-transform-origin] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	)
})

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }

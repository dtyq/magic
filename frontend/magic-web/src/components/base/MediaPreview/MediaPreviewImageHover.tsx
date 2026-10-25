import {
	cloneElement,
	useCallback,
	useRef,
	type ReactElement,
	type ReactNode,
	type Ref,
} from "react"
import {
	autoUpdate,
	flip,
	shift,
	offset,
	arrow,
	safePolygon,
	useFloating,
	useHover,
	useFocus,
	useDismiss,
	useInteractions,
	useRole,
	FloatingPortal,
	FloatingFocusManager,
	FloatingArrow,
	useMergeRefs,
} from "@floating-ui/react"
import { useCurrentOverlayZIndex } from "@/utils/overlayZIndex"
import { useOverlayInteractionScopeContentAttributes } from "@/components/shadcn-ui/overlay-interaction-scope"
import type { MediaPreviewTooltipProps } from "./types"

interface Props extends Pick<MediaPreviewTooltipProps, "side" | "sideOffset" | "container"> {
	open: boolean
	onOpenChange: (open: boolean) => void
	trigger: ReactElement
	children: ReactNode
	width: number
	maxHeight: number
	getTrigger?: (element: HTMLElement | null) => void
}

/** 图片已有可点击动作，使用非模态焦点管理和安全区，而不是纯文本 Tooltip。 */
export function MediaPreviewImageHover({
	open,
	onOpenChange,
	trigger,
	children,
	side = "top",
	sideOffset = 8,
	container,
	width,
	maxHeight,
	getTrigger,
}: Props) {
	const arrowRef = useRef<SVGSVGElement>(null)
	const layer = useCurrentOverlayZIndex()
	const scope = useOverlayInteractionScopeContentAttributes()
	const getTriggerRef = useRef(getTrigger)
	getTriggerRef.current = getTrigger
	const { refs, floatingStyles, context } = useFloating({
		open,
		onOpenChange: (nextOpen, _event, reason) => {
			if (
				!nextOpen &&
				(reason === "hover" || reason === "safe-polygon") &&
				refs.floating.current?.contains(document.activeElement)
			)
				return
			onOpenChange(nextOpen)
		},
		placement: side,
		middleware: [
			offset(sideOffset),
			flip(),
			shift({ padding: 8 }),
			arrow({ element: arrowRef }),
		],
		whileElementsMounted: autoUpdate,
	})
	const { getReferenceProps, getFloatingProps } = useInteractions([
		useHover(context, { mouseOnly: true, delay: { open: 250 }, handleClose: safePolygon() }),
		useFocus(context),
		useDismiss(context),
		useRole(context, { role: "dialog" }),
	])
	const setReference = refs.setReference
	const setTrigger = useCallback(
		(element: HTMLElement | null) => {
			setReference(element)
			getTriggerRef.current?.(element)
		},
		[setReference],
	)
	// 保留调用方的尺寸观测／可见性 ref，不能因加浮层丢失裁剪图框的测量。
	const triggerRef = useMergeRefs([
		setTrigger,
		(trigger as ReactElement & { ref?: Ref<HTMLElement> }).ref,
	])
	return (
		<>
			{cloneElement(trigger, {
				...getReferenceProps(trigger.props),
				ref: triggerRef,
			})}
			{open && (
				<FloatingPortal root={container ?? undefined}>
					<FloatingFocusManager
						context={context}
						modal={false}
						initialFocus={-1}
						returnFocus={false}
					>
						<div
							ref={refs.setFloating}
							{...getFloatingProps({
								onClick: (event) => event.stopPropagation(),
								onPointerDown: (event) => event.stopPropagation(),
								onMouseDown: (event) => event.stopPropagation(),
								onDoubleClick: (event) => event.stopPropagation(),
								onKeyDown: (event) => event.stopPropagation(),
							})}
							{...scope}
							className="z-tooltip outline-none"
							style={{
								...floatingStyles,
								width,
								maxWidth: "calc(100vw - 16px)",
								maxHeight,
								...(layer == null ? {} : { zIndex: layer + 6 }),
							}}
						>
							{children}
							<FloatingArrow
								ref={arrowRef}
								context={context}
								width={10}
								height={5}
								className="fill-black/90"
							/>
						</div>
					</FloatingFocusManager>
				</FloatingPortal>
			)}
		</>
	)
}

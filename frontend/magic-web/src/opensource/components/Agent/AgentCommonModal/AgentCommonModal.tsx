import {
	useState,
	Suspense,
	useRef,
	Children,
	cloneElement,
	isValidElement,
	forwardRef,
	useImperativeHandle,
} from "react"
import type { PropsWithChildren, ReactElement } from "react"
import type { DraggableData, DraggableEvent } from "react-draggable"
import Draggable from "react-draggable"
import { useMemoizedFn, useMount, useResponsive } from "ahooks"
import { MagicModal } from "@/opensource/components/base"
import { AgentCommonModalRef, AgentCommonModalProps, AgentCommonModalChildrenProps } from "./types"
import MagicPopup from "../../base-mobile/MagicPopup"

const modalTestIds = {
	root: "agent-common-modal",
	mobile: "agent-common-modal-mobile",
	mobileContent: "agent-common-modal-mobile-content",
	desktop: "agent-common-modal-desktop",
	desktopDraggable: "agent-common-modal-desktop-draggable",
}

export const AgentCommonModal = forwardRef<
	AgentCommonModalRef,
	PropsWithChildren<AgentCommonModalProps>
>((props, ref) => {
	const { onClose, isResponsive = true, open: propOpen, onOpenChange, ...modalProps } = props

	const { md } = useResponsive()
	const isMobile = !md

	const draggleRef = useRef<HTMLDivElement>({} as HTMLDivElement)

	// 判断是否为受控模式
	const isControlled = propOpen !== undefined

	// 非受控模式的内部状态
	const [internalOpen, setInternalOpen] = useState(false)

	// 实际使用的 open 值
	const open = isControlled ? propOpen : internalOpen

	// 设置 open 状态的函数
	const setOpen = (value: boolean) => {
		if (isControlled) {
			onOpenChange?.(value)
		} else {
			setInternalOpen(value)
		}
	}

	const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 })

	// 非受控模式下，挂载时打开
	useMount(() => {
		if (!isControlled) {
			setInternalOpen(true)
		}
	})

	const onStart = useMemoizedFn((_event: DraggableEvent, uiData: DraggableData) => {
		const { clientWidth, clientHeight } = window.document.documentElement
		const targetRect = draggleRef.current?.getBoundingClientRect()
		if (!targetRect) {
			return
		}
		setBounds({
			left: -targetRect.left + uiData.x,
			right: clientWidth - (targetRect.right - uiData.x),
			top: -targetRect.top + uiData.y,
			bottom: clientHeight - (targetRect.bottom - uiData.y),
		})
	})

	// Mobile close handler - wait for animation to complete before cleanup
	const handleMobileClose = useMemoizedFn(() => {
		setOpen(false)
		// Wait for drawer close animation to complete before calling onClose
		// Vaul drawer animation duration is typically 300ms
		setTimeout(() => {
			onClose?.()
		}, 320)
	})

	useImperativeHandle(ref, () => ({
		close() {
			setOpen(false)
		},
	}))

	const dom = (
		<Suspense fallback={null}>
			{Children.map(props?.children, (child) => {
				if (isValidElement(child)) {
					return cloneElement(child as ReactElement<AgentCommonModalChildrenProps>, {
						onClose: handleMobileClose,
					})
				}
				return child
			})}
		</Suspense>
	)

	if (isMobile && isResponsive) {
		return (
			<MagicPopup
				visible={open}
				onClose={handleMobileClose}
				destroyOnClose
				bodyClassName="rounded-t-lg overflow-hidden"
				data-testid={modalTestIds.mobile}
			>
				<div data-testid={modalTestIds.mobileContent}>{dom}</div>
			</MagicPopup>
		)
	}

	return (
		<MagicModal
			{...modalProps}
			centered
			open={open}
			onCancel={() => setOpen(false)}
			afterClose={onClose}
			destroyOnHidden
			data-testid={modalTestIds.desktop}
			classNames={{
				content: "!p-0 overflow-hidden",
				body: "!p-0",
			}}
			modalRender={(modal) => (
				<Draggable
					disabled
					bounds={bounds}
					nodeRef={draggleRef}
					onStart={(event, uiData) => onStart(event, uiData)}
				>
					<div ref={draggleRef} data-testid={modalTestIds.desktopDraggable}>
						{modal}
					</div>
				</Draggable>
			)}
		>
			<div data-testid={modalTestIds.root}>{dom}</div>
		</MagicModal>
	)
})

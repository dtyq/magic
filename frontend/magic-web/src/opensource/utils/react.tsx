import type { FC } from "react"
import { createRoot } from "react-dom/client"
import { DetachComponentProviders } from "@/opensource/components/other/DetachComponentProviders"
import type { ModalProps } from "antd"
import { last } from "lodash-es"
import { BrowserProvider } from "@/opensource/providers/BrowserProvider"

export type OpenableProps<P = ModalProps> = P & {
	onClose?: () => void
	rootDom?: HTMLElement
	getPopupContainer?: () => HTMLElement
	getContainer?: () => HTMLElement
}

const triggerlist: HTMLElement[] = [document.body]

export const openModal = <P extends object>(
	ModalComponent: FC<P>,
	props: Omit<P, "onClose" | "rootDom" | "getPopupContainer" | "getContainer">,
	attach?: HTMLElement,
) => {
	const root = attach ?? document.createElement("div")

	const parent = last(triggerlist) ?? document.body
	parent?.appendChild(root)
	triggerlist.push(root)

	let isClosing = false

	const close = () => {
		if (isClosing) return
		isClosing = true

		// 立即从列表中移除，避免影响后续打开的弹窗
		const index = triggerlist.indexOf(root)
		if (index > -1) {
			triggerlist.splice(index, 1)
		}

		// 延迟移除 DOM，等待动画完成
		setTimeout(() => {
			root.remove()
		}, 300)
	}

	const propsWithClose = {
		onClose: close,
		rootDom: root,
		getContainer: () => root,
		getPopupContainer: () => root,
		...props,
	} as OpenableProps<P>

	createRoot(root).render(
		<BrowserProvider>
			<DetachComponentProviders>
				<div onClick={(e) => e.stopPropagation()}>
					<ModalComponent {...propsWithClose} />
				</div>
			</DetachComponentProviders>
		</BrowserProvider>,
	)
}

import type { FC } from "react"
import { createRoot } from "react-dom/client"
import type { ModalProps } from "antd"
import { last } from "lodash-es"
import { AdminComponentsProvider, MagicThemeProvider } from "components"
import { ConfigProvider } from "antd"
import { AdminProviderContext, useAdmin } from "@/provider/AdminProvider"
import type { AdminProviderContextType } from "@/provider/AdminProvider/types"
import { languageManager } from "../utils/locale"

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
	adminContext?: AdminProviderContextType,
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

	// 获取当前语言对应的 antd locale
	const locale = languageManager.getAntdLocale()

	const content = adminContext ? (
		<AdminProviderContext.Provider value={adminContext}>
			<AdminComponentsProvider language={adminContext.language} theme={adminContext.LIGHT}>
				<div onClick={(e) => e.stopPropagation()}>
					<ModalComponent {...propsWithClose} />
				</div>
			</AdminComponentsProvider>
		</AdminProviderContext.Provider>
	) : (
		<ConfigProvider locale={locale}>
			<MagicThemeProvider>
				<div onClick={(e) => e.stopPropagation()}>
					<ModalComponent {...propsWithClose} />
				</div>
			</MagicThemeProvider>
		</ConfigProvider>
	)

	createRoot(root).render(content)
}

/**
 * 在组件内使用的 hook，自动获取 AdminProvider context 并打开 Modal
 * @example
 * const openModal = useOpenModal()
 * openModal(MyModal, { title: 'Hello' })
 */
export const useOpenModal = () => {
	const adminContext = useAdmin()

	return <P extends object>(
		ModalComponent: FC<P>,
		props: Omit<P, "onClose" | "rootDom" | "getPopupContainer" | "getContainer">,
		attach?: HTMLElement,
	) => {
		return openModal(ModalComponent, props, attach, adminContext)
	}
}

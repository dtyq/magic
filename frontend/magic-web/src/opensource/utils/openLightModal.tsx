import type { FC } from "react"
import { createRoot } from "react-dom/client"
import { last } from "lodash-es"
import type { OpenableProps } from "./react"
import { I18nextProvider } from "react-i18next"
import i18next from "i18next"

const triggerlist: HTMLElement[] = [document.body]

/**
 * 极简 Provider，用于简单弹窗（避免任何可能导致双重渲染的 Provider）
 * 只包含 i18next，所有样式使用 Tailwind CSS
 */
function MinimalProviders({ children }: { children: React.ReactNode }) {
	return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>
}

/**
 * 打开简单弹窗（极轻量级，不包含 Router、Theme、Locale 等）
 *
 * 适用场景：
 * - 下载提示弹窗
 * - 简单确认框
 * - 不需要路由功能的弹窗
 *
 * 优势：
 * - 避免 BrowserRouter、ThemeProvider、LocaleProvider 初始化导致的双重渲染
 * - 极快的初始化速度
 * - 最少的 Context 订阅开销
 *
 * 限制：
 * - 不支持 antd 组件（需要 ConfigProvider、ThemeProvider）
 * - 不支持路由功能（需要 BrowserRouter）
 * - 仅支持 i18next 国际化
 *
 * 注意：
 * - 如果弹窗内使用了 antd 组件，请使用 openModal
 * - 如果弹窗内需要使用路由功能（useNavigate、Link 等），请使用 openModal
 * - 如果弹窗内需要访问 MagicAdminProvider 的数据，请使用 openModal
 *
 * @example
 * ```tsx
 * openLightModal(MySimpleModal, {
 *   open: true,
 *   title: "提示",
 *   content: "操作成功"
 * })
 * ```
 */
export const openLightModal = <P extends object>(
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
		<MinimalProviders>
			<ModalComponent {...propsWithClose} />
		</MinimalProviders>,
	)
}

import { createRoot, type Root } from "react-dom/client"
import CreateWorkspaceModal from "./index"
import { useEffect, useState } from "react"

interface ShowCreateWorkspaceModalOptions {
	/** 创建工作区成功时的回调函数 */
	onCreate?: (workspaceName: string) => void | Promise<void>
	/** 弹窗关闭时的回调函数 */
	onClose?: () => void
}

let modalContainer: HTMLDivElement | null = null
let modalRoot: Root | null = null

/**
 * 动态显示创建工作区弹窗
 * @param options 配置选项
 * @returns Promise，在弹窗关闭时resolve，返回工作区名称或null
 */
export function showCreateWorkspaceModal(
	options: ShowCreateWorkspaceModalOptions = {},
): Promise<string | null> {
	return new Promise((resolve) => {
		// 如果已经存在弹窗，先清理
		if (modalContainer && modalRoot) {
			closeModal()
		}

		// 创建容器元素
		modalContainer = document.createElement("div")
		modalContainer.id = "create-workspace-modal-container"
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1000"
		document.body.appendChild(modalContainer)

		// 创建React根节点
		modalRoot = createRoot(modalContainer)

		let isCreating = false

		const handleClose = () => {
			if (!isCreating) {
				options.onClose?.()
				closeModal()
				resolve(null)
			}
		}

		const handleCreate = async (workspaceName: string) => {
			isCreating = true
			try {
				await options.onCreate?.(workspaceName)
				// 创建成功后关闭弹窗
				setTimeout(() => {
					closeModal()
					resolve(workspaceName)
				}, 200)
			} catch (error) {
				console.error("Create error in showCreateWorkspaceModal:", error)
				// 即使创建失败，也返回工作区名称并关闭弹窗
				setTimeout(() => {
					closeModal()
					resolve(workspaceName)
				}, 200)
			}
		}

		// 包装组件，依赖组件内置的 CSS 动画实现流畅过渡
		const ModalWrapper = () => {
			const [open, setOpen] = useState(false)

			useEffect(() => {
				setTimeout(() => {
					setOpen(true)
				}, 0)
			}, [])

			const handleOpenChange = (newOpen: boolean) => {
				if (!newOpen && !isCreating) {
					setTimeout(() => {
						handleClose()
					}, 0)
				}
			}

			return (
				<CreateWorkspaceModal
					open={open}
					onOpenChange={handleOpenChange}
					onCreate={handleCreate}
				/>
			)
		}

		// 渲染弹窗组件
		modalRoot.render(<ModalWrapper />)
	})
}

/**
 * 关闭并清理弹窗
 */
function closeModal() {
	if (modalRoot) {
		modalRoot.unmount()
		modalRoot = null
	}

	if (modalContainer) {
		document.body.removeChild(modalContainer)
		modalContainer = null
	}
}

/**
 * 检查当前是否有弹窗正在显示
 */
export function isCreateWorkspaceModalOpen(): boolean {
	return modalContainer !== null && modalRoot !== null
}

/**
 * 强制关闭当前显示的弹窗
 */
export function forceCloseCreateWorkspaceModal(): void {
	closeModal()
}

import { useMemoizedFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import { type MenuProps } from "antd"
import { ChevronDown } from "lucide-react"
import { MagicDropdown } from "@/components/base"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import magicToast from "@/components/base/MagicToaster/utils"

const SAVE_INTERVAL = 2 * 60 * 1000

function useEditMode({ fileId, fileName }: { fileId?: string; fileName?: string }) {
	const [isEditMode, _setIsEditMode] = useState(false)
	const { t } = useTranslation("super")

	const intervalRef = useRef<NodeJS.Timeout>()
	// 保存最新的编辑态，供卸载/关闭时判断
	const isEditModeRef = useRef(false)
	// leave-editing 幂等状态管理（防止重复调用后端接口）
	// - inFlight: 正在进行的 leave 请求（用于去重并发调用）
	// - hasLeft: 是否已成功离开（用于防止状态滞后导致的重复 leave）
	const leaveStateRef = useRef<{
		inFlight: Promise<void> | null
		hasLeft: boolean
	}>({
		inFlight: null,
		hasLeft: false,
	})
	const beforeUnloadRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null)

	useEffect(() => {
		isEditModeRef.current = isEditMode
	}, [isEditMode])

	const startSaveInterval = useMemoizedFn(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current)
			intervalRef.current = undefined
		}

		intervalRef.current = setInterval(() => {
			if (fileId) {
				joinEdit(fileId)
			}
		}, SAVE_INTERVAL)
	})

	const stopSaveInterval = useMemoizedFn(() => {
		clearInterval(intervalRef.current)
		intervalRef.current = undefined
	})

	useEffect(() => {
		return () => {
			stopSaveInterval()
			// Best-effort leave when hook unmounts while still in edit mode
			if (isEditModeRef.current && fileId) {
				SuperMagicApi.leaveFileEdit(fileId).catch((err) =>
					console.debug("leaveFileEdit on unmount failed", err),
				)
			}
		}
	}, [fileId, stopSaveInterval])

	// Best-effort cleanup on page close
	useEffect(() => {
		if (!isEditMode || !fileId) return

		beforeUnloadRef.current = (e) => {
			// Prevent page close and show browser's default confirmation dialog
			e.preventDefault()

			// Note: Modern browsers ignore custom messages for security reasons
			// They will show their own standard confirmation dialog
			// The returnValue is set to trigger the dialog, not for display
			const message = t("detail.unsavedChangesWarning")
			e.returnValue = message // For older browsers (ignored by modern browsers)

			// Best-effort cleanup: try to leave edit mode
			// This is asynchronous and may not complete before page unload
			try {
				SuperMagicApi.leaveFileEdit(fileId)
			} catch (err) {
				// Silently fail - page is closing anyway
			}

			return message // For older browsers (ignored by modern browsers)
		}

		window.addEventListener("beforeunload", beforeUnloadRef.current)

		return () => {
			if (beforeUnloadRef.current)
				window.removeEventListener("beforeunload", beforeUnloadRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEditMode, fileId])

	const joinEdit = useMemoizedFn(async (fileId: string) => {
		if (!fileId) {
			return
		}
		try {
			await SuperMagicApi.joinFileEdit(fileId)

			// 设置定时器，每2分钟更新一次状态
			startSaveInterval()

			leaveStateRef.current.hasLeft = false
			isEditModeRef.current = true
			_setIsEditMode(true)
		} catch (error) {
			console.error(error)
		}
	})

	const leaveEdit = useMemoizedFn(async (fileId: string) => {
		if (!fileId) {
			return
		}
		// 这里需要“幂等”：
		// - 内容组件保存时可能 setIsEditMode(false) -> 触发 leaveEdit
		// - 弹窗“保存并关闭”流程也会显式调用 leaveEdit
		// - React 状态更新是异步的，短时间内 isEditMode 可能仍为 true
		// 因此用两个 ref 把“并发 + 状态滞后”都挡住，确保后端只收到一次 leave-editing
		if (leaveStateRef.current.hasLeft) {
			return
		}
		if (leaveStateRef.current.inFlight) {
			await leaveStateRef.current.inFlight
			return
		}
		if (!isEditModeRef.current && !isEditMode) {
			return
		}
		try {
			const promise = SuperMagicApi.leaveFileEdit(fileId).then(() => {})
			leaveStateRef.current.inFlight = promise
			await promise
			leaveStateRef.current.inFlight = null
			leaveStateRef.current.hasLeft = true

			stopSaveInterval()

			isEditModeRef.current = false
			_setIsEditMode(false)
		} catch (error) {
			leaveStateRef.current.inFlight = null
			console.error(error)
		}
	})

	const setIsEditMode = useMemoizedFn((value: boolean) => {
		if (!fileId) {
			return
		}

		if (value) {
			const currentFileId = fileId
			SuperMagicApi.getFileEditCount(currentFileId).then((res) => {
				if (res.editing_user_count > 0) {
					const modal = MagicModal.confirm({
						title: t("detail.editingConflictPromptOnEdit"),
						okText: t("common.continue"),
						cancelText: t("common.cancel"),
						closable: false,
						maskClosable: false,
						centered: true,
						onOk: async () => {
							try {
								await joinEdit(currentFileId)
							} catch (error) {
								console.error(error)
								magicToast.error(t("detail.joinEditFailed"))
							} finally {
								modal.destroy()
							}
						},
						onCancel: () => {
							modal.destroy()
						},
					})
					return
				}

				return joinEdit(currentFileId)
			})
		} else {
			return leaveEdit(fileId)
		}
	})

	// Check before close - returns 'close', 'save', or 'cancel'
	const checkBeforeClose = useMemoizedFn(
		async (onSave?: () => Promise<void>): Promise<"close" | "save" | "cancel"> => {
			if (!isEditMode) return "close"

			return new Promise((resolve) => {
				const modal = MagicModal.confirm({
					title: t("detail.closeEditingFilePrompt", {
						fileName: fileName || t("common.untitledFile"),
					}),
					content: t("detail.closeEditingFileContent"),
					cancelText: t("common.cancel"),
					closable: false,
					maskClosable: false,
					centered: true,
					footer: (_, { CancelBtn }) => {
						// 处理直接关闭
						const handleDirectClose = async () => {
							try {
								if (fileId) {
									await leaveEdit(fileId)
								}
								modal.destroy()
								resolve("close")
							} catch (error) {
								console.error(error)
								modal.destroy()
								resolve("cancel")
							}
						}

						// 处理保存并关闭
						const handleSaveAndClose = async () => {
							if (!onSave) return
							try {
								await onSave()
								if (fileId) {
									await leaveEdit(fileId)
								}
								modal.destroy()
								resolve("save")
							} catch (error) {
								console.error(error)
								modal.destroy()
								resolve("cancel")
							}
						}

						// 下拉菜单项
						const menuItems: MenuProps["items"] = [
							{
								key: "directClose",
								label: t("detail.directClose"),
								onClick: handleDirectClose,
							},
						]

						return (
							<div className={cn("flex items-center justify-end gap-2 px-4 pb-4")}>
								<CancelBtn />
								{onSave ? (
									<MagicDropdown menu={{ items: menuItems }} trigger={["hover"]}>
										<span>
											<Button onClick={handleSaveAndClose}>
												{t("detail.saveAndClose")}
												<ChevronDown className="ml-1 size-4" />
											</Button>
										</span>
									</MagicDropdown>
								) : (
									<Button onClick={handleDirectClose}>
										{t("common.confirm")}
									</Button>
								)}
							</div>
						)
					},
					onCancel: () => {
						modal.destroy()
						resolve("cancel")
					},
				})
			})
		},
	)

	return { isEditMode, setIsEditMode, checkBeforeClose }
}

export default useEditMode

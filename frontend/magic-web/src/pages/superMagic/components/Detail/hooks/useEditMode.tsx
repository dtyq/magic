import { useMemoizedFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import { type MenuProps } from "antd"
import { ChevronDown } from "lucide-react"
import { MagicDropdown } from "@/components/base"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import magicToast from "@/components/base/MagicToaster/utils"

const SAVE_INTERVAL = 2 * 60 * 1000
const LEAVE_RETRY_DELAYS_MS = [1000, 3000]

async function leaveFileEditWithRetry(fileId: string) {
	for (let attempt = 0; ; attempt += 1) {
		try {
			await SuperMagicApi.leaveFileEdit(fileId)
			return
		} catch (error) {
			const delay = LEAVE_RETRY_DELAYS_MS[attempt]
			if (delay === undefined) throw error
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}
}

function useEditMode({
	fileId,
	fileName,
	editingPresenceEnabled = true,
	silentClose = false,
}: {
	fileId?: string
	fileName?: string
	editingPresenceEnabled?: boolean
	silentClose?: boolean
}) {
	const [isEditMode, _setIsEditMode] = useState(false)
	const { t } = useTranslation("super")

	const intervalRef = useRef<NodeJS.Timeout>()
	// 保存最新的编辑态，供卸载/关闭时判断
	const isEditModeRef = useRef(false)
	// leave-editing 幂等状态管理（防止重复调用后端接口）
	// - inFlight: 正在进行的 leave 请求（用于去重并发调用）
	// - hasLeft: 是否已成功离开（用于防止状态滞后导致的重复 leave）
	// - failed: UI 已退出但 leave 请求重试后仍失败，卸载时需要再上报一次
	const leaveStateRef = useRef<{
		inFlight: Promise<void> | null
		hasLeft: boolean
		failed: boolean
	}>({
		inFlight: null,
		hasLeft: false,
		failed: false,
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
			// Best-effort leave when hook unmounts while still in edit mode,
			// or when an earlier leave failed after the UI already exited
			const leaveState = leaveStateRef.current
			const needsLeave = isEditModeRef.current || (leaveState.failed && !leaveState.hasLeft)
			if (editingPresenceEnabled && needsLeave && fileId) {
				SuperMagicApi.leaveFileEdit(fileId).catch((err) =>
					console.debug("leaveFileEdit on unmount failed", err),
				)
			}
		}
	}, [editingPresenceEnabled, fileId, stopSaveInterval])

	// Best-effort cleanup on page close
	useEffect(() => {
		if (silentClose || !isEditMode || !fileId) return

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
			if (editingPresenceEnabled) {
				try {
					SuperMagicApi.leaveFileEdit(fileId)
				} catch (err) {
					// Silently fail - page is closing anyway
				}
			}

			return message // For older browsers (ignored by modern browsers)
		}

		window.addEventListener("beforeunload", beforeUnloadRef.current)

		return () => {
			if (beforeUnloadRef.current)
				window.removeEventListener("beforeunload", beforeUnloadRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editingPresenceEnabled, isEditMode, fileId, silentClose])

	const joinEdit = useMemoizedFn(async (fileId: string) => {
		if (!fileId) {
			return
		}
		if (!editingPresenceEnabled) {
			leaveStateRef.current.hasLeft = false
			leaveStateRef.current.failed = false
			isEditModeRef.current = true
			_setIsEditMode(true)
			return
		}
		try {
			await SuperMagicApi.joinFileEdit(fileId)

			// 设置定时器，每2分钟更新一次状态
			startSaveInterval()

			leaveStateRef.current.hasLeft = false
			leaveStateRef.current.failed = false
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
		if (!editingPresenceEnabled) {
			stopSaveInterval()
			leaveStateRef.current.hasLeft = true
			isEditModeRef.current = false
			_setIsEditMode(false)
			return
		}
		// Idempotent leave:
		// - save/exit and close dialogs may both call setIsEditMode(false)
		// - exit UI immediately; presence leave finishes in the background so
		//   content sync cannot remount the editor while isEditMode is still true
		if (leaveStateRef.current.hasLeft) {
			return
		}
		if (leaveStateRef.current.inFlight) {
			await leaveStateRef.current.inFlight
			return
		}

		stopSaveInterval()
		isEditModeRef.current = false
		_setIsEditMode(false)

		try {
			const promise = leaveFileEditWithRetry(fileId).then(() => {
				leaveStateRef.current.hasLeft = true
				leaveStateRef.current.failed = false
			})
			leaveStateRef.current.inFlight = promise
			await promise
		} catch (error) {
			leaveStateRef.current.failed = true
			console.error(error)
		} finally {
			leaveStateRef.current.inFlight = null
		}
	})

	const setIsEditMode = useMemoizedFn((value: boolean) => {
		if (!fileId) {
			return
		}

		if (value) {
			const currentFileId = fileId
			if (!editingPresenceEnabled) {
				return joinEdit(currentFileId)
			}
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
			if (silentClose) {
				try {
					await onSave?.()
					// Local draft durability and remote persistence do not depend on the
					// presence release request. Let the tab close while that request retries.
					if (fileId) void leaveEdit(fileId)
					return onSave ? "save" : "close"
				} catch {
					// Canvas retains its durable local draft when saving fails, so closing
					// remains safe without adding a confirmation dialog to the silent flow.
					return "close"
				}
			}

			// Canvas can register a save handler without joining generic editing
			// presence. The handler still requires an explicit close decision.
			if (!isEditMode && !onSave) return "close"

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

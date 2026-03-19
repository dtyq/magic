import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { App, Flex } from "antd"
import MagicButton from "@/components/base/MagicButton"
import type MagicModal from "@/components/base/MagicModal"
import { AppEnv } from "@/types/env"
import useCheckUpdateWorker from "./useCheckUpdateWorker"
import { ReflectMessageType } from "./const"
import { isBreakingVersion } from "./utils"
import { isProductionEnv } from "@/utils/env"

const useVersion = () => {
	const forbidUpdate = useRef(false)
	const versionRef = useRef<string>()
	const modalRef = useRef<ReturnType<typeof MagicModal.info> | null>(null)
	const openedRef = useRef(false)
	const { t } = useTranslation("interface")

	const { modal } = App.useApp()

	const { start, stop, refresh, workerRef } = useCheckUpdateWorker({
		name: "updateModal",
		type: "module",
	})

	// 通知更新弹窗
	const openNotification = useCallback(() => {
		openedRef.current = true
		forbidUpdate.current = true
		const config = {
			title: t("FrontendVersionDetected"),
			content: t("PleaseReloadThePage"),
			centered: true,
			maskClosable: false,
			closable: false,
			footer: (
				<Flex justify="flex-end" gap={8}>
					<MagicButton
						onClick={() => {
							forbidUpdate.current = false
							modalRef.current?.destroy()
							modalRef.current = null
						}}
					>
						{t("common.cancel")}
					</MagicButton>
					<MagicButton
						type="primary"
						onClick={() => {
							refresh()
							window.location.reload()
						}}
					>
						{t("common.refresh")}
					</MagicButton>
				</Flex>
			),
		}
		if (modalRef.current) {
			modalRef.current.update(config)
		} else {
			modalRef.current = modal.info(config)
		}
	}, [modal, refresh, t])

	// 根据版本判断是否更新
	const handlePageUpdateCheck = useCallback(
		(latestVersion: string) => {
			try {
				if (latestVersion) {
					const currentVersion = versionRef.current
					if (!currentVersion) {
						versionRef.current = latestVersion
					} else if (currentVersion === latestVersion) {
						console.log("最新版本", latestVersion)
					} else if (
						isBreakingVersion(currentVersion, latestVersion) &&
						!forbidUpdate.current &&
						!openedRef.current
					) {
						openNotification()
					}
				}
			} catch (error) {
				console.error(error)
			}
		},
		[openNotification],
	)

	// 关闭检测
	const stopPollingPageUpdate = useCallback(() => {
		stop()
	}, [stop])

	// 开启检测
	const startPollingPageUpdate = useCallback(() => {
		// 非生产环境不进行版本更新提示
		if (!isProductionEnv()) return
		stopPollingPageUpdate()
		// 重新计时
		start()
	}, [start, stopPollingPageUpdate])

	const handleVisibilitychange = useCallback(() => {
		if (document.visibilityState === "visible") {
			startPollingPageUpdate()
		} else {
			stopPollingPageUpdate()
		}
	}, [startPollingPageUpdate, stopPollingPageUpdate])

	useEffect(() => {
		// 初始化时，不会触发visibilitychange事件，先主动开启轮询检测
		startPollingPageUpdate()
		document.addEventListener("visibilitychange", handleVisibilitychange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilitychange)
		}
	}, [handleVisibilitychange, startPollingPageUpdate])

	useEffect(() => {
		if (workerRef.current) {
			workerRef.current.port.onmessage = (e) => {
				const data = e.data || {}
				switch (data.type) {
					case ReflectMessageType.REFLECT_GET_LATEST_VERSION:
						handlePageUpdateCheck(data.data)
						break
					case ReflectMessageType.REFLECT_REFRESH:
						// 其他tab页面手动更新，同步更新
						window.location.reload()
						break
					default:
						break
				}
			}
		}
	}, [handlePageUpdateCheck, workerRef])
}

export default useVersion

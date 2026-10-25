import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

export function useCreateMicroApp(
	workspaceId: string | undefined,
	onCreated: (appId: string) => void,
) {
	const { t } = useTranslation("super")
	const [creating, setCreating] = useState(false)
	const pendingRef = useRef(false)

	const createApp = useCallback(async () => {
		if (!workspaceId || pendingRef.current) return
		// 两个入口共用同步保护，避免状态更新前的连续点击重复创建。
		pendingRef.current = true
		setCreating(true)
		try {
			const created = await SuperMagicApi.createMicroAppProject({ workspace_id: workspaceId })
			onCreated(String(created.app_id))
		} catch (error) {
			console.error("Failed to create micro app:", error)
			magicToast.error(t("microAppsPage.createProjectFailed"))
		} finally {
			pendingRef.current = false
			setCreating(false)
		}
	}, [onCreated, t, workspaceId])

	return { createApp, creating }
}

import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { userStore } from "@/models/user"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { getIframeDownloadUrl } from "../iframe-api/iframeApi"
import { htmlMicroAppPreviewLogger } from "../utils/htmlMicroAppPreviewLogger"
import {
	HTML_PERMISSION_GRANTS_CHANGED_EVENT,
	LOCAL_STORAGE_HTML_PERMISSION_GRANT_FALLBACK_KEY,
} from "../iframe-api/services/HtmlPermissionGrantStore"
import { createHtmlPermissionGrantBroadcastChannel } from "../iframe-api/services/HtmlPermissionGrantNotifications"
import { getHtmlPermissionGrantStore } from "../iframe-api/services/IndexedDbHtmlPermissionGrantStore"
import {
	IframePermissionService,
	type HtmlAppConfigState,
	type HtmlPermissionConfirmRequest,
	type HtmlPermissionMissingDeclarationRequest,
} from "../iframe-api/services/IframePermissionService"
import { HtmlPermissionAuthorizationQueue } from "../iframe-api/services/HtmlPermissionAuthorizationQueue"
import type { HTMLAppConfig, HtmlPermissionScope } from "../iframe-api/types"
import { hasManageableHtmlPermissionDeclarations } from "../iframe-api/services/htmlPermissionDeclarations"
import {
	parseHtmlPermissionTtl,
	serializeHtmlPermissionTtl,
	type HtmlPermissionTtl,
} from "../iframe-api/services/htmlPermissionPolicy"
import { requestHtmlPermissionCodeChangeConfirm } from "../components/PermissionManager/CodeChangeConfirmPopover"
import { useHtmlPermissionI18n } from "./useHtmlPermissionI18n"

interface HtmlAppFileItem {
	file_id: string
	relative_file_path: string
	updated_at?: string
}

interface UseHtmlAppPermissionsOptions {
	content: string
	rawSourceCode?: string
	relativeFilePath?: string
	projectId?: string
	fileList: HtmlAppFileItem[]
	enabled?: boolean
	/** Standalone micro app id; when set, authorization is keyed on it instead of the entry file. */
	appId?: string
}

export function shouldShowHtmlPermissionManager(
	hasPermissionDeclarations: boolean,
	activeGrantCount: number,
) {
	return hasPermissionDeclarations || activeGrantCount > 0
}

export function useHtmlAppPermissions({
	content,
	rawSourceCode,
	relativeFilePath,
	projectId,
	fileList,
	enabled = true,
	appId,
}: UseHtmlAppPermissionsOptions) {
	const { t } = useTranslation("super")
	const fileAccess = useFileAccess()
	const { getScopeLabel, getTtlLabel, getUserInfoFieldLabel } = useHtmlPermissionI18n()
	const [grantRevision, setGrantRevision] = useState(0)
	// 服务实例包含当前 HTML 的运行指纹，避免切换文件时短暂复用上一应用的授权数量。
	const [activeGrantState, setActiveGrantState] = useState<{
		service: IframePermissionService | null
		count: number
		codeChanged: boolean
	}>({
		service: null,
		count: 0,
		codeChanged: false,
	})
	const cleanedEntryPath = (relativeFilePath || "").replace(/^\/+/, "")
	const lastSlash = cleanedEntryPath.lastIndexOf("/")
	const appRootDir = lastSlash >= 0 ? cleanedEntryPath.slice(0, lastSlash + 1) : ""

	const htmlAppInstanceKey = useMemo(() => {
		return JSON.stringify({
			projectId: projectId || "",
			appRootDir,
			entryPath: cleanedEntryPath,
		})
	}, [appRootDir, cleanedEntryPath, projectId])

	const [htmlAppConfigStateWithKey, setHtmlAppConfigStateWithKey] = useState<{
		instanceKey: string
		configState: HtmlAppConfigState
	}>({
		instanceKey: "",
		configState: { status: "loading" },
	})

	const htmlAppConfigState = useMemo<HtmlAppConfigState>(
		() =>
			htmlAppConfigStateWithKey.instanceKey === htmlAppInstanceKey
				? htmlAppConfigStateWithKey.configState
				: { status: "loading" },
		[htmlAppConfigStateWithKey, htmlAppInstanceKey],
	)

	const htmlAppConfig = htmlAppConfigState.status === "loaded" ? htmlAppConfigState.config : null
	const hasHtmlPermissionDeclarations =
		htmlAppConfigState.status === "loaded" &&
		hasManageableHtmlPermissionDeclarations(htmlAppConfigState.config)
	const appConfigPath = `${appRootDir}app.json`
	// 普通附件更新不应重新加载 app.json；仅跟踪配置文件自身的身份和版本。
	const appConfigFile = useMemo(
		() =>
			fileList.find((file) => file.relative_file_path?.replace(/^\/+/, "") === appConfigPath),
		[fileList, appConfigPath],
	)
	const appConfigFileId = appConfigFile?.file_id || ""
	const appConfigFileUpdatedAt = appConfigFile?.updated_at || ""

	const userId = userStore.user.userInfo?.user_id?.trim() || ""
	// The entry file id is the stable identity of an ordinary HTML app: it survives edits,
	// renames and moves, while copies and re-created files get a new id.
	const entryFileId = useMemo(() => {
		if (appId) return ""
		return (
			fileList.find(
				(file) => file?.relative_file_path?.replace(/^\/+/, "") === cleanedEntryPath,
			)?.file_id || ""
		)
	}, [appId, cleanedEntryPath, fileList])
	const htmlAppInstance = useMemo(() => {
		return {
			userId,
			projectId: projectId || "",
			appRootDir,
			entryPath: cleanedEntryPath,
			content: rawSourceCode || content || "",
			appId: appId || "",
			entryFileId,
			// Only needed to adopt grants saved by earlier (fingerprint-keyed) versions, so it is
			// computed lazily instead of hashing the whole file list on every update.
			getRuntimeFingerprint: () =>
				JSON.stringify(
					fileList
						.filter((file) => {
							const filePath = file?.relative_file_path || ""
							return (
								isFileInsideHtmlApp(filePath, appRootDir) &&
								isHtmlOrJavaScriptFile(filePath)
							)
						})
						.map((file) => ({
							fileId: file.file_id,
							path: file.relative_file_path.replace(/^\/+/, ""),
							updatedAt: file.updated_at || "",
						}))
						.sort((a, b) => a.path.localeCompare(b.path)),
				),
		}
	}, [
		appId,
		appRootDir,
		cleanedEntryPath,
		content,
		entryFileId,
		fileList,
		projectId,
		rawSourceCode,
		userId,
	])

	const htmlPermissionGrantStore = useMemo(() => getHtmlPermissionGrantStore(), [])
	// Queue lifetime follows the app identity only. File edits must not rebuild it, otherwise an
	// in-flight authorization is aborted every time the user or agent saves a file.
	const htmlPermissionAuthorizationQueue = useMemo(
		() => new HtmlPermissionAuthorizationQueue(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			htmlAppInstanceKey,
			userId,
			htmlAppInstance.appId,
			htmlAppInstance.entryFileId,
			htmlAppConfigState,
			enabled,
		],
	)

	const confirmHtmlPermission = useMemoizedFn(
		({
			appName,
			isLegacy,
			appConfigLoadError,
			scopes,
			reason,
			presentation,
			ttlOptions,
			defaultTtlMs,
			signal,
		}: HtmlPermissionConfirmRequest) =>
			new Promise<{ allowed: boolean; ttlMs: HtmlPermissionTtl }>((resolve) => {
				let settled = false
				const modalRef: { destroy?: () => void } = {}
				const settle = (result: { allowed: boolean; ttlMs: HtmlPermissionTtl }) => {
					if (settled) return
					settled = true
					signal?.removeEventListener("abort", handleAbort)
					modalRef.destroy?.()
					resolve(result)
				}
				const handleAbort = () => settle({ allowed: false, ttlMs: 0 })

				let selectedTtlMs = defaultTtlMs
				const displayAppName = appName || t("htmlEditor.permissionManager.defaultAppName")
				const scopeLabel = scopes
					.map(getScopeLabel)
					.join(t("htmlEditor.permissionAuthorizationConfirm.scopeSeparator"))
				const isUserInfo = presentation === "userInfo"
				const fieldsText = scopes
					.map(getUserInfoFieldLabel)
					.join(t("htmlEditor.userInfoAuthorizationConfirm.fieldSeparator"))
				const contentParams = {
					appName: displayAppName,
					scope: scopeLabel,
					fields: fieldsText,
					reason,
					error: appConfigLoadError,
				}
				let contentText: string
				if (isUserInfo) {
					if (isLegacy && appConfigLoadError) {
						contentText = t(
							"htmlEditor.userInfoAuthorizationConfirm.appConfigUnavailableContent",
							contentParams,
						)
					} else if (isLegacy) {
						contentText = t(
							"htmlEditor.userInfoAuthorizationConfirm.legacyContent",
							contentParams,
						)
					} else if (reason) {
						contentText = t(
							"htmlEditor.userInfoAuthorizationConfirm.content",
							contentParams,
						)
					} else {
						contentText = t(
							"htmlEditor.userInfoAuthorizationConfirm.contentWithoutReason",
							contentParams,
						)
					}
				} else if (isLegacy && appConfigLoadError) {
					contentText = t(
						"htmlEditor.permissionAuthorizationConfirm.appConfigUnavailableContent",
						contentParams,
					)
				} else if (isLegacy) {
					contentText = t(
						"htmlEditor.permissionAuthorizationConfirm.legacyContent",
						contentParams,
					)
				} else if (reason) {
					contentText = t(
						"htmlEditor.permissionAuthorizationConfirm.content",
						contentParams,
					)
				} else {
					contentText = t(
						"htmlEditor.permissionAuthorizationConfirm.contentWithoutReason",
						contentParams,
					)
				}
				const modal = MagicModal.confirm({
					title: isUserInfo
						? t("htmlEditor.userInfoAuthorizationConfirm.title")
						: t("htmlEditor.permissionAuthorizationConfirm.title"),
					content: (
						<div>
							<p>{contentText}</p>
							<p className="mt-3 text-xs text-muted-foreground">
								{t("htmlEditor.permissionAuthorizationConfirm.durationLabel")}
							</p>
							<Select
								defaultValue={serializeHtmlPermissionTtl(defaultTtlMs)}
								onValueChange={(value) => {
									selectedTtlMs = parseHtmlPermissionTtl(value)
								}}
							>
								<SelectTrigger className="mt-3 w-full">
									<SelectValue />
								</SelectTrigger>
								{/*
								 * MagicModal.confirm keeps the desktop dialog implementation on mobile
								 * and raises its content layer dynamically. Keep this permission menu
								 * above that content layer instead of letting it render behind the dialog.
								 */}
								<SelectContent className="!z-[calc(var(--z-index-modal)+100)]">
									{ttlOptions.map((option) => (
										<SelectItem
											key={serializeHtmlPermissionTtl(option.ttlMs)}
											value={serializeHtmlPermissionTtl(option.ttlMs)}
										>
											{getTtlLabel(option.ttlMs)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					),
					okText: isUserInfo
						? t("htmlEditor.userInfoAuthorizationConfirm.allow")
						: t("htmlEditor.permissionAuthorizationConfirm.allow"),
					cancelText: isUserInfo
						? t("htmlEditor.userInfoAuthorizationConfirm.deny")
						: t("htmlEditor.permissionAuthorizationConfirm.deny"),
					closable: false,
					maskClosable: false,
					centered: true,
					onOk: () => settle({ allowed: true, ttlMs: selectedTtlMs }),
					onCancel: () => settle({ allowed: false, ttlMs: 0 }),
				})
				modalRef.destroy = () => modal.destroy()
				if (signal?.aborted) handleAbort()
				else signal?.addEventListener("abort", handleAbort, { once: true })
			}),
	)

	const notifyMissingPermissionDeclaration = useMemoizedFn(
		({ appName, scope }: HtmlPermissionMissingDeclarationRequest) => {
			magicToast.warning({
				key: `html-permission-missing-${scope}`,
				content: t("htmlEditor.permissionAuthorizationConfirm.missingScope", {
					appName: appName || t("htmlEditor.permissionManager.defaultAppName"),
					scope: getScopeLabel(scope),
					rawScope: scope,
				}),
				duration: 4000,
			})
		},
	)
	const notifyGrantsChanged = useMemoizedFn(() => {
		setGrantRevision((revision) => revision + 1)
	})

	useEffect(() => {
		// 不启动常驻定时器；HTML 应用初始化时清理浏览器关闭期间已经过期的授权。
		void htmlPermissionGrantStore.prune(Date.now())
	}, [htmlPermissionGrantStore])

	useEffect(() => {
		// 当前标签页用自定义事件，其他标签页用 BroadcastChannel；两者只刷新 UI，不承担互斥。
		const handlePermissionChange = () => notifyGrantsChanged()
		const handlePermissionStorageChange = (event: StorageEvent) => {
			if (event.key === LOCAL_STORAGE_HTML_PERMISSION_GRANT_FALLBACK_KEY) {
				handlePermissionChange()
			}
		}
		window.addEventListener(HTML_PERMISSION_GRANTS_CHANGED_EVENT, handlePermissionChange)
		window.addEventListener("storage", handlePermissionStorageChange)
		const channel = createHtmlPermissionGrantBroadcastChannel()
		channel?.addEventListener("message", handlePermissionChange)
		return () => {
			window.removeEventListener(HTML_PERMISSION_GRANTS_CHANGED_EVENT, handlePermissionChange)
			window.removeEventListener("storage", handlePermissionStorageChange)
			channel?.removeEventListener("message", handlePermissionChange)
			channel?.close()
		}
	}, [notifyGrantsChanged])

	const htmlPermissionService = useMemo(
		() =>
			new IframePermissionService({
				grantStore: htmlPermissionGrantStore,
				confirmPermission: confirmHtmlPermission,
				onMissingDeclaration: notifyMissingPermissionDeclaration,
				confirmCodeChange: requestHtmlPermissionCodeChangeConfirm,
				onGrantsChanged: notifyGrantsChanged,
				appConfigState: htmlAppConfigState,
				appInstance: htmlAppInstance,
				authorizationQueue: htmlPermissionAuthorizationQueue,
			}),
		[
			confirmHtmlPermission,
			htmlAppConfigState,
			htmlAppInstance,
			htmlPermissionAuthorizationQueue,
			htmlPermissionGrantStore,
			notifyGrantsChanged,
			notifyMissingPermissionDeclaration,
		],
	)

	useEffect(() => {
		return () => htmlPermissionAuthorizationQueue.dispose()
	}, [htmlPermissionAuthorizationQueue])

	const authorizeHtmlPermission = useMemoizedFn(async (scope: HtmlPermissionScope) => {
		return htmlPermissionService.authorize(scope)
	})
	const preauthorizeHtmlPermission = useMemoizedFn(async (scope: HtmlPermissionScope) => {
		return htmlPermissionService.authorize(scope, { allowOnce: false })
	})

	const authorizeHtmlPermissions = useMemoizedFn(
		async (
			scopes: HtmlPermissionScope[],
			options?: Parameters<IframePermissionService["authorizeMany"]>[1],
		) => {
			return htmlPermissionService.authorizeMany(scopes, options)
		},
	)

	const getPermissionSnapshot = useMemoizedFn(() => htmlPermissionService.getPermissionSnapshot())

	const revokeHtmlPermission = useMemoizedFn(async (scope: HtmlPermissionScope) => {
		return htmlPermissionService.revoke(scope)
	})

	const updateHtmlPermissionTtl = useMemoizedFn(
		async (scope: HtmlPermissionScope, ttlMs: HtmlPermissionTtl) => {
			return htmlPermissionService.updateGrantTtl(scope, ttlMs)
		},
	)

	const revokeAllHtmlPermissions = useMemoizedFn(async () => {
		return htmlPermissionService.revokeAll()
	})
	const acknowledgeHtmlPermissionCodeChanges = useMemoizedFn(async () => {
		return htmlPermissionService.acknowledgeCodeChanges()
	})

	useEffect(() => {
		let cancelled = false

		if (!enabled || htmlAppConfigState.status === "loading") {
			setActiveGrantState({ service: htmlPermissionService, count: 0, codeChanged: false })
			return
		}

		void htmlPermissionService
			.getPermissionSnapshot()
			.then((snapshot) => {
				if (cancelled) return
				setActiveGrantState({
					service: htmlPermissionService,
					count: snapshot.activeGrantCount,
					codeChanged:
						snapshot.codeChangedGrantCount > 0 || snapshot.needsReconfirmCount > 0,
				})
			})
			.catch((error) => {
				if (cancelled) return
				setActiveGrantState({
					service: htmlPermissionService,
					count: 0,
					codeChanged: false,
				})
				htmlMicroAppPreviewLogger.warn("Failed to read active permission grants", {
					error,
				})
			})

		return () => {
			cancelled = true
		}
	}, [enabled, grantRevision, htmlAppConfigState.status, htmlPermissionService])

	useEffect(() => {
		let cancelled = false
		setHtmlAppConfigStateWithKey({
			instanceKey: htmlAppInstanceKey,
			configState: { status: "loading" },
		})
		if (!enabled) {
			setHtmlAppConfigStateWithKey({
				instanceKey: htmlAppInstanceKey,
				configState: { status: "absent" },
			})
			return
		}
		if (!appConfigFileId) {
			setHtmlAppConfigStateWithKey({
				instanceKey: htmlAppInstanceKey,
				configState: { status: "absent" },
			})
			return
		}

		getIframeDownloadUrl([appConfigFileId], fileAccess)
			.then(async (urls) => {
				const url = urls?.[0]?.url
				if (!url) throw new Error("Failed to get app.json download URL")
				const response = await fetch(url)
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const config = (await response.json()) as HTMLAppConfig
				if (cancelled) return
				if (config && typeof config === "object" && !Array.isArray(config)) {
					setHtmlAppConfigStateWithKey({
						instanceKey: htmlAppInstanceKey,
						configState: { status: "loaded", config },
					})
					return
				}
				setHtmlAppConfigStateWithKey({
					instanceKey: htmlAppInstanceKey,
					configState: { status: "error", error: "Invalid app.json" },
				})
				htmlMicroAppPreviewLogger.error({
					eventKey: "invalid_app_json_failed",
					errorKind: "permission",
					message: "Invalid app.json",
					context: { appConfigPath },
				})
			})
			.catch((error) => {
				if (cancelled) return
				const errorMessage = error instanceof Error ? error.message : String(error)
				setHtmlAppConfigStateWithKey({
					instanceKey: htmlAppInstanceKey,
					configState: { status: "error", error: errorMessage },
				})
				htmlMicroAppPreviewLogger.error({
					eventKey: "load_app_json_failed",
					errorKind: "permission",
					message: "Failed to load app.json",
					context: { appConfigPath, errorMessage },
				})
			})

		return () => {
			cancelled = true
		}
	}, [appConfigFileId, appConfigFileUpdatedAt, appConfigPath, enabled, htmlAppInstanceKey])

	return {
		htmlAppConfig,
		htmlAppConfigState,
		isLegacyHtmlPermissionMode:
			htmlAppConfigState.status === "absent" || htmlAppConfigState.status === "error",
		hasHtmlPermissionDeclarations,
		activeHtmlPermissionGrantCount:
			activeGrantState.service === htmlPermissionService ? activeGrantState.count : 0,
		// Drives the dot on the permission button: grants exist whose app code changed afterwards.
		htmlPermissionCodeChanged:
			activeGrantState.service === htmlPermissionService && activeGrantState.codeChanged,
		htmlAppInstanceKey,
		authorizeHtmlPermission,
		preauthorizeHtmlPermission,
		authorizeHtmlPermissions,
		getPermissionSnapshot,
		revokeHtmlPermission,
		updateHtmlPermissionTtl,
		revokeAllHtmlPermissions,
		acknowledgeHtmlPermissionCodeChanges,
		permissionRevision: `${htmlAppInstanceKey}:${htmlAppConfigState.status}:${grantRevision}`,
	}
}

function isFileInsideHtmlApp(path: string, appRootDir: string): boolean {
	const normalizedPath = path.replace(/^\/+/, "")
	return normalizedPath.startsWith(appRootDir)
}

function isHtmlOrJavaScriptFile(path: string): boolean {
	// 只有会执行 Magic API 的 HTML/JS 文件影响运行时指纹，资源、配置和数据文件变化不应使授权失效。
	return /\.(?:html?|(?:c|m)?js)$/i.test(path.split(/[?#]/, 1)[0])
}

export type HtmlAppPermissionController = ReturnType<typeof useHtmlAppPermissions>

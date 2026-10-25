import { createStyles } from "antd-style"
import { useEffect, useRef, useMemo, useState } from "react"
import { Flex } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { env } from "@/utils/env"
import {
	findDataJsFile,
	extractCardsFromDataJs,
	saveDashboardAndDataJs,
	validateDashboardCards,
	injectDashboardHTMLScript,
	type DashboardCard,
	type DataJsFileInfo,
} from "./utils"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { decodeHTMLEntities } from "../utils/full-content"
import { getHtmlSandboxRuntimeUrl } from "../utils/html-sandbox-runtime-url"
import {
	getDevicePreviewScrollbarsScript,
	syncDevicePreviewScrollbars,
} from "../utils/device-preview-scrollbars"
import {
	buildHtmlVirtualStorageNamespace,
	createVirtualStorageContext,
	getVirtualStorageBridgeScript,
	virtualStorageRegistry,
	type VirtualStorageRuntimeContext,
} from "../utils/virtual-storage"

/** 与 iframe 内 dashboard 的 configManager.setRenderMode 对齐：mobile / desktop / auto（默认由页面自身决定） */
export type DashboardIframeRenderMode = "mobile" | "desktop" | "auto"

interface IsolatedHTMLRendererProps {
	content: string
	className?: string
	isEditMode?: boolean
	/** 预览模式：头部切到手机框时传 mobile，桌面预览传 desktop；不传则不向子页同步（保持 auto） */
	dashboardRenderMode?: DashboardIframeRenderMode
	devicePreviewEnabled?: boolean
	onSaveReady?: (triggerSave: () => void) => void
	// 添加必要的props来获取文件信息
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	currentFileId?: string
	currentFileName?: string
	projectId?: string
}

const useStyles = createStyles(({ css }) => ({
	rendererContainer: css`
		width: 100%;
		height: 100%;
		overflow: auto;
	`,
	iframe: css`
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	`,
	loadingContainer: css`
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
}))

function IsolatedHTMLRenderer({
	content,
	className,
	isEditMode,
	dashboardRenderMode,
	devicePreviewEnabled = false,
	onSaveReady,
	attachments,
	attachmentList,
	currentFileId,
	currentFileName,
	projectId,
}: IsolatedHTMLRendererProps) {
	const { styles, cx } = useStyles()
	const fileApi = useFileApi()
	const externalRenderSiteUrl = useMemo(() => env("MAGIC_HTML_SANDBOX_URL"), [])
	const htmlSandboxRuntimeUrl = useMemo(() => getHtmlSandboxRuntimeUrl(), [])
	const htmlSandboxShellUrl = useMemo(
		() => externalRenderSiteUrl || "/husky.html",
		[externalRenderSiteUrl],
	)
	const externalRenderSiteOrigin = useMemo(() => {
		if (!externalRenderSiteUrl) return ""
		try {
			return new URL(externalRenderSiteUrl).origin
		} catch {
			return ""
		}
	}, [externalRenderSiteUrl])

	const lastInjectedContentRef = useRef<string>("")
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const dashboardCards = useRef<DashboardCard[]>([])
	const hasDashboardCardsSnapshot = useRef(false)
	const dataJsFileInfo = useRef<DataJsFileInfo | null>(null)
	const [iframeLoaded, setIframeLoaded] = useState(false)
	const [virtualStorageContext, setVirtualStorageContext] =
		useState<VirtualStorageRuntimeContext | null>(null)

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return
		// Legacy fullscreen attributes for old WebKit/Firefox engines.
		iframe.setAttribute("allowfullscreen", "true")
		iframe.setAttribute("webkitallowfullscreen", "true")
		iframe.setAttribute("mozallowfullscreen", "true")
	}, [])

	const contentTrim = useMemo(() => {
		return content.trim()
	}, [content])

	const dashboardContent = useMemo(() => {
		const decodedDashboardHtml = decodeHTMLEntities(injectDashboardHTMLScript(contentTrim))
		if (!virtualStorageContext) return ""

		const parser = new DOMParser()
		const doc = parser.parseFromString(decodedDashboardHtml, "text/html")
		if (!doc.head) {
			const head = doc.createElement("head")
			doc.documentElement.insertBefore(head, doc.body)
		}

		const script = doc.createElement("script")
		script.setAttribute("data-injected", "magic-virtual-storage")
		script.textContent = getVirtualStorageBridgeScript(virtualStorageContext)
		doc.head.insertBefore(script, doc.head.firstChild)
		const devicePreviewScript = doc.createElement("script")
		devicePreviewScript.setAttribute("data-injected", "magic-device-preview")
		devicePreviewScript.textContent = getDevicePreviewScrollbarsScript(window.location.origin)
		doc.head.appendChild(devicePreviewScript)

		return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
	}, [contentTrim, virtualStorageContext])

	useEffect(() => {
		let cancelled = false
		const namespace = buildHtmlVirtualStorageNamespace({
			projectId,
			fileId: currentFileId,
		})

		setVirtualStorageContext(null)
		void createVirtualStorageContext({
			namespace,
			targetOrigin: window.location.origin,
		}).then((context) => {
			if (!cancelled) setVirtualStorageContext(context)
		})

		return () => {
			cancelled = true
		}
	}, [currentFileId, projectId])

	useEffect(() => {
		if (!virtualStorageContext) return
		const iframeWindow = iframeRef.current?.contentWindow
		if (!iframeWindow) return

		const registeredContext = {
			...virtualStorageContext,
			source: iframeWindow,
			origin: externalRenderSiteOrigin || window.location.origin,
			expiresAt: undefined,
		}
		virtualStorageRegistry.register(registeredContext)
		return () => virtualStorageRegistry.unregister(registeredContext)
	}, [externalRenderSiteOrigin, iframeLoaded, virtualStorageContext])

	// 加载data.js文件
	const loadDataJsFile = async () => {
		if (!attachments || !attachmentList || !currentFileId || !currentFileName) {
			return
		}

		try {
			const fileInfo = await findDataJsFile({
				attachments,
				attachmentList,
				currentFileId,
				currentFileName,
				fileApi,
			})

			if (fileInfo) {
				dataJsFileInfo.current = fileInfo
				const cards = extractCardsFromDataJs(fileInfo.content).filter(
					(card): card is DashboardCard => validateDashboardCards([card]),
				)

				if (!hasDashboardCardsSnapshot.current && cards.length > 0) {
					dashboardCards.current = cards
					hasDashboardCardsSnapshot.current = true
				}
			}
		} catch (error) {
			console.error("Error loading data.js file:", error)
		}
	}

	// 保存dashboard配置和data.js文件
	const saveDashboardConfiguration = async () => {
		try {
			if (!hasDashboardCardsSnapshot.current) {
				return
			}
			// 验证dashboard cards数据
			if (!validateDashboardCards(dashboardCards.current)) {
				return
			}
			await saveDashboardAndDataJs({
				dashboardCards: dashboardCards.current,
				dataJsFileInfo: dataJsFileInfo.current,
			})
		} catch (error) {
			console.error("Failed to save dashboard configuration:", error)
		}
	}

	// 注册保存回调
	useEffect(() => {
		onSaveReady?.(() => {
			if (dataJsFileInfo.current) {
				saveDashboardConfiguration()
			}
		})
	}, [onSaveReady])

	// 加载 data.js 文件
	useEffect(() => {
		void loadDataJsFile()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attachments, attachmentList, currentFileId, currentFileName, fileApi])

	// 初始化 iframe 入口：同源与跨域都先加载 sandbox shell，再通过 setContent 注入业务 HTML。
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return

		setIframeLoaded(false)
		lastInjectedContentRef.current = ""
		if (iframe.getAttribute("src") !== htmlSandboxShellUrl) {
			iframe.setAttribute("src", htmlSandboxShellUrl)
		}
	}, [htmlSandboxShellUrl])

	// sandbox shell 准备好后通过 setContent 注入业务 HTML；同源/跨域共用同一条链路。
	useEffect(() => {
		if (!dashboardContent) return
		if (!iframeLoaded) return
		if (lastInjectedContentRef.current === dashboardContent) return

		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "setContent",
				content: dashboardContent,
				runtimeUrl: htmlSandboxRuntimeUrl,
			},
			externalRenderSiteOrigin || "*",
		)
		lastInjectedContentRef.current = dashboardContent
	}, [dashboardContent, externalRenderSiteOrigin, htmlSandboxRuntimeUrl, iframeLoaded])

	// 接收子容器消息
	useEffect(() => {
		const callback = (event: MessageEvent) => {
			if (event.source !== iframeRef.current?.contentWindow) return
			if (
				event.data?.type === "contentLoaded" &&
				event.origin === (externalRenderSiteOrigin || window.location.origin)
			) {
				syncDevicePreviewScrollbars(
					iframeRef.current,
					externalRenderSiteOrigin || window.location.origin,
					devicePreviewEnabled,
				)
				return
			}
			if (event.data?.type === "iframeReady") {
				setIframeLoaded(true)
				return
			}
			if (
				event.data?.type === "pageLoaded" &&
				(externalRenderSiteOrigin ? event.origin === externalRenderSiteOrigin : true)
			) {
				setIframeLoaded(true)
				return
			}
			if (event.data && event.data.type === "DashboardCardsChange") {
				if (!validateDashboardCards(event.data.detail)) return
				dashboardCards.current = event.data.detail
				hasDashboardCardsSnapshot.current = true
			}
		}
		window.addEventListener("message", callback)
		return () => {
			window.removeEventListener("message", callback)
		}
	}, [externalRenderSiteOrigin, devicePreviewEnabled])

	// 只同步原生条的显示，不能让设备模式变化触发 dashboardContent 重建。
	useEffect(() => {
		syncDevicePreviewScrollbars(
			iframeRef.current,
			externalRenderSiteOrigin || window.location.origin,
			devicePreviewEnabled,
		)
	}, [devicePreviewEnabled, externalRenderSiteOrigin])

	// 发送消息给子容器，编辑状态变更后
	useEffect(() => {
		if (!iframeLoaded) return
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "editModeChange",
				isEditMode,
			},
			externalRenderSiteOrigin || "*",
		)
	}, [externalRenderSiteOrigin, iframeLoaded, isEditMode])

	// 与头部预览模式同步：手机框 → mobile，桌面 → desktop（子页内调用 configManager.setRenderMode）
	useEffect(() => {
		if (dashboardRenderMode === undefined) return
		if (!iframeLoaded) return
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "renderModeChange",
				renderMode: dashboardRenderMode,
			},
			externalRenderSiteOrigin || "*",
		)
	}, [dashboardRenderMode, externalRenderSiteOrigin, iframeLoaded])

	if (!contentTrim) {
		return (
			<div className={cx(styles.rendererContainer, styles.loadingContainer, className)}>
				<Flex
					vertical
					align="center"
					justify="center"
					style={{ width: "100%", height: "100%" }}
				>
					<MagicSpin spinning />
				</Flex>
			</div>
		)
	}

	return (
		<div className={cx(styles.rendererContainer, className)}>
			<iframe
				ref={iframeRef}
				className={styles.iframe}
				title="HTML Content"
				src={htmlSandboxShellUrl}
				sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
				allow="fullscreen; autoplay; microphone; camera; picture-in-picture; encrypted-media; web-share; clipboard-write"
				allowFullScreen
				data-testid="html-content-iframe"
			/>
		</div>
	)
}

export default IsolatedHTMLRenderer

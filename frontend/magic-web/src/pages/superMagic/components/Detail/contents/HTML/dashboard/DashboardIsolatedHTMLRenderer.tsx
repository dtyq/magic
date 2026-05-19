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
import { decodeHTMLEntities } from "../utils/full-content"

/** 与 iframe 内 dashboard 的 configManager.setRenderMode 对齐：mobile / desktop / auto（默认由页面自身决定） */
export type DashboardIframeRenderMode = "mobile" | "desktop" | "auto"

interface IsolatedHTMLRendererProps {
	content: string
	className?: string
	isEditMode?: boolean
	/** 预览模式：头部切到手机框时传 mobile，桌面预览传 desktop；不传则不向子页同步（保持 auto） */
	dashboardRenderMode?: DashboardIframeRenderMode
	onSaveReady?: (triggerSave: () => void) => void
	// 添加必要的props来获取文件信息
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	currentFileId?: string
	currentFileName?: string
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
	onSaveReady,
	attachments,
	attachmentList,
	currentFileId,
	currentFileName,
}: IsolatedHTMLRendererProps) {
	const { styles, cx } = useStyles()
	const renderSiteUrl = useMemo(() => env("MAGIC_HTML_SANDBOX_URL"), [])
	const renderSiteOrigin = useMemo(() => {
		if (!renderSiteUrl) return ""
		try {
			return new URL(renderSiteUrl).origin
		} catch {
			return ""
		}
	}, [renderSiteUrl])

	const loadedRef = useRef(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const dashboardCards = useRef<DashboardCard[]>([])
	const hasDashboardCardsSnapshot = useRef(false)
	const dataJsFileInfo = useRef<DataJsFileInfo | null>(null)
	const [iframeLoaded, setIframeLoaded] = useState(false)

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
		return decodeHTMLEntities(injectDashboardHTMLScript(contentTrim))
	}, [contentTrim])

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
	}, [attachments, attachmentList, currentFileId, currentFileName])

	// 初始化 iframe 入口：跨域走渲染站，非跨域沿用同域 document.write
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return

		if (renderSiteUrl) {
			if (iframe.src !== renderSiteUrl) {
				iframe.src = renderSiteUrl
			}
			setIframeLoaded(false)
			loadedRef.current = false
			return
		}

		const doc = iframe.contentDocument
		if (!doc || loadedRef.current || !dashboardContent) return

		doc.open()
		doc.write(dashboardContent)
		doc.close()
		loadedRef.current = true
		setIframeLoaded(true)
	}, [dashboardContent, renderSiteUrl])

	// 跨域渲染站准备好后通过 setContent 注入业务 HTML
	useEffect(() => {
		if (!renderSiteUrl || !dashboardContent) return
		if (!iframeLoaded) return

		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "setContent",
				content: dashboardContent,
			},
			"*",
		)
	}, [dashboardContent, iframeLoaded, renderSiteUrl])

	// 接收子容器消息
	useEffect(() => {
		const callback = (event: MessageEvent) => {
			if (event.source !== iframeRef.current?.contentWindow) return
			if (event.data?.type === "iframeReady") {
				setIframeLoaded(true)
				return
			}
			if (
				event.data?.type === "pageLoaded" &&
				renderSiteOrigin &&
				event.origin === renderSiteOrigin
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
	}, [renderSiteOrigin])

	// 发送消息给子容器，编辑状态变更后
	useEffect(() => {
		if (!iframeLoaded) return
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "editModeChange",
				isEditMode,
			},
			"*",
		)
	}, [iframeLoaded, isEditMode])

	// 与头部预览模式同步：手机框 → mobile，桌面 → desktop（子页内调用 configManager.setRenderMode）
	useEffect(() => {
		if (dashboardRenderMode === undefined) return
		if (!iframeLoaded) return
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "renderModeChange",
				renderMode: dashboardRenderMode,
			},
			"*",
		)
	}, [dashboardRenderMode, iframeLoaded])

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
				src={renderSiteUrl || undefined}
				sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
				allow="fullscreen"
				allowFullScreen
			/>
		</div>
	)
}

export default IsolatedHTMLRenderer

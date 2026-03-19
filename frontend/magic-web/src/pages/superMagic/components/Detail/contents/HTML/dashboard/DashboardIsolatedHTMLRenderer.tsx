import { createStyles } from "antd-style"
import { useEffect, useRef, useMemo } from "react"
import { Flex } from "antd"
import MagicSpin from "@/components/base/MagicSpin"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	findDataJsFile,
	saveDashboardAndDataJs,
	validateDashboardCards,
	injectDashboardHTMLScript,
	type DashboardCard,
	type DataJsFileInfo,
} from "./utils"
import { decodeHTMLEntities } from "../utils/full-content"

interface IsolatedHTMLRendererProps {
	content: string
	className?: string
	isEditMode?: boolean
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
	onSaveReady,
	attachments,
	attachmentList,
	currentFileId,
	currentFileName,
}: IsolatedHTMLRendererProps) {
	const { styles, cx } = useStyles()

	const loadedRef = useRef(false)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const dashboardCards = useRef<DashboardCard[]>([])
	const dataJsFileInfo = useRef<DataJsFileInfo | null>(null)

	const contentTrim = useMemo(() => {
		return content.trim()
	}, [content])

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
			}
		} catch (error) {
			console.error("Error loading data.js file:", error)
		}
	}

	// 保存dashboard配置和data.js文件
	const saveDashboardConfiguration = async () => {
		try {
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

	// 内容挂载到iframe
	useEffect(() => {
		if (!contentTrim) return
		const doc = iframeRef.current?.contentDocument
		if (!doc || loadedRef.current) return

		const decodedContent = decodeHTMLEntities(injectDashboardHTMLScript(contentTrim))
		doc.open()
		doc.write(decodedContent)
		doc.close()
		loadedRef.current = true

		// 加载data.js文件
		loadDataJsFile()

		// 注册保存回调
		onSaveReady?.(() => {
			if (dataJsFileInfo.current) {
				saveDashboardConfiguration()
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [contentTrim, onSaveReady, attachments, attachmentList, currentFileId, currentFileName])

	// 接收子容器消息
	useEffect(() => {
		const callback = (event: MessageEvent) => {
			if (event.data && event.data.type === "DashboardCardsChange") {
				dashboardCards.current = event.data.detail
			}
		}
		window.addEventListener("message", callback)
		return () => {
			window.removeEventListener("message", callback)
		}
	}, [])

	// 发送消息给子容器，编辑状态变更后
	useEffect(() => {
		iframeRef.current?.contentWindow?.postMessage(
			{
				type: "editModeChange",
				isEditMode,
			},
			"*",
		)
	}, [isEditMode])

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
				sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
			/>
		</div>
	)
}

export default IsolatedHTMLRenderer

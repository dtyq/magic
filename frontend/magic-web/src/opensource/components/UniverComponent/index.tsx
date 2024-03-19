import { useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react"
import { useUnmount, useSafeState, useMount } from "ahooks"
import { useTranslation } from "react-i18next"

import { UniverRenderer, type UniverRendererConfig } from "./UniverRenderer"
import {
	SupportedFileTypeMap,
	type ComponentMode,
	type ExportConfigType,
	type UniverComponentNewProps,
} from "./types"
import type { IDocumentData, IWorkbookData } from "@univerjs/core"

import "./styles.css"

export interface UniverComponentRef {
	getDocxData: () => Partial<IDocumentData> | null
	getDocxBuffer: () => Promise<ArrayBuffer | null>
	getWorksheetBuffer: () => Promise<ArrayBuffer | null>
	getWorksheetData: () => Partial<IWorkbookData> | null
	exportToExcel: (config: ExportConfigType) => Promise<void>
	exportToDocx: (config: ExportConfigType) => Promise<void>
	setMode: (mode: "readonly" | "edit") => void
}

/**  Univer 组件 - 支持 Sheet、Doc、Slide */
const UniverComponent = forwardRef<UniverComponentRef, UniverComponentNewProps>((props, ref) => {
	const {
		type = SupportedFileTypeMap.sheet,
		data,
		width = "100%",
		height = "100%",
		mode = "readonly",
		onDataChange,
		fullUpdate = true,
		loadingFallback = null,
	} = props
	const { t } = useTranslation("interface")
	const [loading, setLoading] = useSafeState(true)
	const [error, setError] = useSafeState<string | null>(null)

	const containerRef = useRef<HTMLDivElement>(null)
	const rendererRef = useRef<UniverRenderer | null>(null)
	const isInitializedRef = useRef(false)
	const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// 暴露给父组件的方法
	useImperativeHandle(ref, () => ({
		getDocxData: () => {
			return rendererRef.current?.getDocxData() || null
		},
		getDocxBuffer: async (): Promise<ArrayBuffer | null> => {
			if (rendererRef.current) {
				return (await rendererRef.current.getDocxBuffer()) || null
			}
			return null
		},
		getWorksheetData: () => {
			return rendererRef.current?.getWorksheetData() || null
		},
		exportToExcel: async (config: ExportConfigType) => {
			if (rendererRef.current) {
				await rendererRef.current.exportToExcel(config)
			}
		},
		exportToDocx: async (config: ExportConfigType) => {
			if (rendererRef.current) {
				await rendererRef.current.exportToDocx(config)
			}
		},
		setMode: (mode: ComponentMode) => {
			if (rendererRef.current) {
				rendererRef.current.setMode(mode)
			}
		},
		getWorksheetBuffer: async (): Promise<ArrayBuffer | null> => {
			if (rendererRef.current) {
				return (await rendererRef.current.getWorksheetBuffer()) || null
			}
			return null
		},
	}))
	useEffect(() => {
		if (!isInitializedRef.current || !rendererRef.current) {
			return
		}

		// 区分文件导入和数据更新
		if (data instanceof File) {
			// 文件导入：全量替换
			rendererRef.current.loadFile(data).catch((error) => {
				console.error("导入文件失败:", error)
				setError(error instanceof Error ? error.message : "导入失败")
			})
		} else {
			// JSON 数据更新：根据类型选择更新方法
			if (type === SupportedFileTypeMap.doc) {
				// Doc 类型使用 updateDocData
				rendererRef.current.updateDocData(data).catch((error) => {
					console.error("更新文档数据失败:", error)
				})
			} else {
				// Sheet 类型使用 updateWorksheetData
				rendererRef.current.updateWorksheetData(data, { fullUpdate }).catch((error) => {
					console.error("更新表格数据失败:", error)
				})
			}
		}
	}, [data, type, fullUpdate, setError])

	useEffect(() => {
		if (rendererRef.current) {
			rendererRef.current.setMode(mode)
		}
	}, [mode])
	/** 清理渲染器实例 */
	const disposeRenderer = useCallback(() => {
		if (rendererRef.current && !rendererRef.current.isDisposed()) {
			rendererRef.current.dispose()
			rendererRef.current = null
		}
	}, [])

	/** 初始化渲染器 */
	const initializeRenderer = useCallback(async () => {
		if (!containerRef.current) return
		if (isInitializedRef.current && !error) return

		isInitializedRef.current = true

		try {
			setLoading(true)
			setError(null)
			disposeRenderer()

			const config: UniverRendererConfig = {
				type,
				container: containerRef.current,
				mode,
				data,
				onDataChange,
			}

			const renderer = new UniverRenderer(config, {
				onInitialized: () => {
					setLoading(false)
				},
				onError: (errorMessage) => {
					setError(errorMessage)
					setLoading(false)
					isInitializedRef.current = false
				},
			})

			rendererRef.current = renderer
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "初始化失败"
			setError(errorMessage)
			setLoading(false)
			isInitializedRef.current = false
		}
	}, [error, setLoading, setError, disposeRenderer, type, mode, data, onDataChange])

	useMount(() => {
		if (cleanupTimeoutRef.current) {
			clearTimeout(cleanupTimeoutRef.current)
			cleanupTimeoutRef.current = null
		}
		initializeRenderer()
	})

	useUnmount(() => {
		const cleanup = () => {
			disposeRenderer()
			isInitializedRef.current = false
			cleanupTimeoutRef.current = null
		}

		if (process.env.NODE_ENV === "development") {
			cleanupTimeoutRef.current = setTimeout(cleanup, 200)
		} else {
			cleanup()
		}
	})

	if (error) {
		return (
			<div className="univer-new-error-container" style={{ width, height }}>
				<div className="univer-new-error">
					<h3>{t("common.loadFailed", "加载失败")}</h3>
					<p>{error}</p>
				</div>
			</div>
		)
	}

	return (
		<div className="univer-new-wrapper" style={{ width, height }}>
			{loading && (
				<div className="univer-new-loading" style={{ padding: "16px" }}>
					{loadingFallback}
				</div>
			)}
			<div
				ref={containerRef}
				className="univer-new-container"
				style={{
					width: "100%",
					height: "100%",
					opacity: loading ? 0 : 1,
					visibility: loading ? "hidden" : "visible",
					transition: loading ? "none" : "opacity 0.1s ease",
				}}
			/>
		</div>
	)
})

export default UniverComponent

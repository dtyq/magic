import React, { useEffect, useRef, useState, Suspense } from "react"
import { Button, Spin } from "antd"
import { useTranslation } from "react-i18next"
import { useAsyncEffect } from "ahooks"

// Style imports
import "./styles.css"

// Utility functions and lazy loading manager
import { loadUniverModulesByFileType } from "./lazy-loader"
import { transformData } from "./utils/transformUtils"
import { createBorderTestWorkbook } from "./utils/testUtils"

// Export component interface
export interface UniverComponentProps {
	data: any
	fileType: "sheet" | "slide" | "doc"
	fileName: string
	width?: number | string
	height?: number | string
	mode?: "readonly" | "edit"
	testMode?: "border-merge" | "enhanced-style" | false // 添加增强样式测试模式
}

/**
 * LazyUniverCore - Core component using lazy loading manager
 */
const LazyUniverCore: React.FC<UniverComponentProps> = ({
	data,
	fileType,
	fileName,
	width = "100%",
	height = "100%",
	testMode = false,
}) => {
	const { t } = useTranslation("interface")
	const containerRef = useRef<HTMLDivElement>(null)
	const univerAPIRef = useRef<any>(null)

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [univerModules, setUniverModules] = useState<any>(null)
	const [initialized, setInitialized] = useState(false)

	// Internationalized file name
	const finalFileName = fileName || t("common.untitledFile", "未命名文件")

	// Use test data if in test mode
	const finalData = testMode === "border-merge" ? createBorderTestWorkbook() : data

	// Cleanup resources
	useEffect(() => {
		return () => {
			if (univerAPIRef.current) {
				try {
					univerAPIRef.current.dispose()
					univerAPIRef.current = null
				} catch (e) {
					console.warn("Warning occurred while cleaning up Univer instance:", e)
				}
			}
		}
	}, [])

	// Step 1: Dynamically load Univer modules
	useAsyncEffect(async () => {
		if (!containerRef.current || univerModules) return

		try {
			setLoading(true)
			setError(null)

			console.log(`🚀 Starting on-demand loading of ${fileType} related Univer modules...`)

			const modules = await loadUniverModulesByFileType(fileType)
			setUniverModules(modules)

			console.log(`✅ ${fileType} related Univer modules loaded successfully`)
		} catch (err: any) {
			console.error("❌ Failed to dynamically load Univer modules:", err)
			setError(err.message || t("common.loadModuleError", "模块加载失败"))
			setLoading(false)
		}
	}, [fileType])

	// Step 2: Initialize Univer instance
	useAsyncEffect(async () => {
		if (!containerRef.current || !univerModules || initialized) return

		try {
			setLoading(true)
			setError(null)

			// Dispose existing instance if any
			if (univerAPIRef.current) {
				univerAPIRef.current.dispose()
				univerAPIRef.current = null
			}

			// Transform data to Univer supported format
			const univerData = await transformData(finalData, fileType, finalFileName)

			console.log("🔧 Starting Univer instance initialization...", {
				univerData,
				fileType,
				fileName: finalFileName,
			})

			// Destructure required classes and functions from lazy-loaded modules
			const {
				Univer,
				LocaleType,
				merge,
				defaultTheme,
				UniverUIPlugin,
				UniverSheetsPlugin,
				UniverSheetsUIPlugin,
				UniverDocsPlugin,
				UniverDocsUIPlugin,
				FUniver,
				DesignZhCN,
				UIZhCN,
				SheetsZhCN,
				SheetsUIZhCN,
				DocsUIZhCN,
				overrideLocales,
			} = univerModules

			console.log(univerModules)

			// Create Univer instance
			const univer = new Univer({
				locale: LocaleType.ZH_CN,
				locales: {
					[LocaleType.ZH_CN]: merge(
						{},
						DesignZhCN.default,
						UIZhCN.default,
						SheetsZhCN.default,
						SheetsUIZhCN.default,
						DocsUIZhCN.default,
						overrideLocales.default["zh-CN"],
					),
				},
				theme: defaultTheme,
			})

			const univerAPI = FUniver.newAPI(univer)

			// Register plugins
			univer.registerPlugin(UniverUIPlugin, {
				container: containerRef.current,
			})
			univer.registerPlugin(UniverDocsPlugin)
			univer.registerPlugin(UniverDocsUIPlugin)

			univer.registerPlugin(UniverSheetsPlugin)
			univer.registerPlugin(UniverSheetsUIPlugin, {
				menu: {
					"sheet.command.set-range-bold": { hidden: true },
					"sheet.command.set-range-italic": { hidden: true },
					"sheet.menu.paste-special": { hidden: true },
					"sheet.command.paste": { hidden: true },
					"sheet.menu.clear-selection": { hidden: true },
					"sheet.contextMenu.permission": { hidden: true },
					"sheet.operation.insert-hyper-link": { hidden: true },
					"sheet.menu.sheet-frozen": { hidden: true },
				},
			})

			// Create corresponding document instance based on file type
			switch (fileType) {
				case "sheet": {
					if (univerData) {
						univerAPI.createWorkbook(univerData)
						const permission = univerAPI.getWorkbook(univerData.id)?.getPermission()
						const workbookId = univerAPI.getWorkbook(univerData.id)?.getId()
						if (workbookId && permission) {
							permission.setWorkbookPermissionPoint(
								workbookId,
								permission.permissionPointsDefinition.WorkbookEditablePermission,
								false,
							)
						}
					}
					break
				}
				case "doc": {
					// TODO: Implement document creation
					console.log("Document type not yet implemented")
					break
				}
				case "slide": {
					// TODO: Implement slide creation
					console.log("Slide type not yet implemented")
					break
				}
				default:
					throw new Error(
						`${t("common.unsupportedFileType", "不支持的文件类型")}: ${fileType}`,
					)
			}

			// Save API reference
			univerAPIRef.current = univerAPI
			setInitialized(true)
			setLoading(false)

			// Set global flag indicating Univer library is loaded
			if (typeof window !== "undefined") {
				;(window as any).__UNIVER_LIBRARIES_LOADED__ = true
			}

			console.log("✅ Univer instance initialization completed")
		} catch (err: any) {
			console.error("❌ Failed to initialize Univer component:", err)
			setError(err.message || t("common.loadFileFailed", "加载文件失败"))
			setLoading(false)
		}
	}, [univerModules, finalData, fileType, finalFileName, initialized])

	// Set page scroll behavior
	useEffect(() => {
		document.documentElement.style.overscrollBehaviorX = "none"
		return () => {
			document.documentElement.style.overscrollBehaviorX = ""
		}
	}, [])

	// Render error state
	if (error) {
		return (
			<div className="univer-error-container" style={{ width, height }}>
				<div className="univer-error">
					<h3>{t("common.loadFailed", "加载失败")}</h3>
					<p>{error}</p>
					<Button type="primary" onClick={() => window.location.reload()}>
						{t("button.reload", "重新加载")}
					</Button>
				</div>
			</div>
		)
	}

	// Render main container
	return (
		<div className="univer-component-wrapper" style={{ width, height }}>
			{loading && (
				<div className="univer-loading-container">
					<Spin size="large" />
					<div style={{ marginTop: 16, color: "#666" }}>
						{t("common.loading", "加载中")}...
					</div>
				</div>
			)}
			<div
				ref={containerRef}
				className="univer-container"
				style={{
					width: "100%",
					height: "100%",
					visibility: loading ? "hidden" : "visible",
				}}
			/>
		</div>
	)
}

/**
 * LazyUniverComponent - Univer component based on lazy loading manager
 * Only loads Univer related packages when truly needed
 */
export const LazyUniverComponent: React.FC<UniverComponentProps> = (props) => {
	return (
		<Suspense
			fallback={
				<div
					className="univer-component-wrapper"
					style={{ width: props.width || "100%", height: props.height || "100%" }}
				>
					<div className="univer-loading-container">
						<Spin size="large" />
					</div>
				</div>
			}
		>
			<LazyUniverCore {...props} />
		</Suspense>
	)
}

export default LazyUniverComponent

import React, { useEffect, useRef, useState, Suspense } from "react"
import { Button, Typography, Spin } from "antd"
import { useTranslation } from "react-i18next"
import "./styles.css"

// Utility function imports
import { transformData } from "./utils"
import { useAsyncEffect } from "ahooks"
import { loadUniverModulesByFileType } from "./lazy-loader"

const { Text } = Typography

// Export component interface
export interface UniverComponentProps {
	data: any
	fileType: "sheet" | "slide" | "doc"
	fileName: string
	width?: number | string
	height?: number | string
	mode?: "readonly" | "edit"
}

// Internal core component - using lazy loading manager
const UniverCore: React.FC<UniverComponentProps> = ({
	data,
	fileType,
	fileName,
	width = "100%",
	height = "100%",
}) => {
	const { t } = useTranslation("interface")
	const containerRef = useRef<HTMLDivElement>(null)
	const univerAPIRef = useRef<any>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [univerModules, setUniverModules] = useState<any>(null)

	// Use internationalized default filename
	const finalFileName = fileName || t("common.untitledFile", "未命名文件")

	useEffect(() => {
		// Cleanup resources when component unmounts
		return () => {
			if (univerAPIRef.current) {
				univerAPIRef.current.dispose()
				univerAPIRef.current = null
			}
		}
	}, [])

	// Dynamically load Univer modules
	useAsyncEffect(async () => {
		if (!containerRef.current) return

		setLoading(true)
		setError(null)

		try {
			// Load required Univer modules on demand
			console.log(`🚀 Starting on-demand loading of ${fileType} related Univer modules...`)
			const modules = await loadUniverModulesByFileType(fileType)
			setUniverModules(modules)
			console.log(`✅ ${fileType} related Univer modules loaded successfully`)
		} catch (err) {
			console.error("❌ Failed to dynamically load Univer modules:", err)
			setError(t("common.loadModuleError", "模块加载失败"))
			setLoading(false)
		}
	}, [fileType])

	// Initialize Univer instance
	useAsyncEffect(async () => {
		if (!containerRef.current || !univerModules) return

		// Dispose existing instance if any
		if (univerAPIRef.current) {
			univerAPIRef.current.dispose()
			univerAPIRef.current = null
		}

		try {
			// Transform data to Univer supported format
			const univerData = await transformData(data, fileType, finalFileName)

			console.log(
				"univerData",
				univerData,
				fileType,
				"fileType",
				fileName,
				"fileNamefileName",
				data,
				"data",
			)

			// 样式调试：如果是测试数据，添加详细调试信息
			if (univerData && univerData.styles && Object.keys(univerData.styles).length > 0) {
				console.log("🎨 样式调试：工作簿包含样式", {
					stylesCount: Object.keys(univerData.styles).length,
					styles: univerData.styles,
				})

				// 检查第一个工作表的单元格样式应用
				if (univerData.sheets) {
					const firstSheetId = Object.keys(univerData.sheets)[0]
					const firstSheet = univerData.sheets[firstSheetId]
					if (firstSheet && firstSheet.cellData) {
						console.log("🔍 样式调试：检查单元格样式应用")
						const cellData = firstSheet.cellData

						// 检查前几个单元格
						for (let row = 0; row < 3; row++) {
							for (let col = 0; col < 3; col++) {
								const cell = cellData[row.toString()]?.[col.toString()]
								if (cell && cell.s !== undefined) {
									const style = univerData.styles[cell.s]
									console.log(
										`  - 单元格[${row},${col}] 样式ID:${cell.s}, 样式:`,
										style,
									)
								}
							}
						}
					}
				}
			}

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

			univer.registerPlugin(UniverUIPlugin, {
				container: containerRef.current,
				header: true,
				footer: true,
			})
			univer.registerPlugin(UniverDocsPlugin)
			univer.registerPlugin(UniverDocsUIPlugin)

			univer.registerPlugin(UniverSheetsPlugin)
			univer.registerPlugin(UniverSheetsUIPlugin, {
				menu: {
					"sheet.command.set-range-bold": {
						hidden: true,
					},
					"sheet.command.set-range-italic": {
						hidden: true,
					},
					"sheet.menu.paste-special": {
						hidden: true,
					},
					"sheet.command.paste": {
						hidden: true,
					},
					"sheet.menu.clear-selection": {
						hidden: true,
					},
					"sheet.contextMenu.permission": {
						hidden: true,
					},
					"sheet.operation.insert-hyper-link": {
						hidden: true,
					},
					"sheet.menu.sheet-frozen": {
						hidden: true,
					},
				},
			})

			switch (fileType) {
				case "sheet":
					break

				case "doc":
					break

				case "slide":
					break

				default:
					throw new Error(
						`${t("common.unsupportedFileType", "不支持的文件类型")}: ${fileType}`,
					)
			}

			// Save API reference
			univerAPIRef.current = univerAPI

			// Create corresponding document instance based on type
			if (fileType === "sheet") {
				univerAPI.createWorkbook(univerData)

				if (univerData) {
					const permission = univerAPI.getWorkbook(univerData.id)?.getPermission()
					const workbookId = univerAPI.getWorkbook(univerData.id)?.getId()
					if (workbookId) {
						permission?.setWorkbookPermissionPoint(
							workbookId,
							permission.permissionPointsDefinition.WorkbookEditablePermission,
							false,
						)
					}
				}
			} else if (fileType === "doc") {
				// univerAPI.createDocument(univerData)
			} else if (fileType === "slide") {
				// univerAPI.createPresentation(univerData)
			}

			// Set initial readonly state after instance creation
			setLoading(false)

			// Set global flag indicating Univer library is loaded
			if (typeof window !== "undefined") {
				;(window as any).__UNIVER_LIBRARIES_LOADED__ = true
			}
		} catch (err: any) {
			console.error("Failed to initialize Univer component:", err)
			setError(err.message || t("common.loadFileFailed", "加载文件失败"))
			setLoading(false)
		}
	}, [data])

	useEffect(() => {
		// Add overscroll-behavior-x: none when component mounts
		document.documentElement.style.overscrollBehaviorX = "none"

		// Remove overscroll-behavior-x when component unmounts
		return () => {
			document.documentElement.style.overscrollBehaviorX = ""
		}
	}, []) // Empty dependency array ensures this only runs on mount and unmount

	// Render error state
	if (error) {
		return (
			<div className="univer-error-container" style={{ width, height }}>
				<Text type="danger">
					{t("common.loadFailed", "加载失败")}: {error}
				</Text>
				<Button type="primary" onClick={() => window.location.reload()}>
					{t("button.reload", "重新加载")}
				</Button>
			</div>
		)
	}

	// Render loading state or Univer container
	return (
		<div className="univer-component-wrapper" style={{ width, height }}>
			{loading && (
				<div className="univer-loading-container">
					<Spin />
				</div>
			)}
			<div
				ref={containerRef}
				className="univer-container"
				style={{
					width: "100%",
					height: "100%",
					visibility: loading ? "hidden" : "visible",
					minHeight: "400px",
				}}
			/>
		</div>
	)
}

/**
 * UniverComponent - Document, spreadsheet and slide viewing/editing component based on Univer library
 */
export const UniverComponent: React.FC<UniverComponentProps> = (props) => {
	return (
		<Suspense
			fallback={
				<div
					className="univer-component-wrapper"
					style={{ width: props.width || "100%", height: props.height || "100%" }}
				>
					<div className="univer-loading-container">
						<Spin />
					</div>
				</div>
			}
		>
			<UniverCore {...props} />
		</Suspense>
	)
}

export default UniverComponent

import {
	LocaleType,
	Univer,
	UniverInstanceType,
	IPermissionService,
	ICommandService,
	IUniverInstanceService,
	type Workbook,
	type DocumentDataModel,
	IWorkbookData,
	IDocumentData,
	CommandType,
} from "@univerjs/core"
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula"
import { UniverRenderEnginePlugin, DeviceInputEventType } from "@univerjs/engine-render"
import {
	UniverSheetsPlugin,
	WorkbookEditablePermission,
	WorksheetSetCellValuePermission,
	WorksheetSetCellStylePermission,
	WorksheetEditPermission,
	WorksheetSetColumnStylePermission,
	SetRangeValuesMutation,
} from "@univerjs/sheets"
import { UniverDocsPlugin } from "@univerjs/docs"
import { UniverSheetsFormulaUIPlugin } from "@univerjs/sheets-formula-ui"
import { UniverSheetsNumfmtUIPlugin } from "@univerjs/sheets-numfmt-ui"
import {
	UniverSheetsUIPlugin,
	IEditorBridgeService,
	SetCellEditVisibleOperation,
} from "@univerjs/sheets-ui"
import { UniverDocsUIPlugin } from "@univerjs/docs-ui"
import { UniverUIPlugin } from "@univerjs/ui"
import { merge } from "lodash-es"
import { exportUniverToDocx, jsonToBufferInDocx, transformUniverToDocx } from "./utils-export-docx"
import DesignZhCN from "@univerjs/design/locale/zh-CN"
import DocsUIZhCN from "@univerjs/docs-ui/locale/zh-CN"
import SheetsFormulaUIZhCN from "@univerjs/sheets-formula-ui/locale/zh-CN"
import SheetsNumfmtUIZhCN from "@univerjs/sheets-numfmt-ui/locale/zh-CN"
import SheetsUIZhCN from "@univerjs/sheets-ui/locale/zh-CN"
import SheetsZhCN from "@univerjs/sheets/locale/zh-CN"
import UIZhCN from "@univerjs/ui/locale/zh-CN"
import { UniverWorkerManager } from "./UniverWorkerManager"
import { jsonToBufferInExcel, transformUniverToExcel } from "./utils-export"
import { transformFileToDocData, transformJsonToDocData } from "./utils-data-docs"

import "@univerjs/design/lib/index.css"
import "@univerjs/ui/lib/index.css"
import "@univerjs/docs-ui/lib/index.css"
import "@univerjs/sheets-ui/lib/index.css"
import "@univerjs/sheets-formula-ui/lib/index.css"
import "@univerjs/sheets-numfmt-ui/lib/index.css"
import {
	ComponentMode,
	componentModeMap,
	ExportConfigType,
	SupportedFileOutputModeMap,
	SupportedFileType,
	SupportedFileTypeMap,
} from "./types"

export interface UniverRendererConfig {
	type: SupportedFileType
	container: HTMLElement
	mode: ComponentMode
	data: File | Partial<IWorkbookData> | Partial<IDocumentData>
	onDataChange?: (data: Partial<IWorkbookData> | Partial<IDocumentData>) => void
}

export interface UniverRendererCallbacks {
	onInitialized?: () => void
	onError?: (error: string) => void
}

/** Univer 表格渲染器 */
export class UniverRenderer {
	private univer: Univer | null = null
	private config: UniverRendererConfig
	private callbacks: UniverRendererCallbacks
	private disposed = false
	private fileName: string
	private isCsvFile: boolean
	private workerManager: UniverWorkerManager | null = null
	private workbookId: string | null = null
	private documentId: string | null = null
	private outsideClickHandler: ((event: MouseEvent) => void) | null = null
	private hasRegisteredOutsideClickListener = false

	constructor(config: UniverRendererConfig, callbacks: UniverRendererCallbacks = {}) {
		this.config = config
		this.callbacks = callbacks
		this.fileName = this.extractFileName()
		this.isCsvFile = this.fileName.toLowerCase().endsWith(".csv")
		// 初始化 Worker 管理器
		this.initializeWorkerManager()

		// 自动初始化和渲染
		this.autoInitializeAndRender()
	}

	/** 初始化 Univer 实例和插件 */
	async initialize(): Promise<void> {
		if (this.disposed) {
			throw new Error("Renderer has been disposed")
		}

		try {
			this.univer = new Univer({
				locale: LocaleType.ZH_CN,
				locales: {
					[LocaleType.ZH_CN]: merge(
						{},
						DesignZhCN,
						UIZhCN,
						DocsUIZhCN,
						SheetsZhCN,
						SheetsUIZhCN,
						SheetsFormulaUIZhCN,
						SheetsNumfmtUIZhCN,
					),
				},
			})
			this.registerPlugins()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "初始化失败"
			this.callbacks.onError?.(errorMessage)
			throw error
		}
	}
	private setupOutsideClickListener(): void {
		if (!this.univer) return

		// 创建点击处理器
		this.outsideClickHandler = (event: MouseEvent) => {
			try {
				if (!this.univer) return

				const target = event.target as HTMLElement
				const container = this.config.container

				// 检查是否点击在容器内部
				if (container && container.contains(target)) {
					return
				}

				// 获取编辑器桥接服务
				const injector = this.univer.__getInjector()
				const editorBridgeService = injector.get(IEditorBridgeService)
				const commandService = injector.get(ICommandService)

				// 检查编辑器是否可见
				const isVisible = editorBridgeService.isVisible().visible
				if (!isVisible) return

				// 检查是否强制保持可见（如公式引用选择模式）
				if (editorBridgeService.isForceKeepVisible()) {
					return
				}

				// 关闭编辑器
				commandService.syncExecuteCommand(SetCellEditVisibleOperation.id, {
					visible: false,
					eventType: DeviceInputEventType.PointerDown,
					unitId: this.workbookId || undefined,
				})
			} catch (error) {
				console.warn("[UniverRenderer] 外部点击处理失败:", error)
			}
		}

		// 延迟添加监听器，避免与初始化时的点击事件冲突
		setTimeout(() => {
			if (this.outsideClickHandler && !this.hasRegisteredOutsideClickListener) {
				this.hasRegisteredOutsideClickListener = true
				document.addEventListener("mousedown", this.outsideClickHandler, true)
			}
		}, 100)
	}
	/** 渲染数据 */
	private async render(): Promise<void> {
		if (!this.univer) {
			throw new Error("Renderer not initialized")
		}

		try {
			const isReadonly = this.config.mode === componentModeMap.readonly

			if (this.config.type === SupportedFileTypeMap.doc) {
				// 渲染文档
				await this.renderDoc()
			} else {
				// 渲染表格
				await this.renderSheet(isReadonly)
			}

			this.configurePermissions()

			// 如果是只读模式，设置额外的编辑阻止逻辑
			if (isReadonly) {
				this.setupReadonlyBehavior()
			}

			// 完成初始化和数据转换后调用回调
			this.callbacks.onInitialized?.()

			// 设置编辑监听器
			this.setupOnDataChangeListener()

			if (
				this.config.mode === componentModeMap.edit &&
				this.config.type === SupportedFileTypeMap.sheet
			) {
				this.setupOutsideClickListener()
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "渲染失败"
			this.callbacks.onError?.(errorMessage)
			throw error
		}
	}

	/** 渲染表格 */
	private async renderSheet(isReadonly: boolean): Promise<void> {
		if (!this.univer || !this.workerManager) {
			throw new Error("Renderer not initialized")
		}

		const data = this.getData()
		const workbookData = await this.workerManager.transformData(data, this.fileName, isReadonly)
		this.workbookId = workbookData.id as string
		this.univer.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData)
	}

	/** 渲染文档 */
	private async renderDoc(): Promise<void> {
		if (!this.univer) {
			throw new Error("Renderer not initialized")
		}

		const data = this.getData()
		let docData: IDocumentData

		if (data instanceof File) {
			// 从文件转换
			docData = (await transformFileToDocData(data)) as IDocumentData
		} else {
			// 从 JSON 转换
			docData = transformJsonToDocData(data as Partial<IDocumentData>)
		}

		this.documentId = docData.id as string
		console.log("[UniverRenderer] 初始化文档，ID:", this.documentId, "数据:", {
			dataStreamLength: docData.body?.dataStream?.length,
			paragraphs: docData.body?.paragraphs?.length,
			textRuns: docData.body?.textRuns?.length,
		})
		this.univer.createUnit(UniverInstanceType.UNIVER_DOC, docData)
	}

	/** 设置编辑监听器 */
	private setupOnDataChangeListener(): void {
		if (!this.univer || !this.config.onDataChange) return

		let beforeData: string | null = null
		try {
			const commandService = this.univer.__getInjector().get(ICommandService)

			// 监听所有命令执行后的事件
			commandService.onCommandExecuted((command) => {
				if (command.type === CommandType.MUTATION) {
					// 根据类型获取对应的数据
					const data =
						this.config.type === SupportedFileTypeMap.doc
							? this.getDocxData()
							: this.getWorksheetData()

					const isDataChanged = JSON.stringify(data) !== beforeData
					if (data && isDataChanged) {
						beforeData = JSON.stringify(data)
						this.config.onDataChange?.(data)
					}
				}
			})
		} catch (error) {
			console.warn("[UniverRenderer] 设置编辑监听器失败:", error)
		}
	}

	/** 自动初始化和渲染 */
	private async autoInitializeAndRender(): Promise<void> {
		try {
			await this.initialize()
			await this.render()
		} catch (error) {
			// 错误已在各自方法中处理
		}
	}

	/** 销毁实例 */
	dispose(): void {
		if (this.univer && !this.disposed) {
			try {
				this.univer.dispose()
			} catch (error) {
				// ignore
			}
			this.univer = null
		}

		// 销毁 Worker 管理器
		if (this.workerManager) {
			try {
				this.workerManager.dispose()
			} catch (error) {
				// ignore
			}
			this.workerManager = null
		}

		this.disposed = true
	}

	/** 检查是否已销毁 */
	isDisposed(): boolean {
		return this.disposed
	}

	/** 注册所有必要的插件 */
	private registerPlugins(): void {
		if (!this.univer) return

		// Register plugins in correct order to avoid initialization errors
		// 1. Render engine must be first
		this.univer.registerPlugin(UniverRenderEnginePlugin)

		// 2. UI Plugin must be registered before Docs and Sheets plugins
		this.univer.registerPlugin(UniverUIPlugin, {
			container: this.config.container,
			header: false,
			footer: !this.isCsvFile,
			contextMenu: true,
			disableAutoFocus: true,
			menu: {
				"sheet.menu.sheet-frozen": {
					hidden: true,
				},
				"sheet.contextMenu.permission": {
					hidden: true,
				},
			},
		})

		// 3. Docs plugins
		this.univer.registerPlugin(UniverDocsPlugin)
		this.univer.registerPlugin(UniverDocsUIPlugin)

		// 4. Sheets plugins
		this.univer.registerPlugin(UniverSheetsPlugin)
		const sheetsUIConfig = {
			footer: {
				sheetBar: true,
				statisticBar: false,
				menus: false,
				zoomSlider: false,
			},
			disableForceStringAlert: true,
			disableForceStringMark: true,
			formulaBar: false,
			clipboardConfig: {
				hidePasteOptions: true,
			},
			protectedRangeShadow: false,
			// 只读模式下禁用编辑相关功能
			...(this.config.mode === componentModeMap.readonly && {
				cellEditor: {
					enabled: false,
				},
				selection: {
					enabled: true,
				},
			}),
		}
		this.univer.registerPlugin(UniverSheetsUIPlugin, sheetsUIConfig)

		// 5. Formula plugins must be registered after sheets
		this.univer.registerPlugin(UniverFormulaEnginePlugin)
		this.univer.registerPlugin(UniverSheetsFormulaUIPlugin)
		this.univer.registerPlugin(UniverSheetsNumfmtUIPlugin)
	}

	/** 配置权限和显示设置 */
	private configurePermissions(): void {
		if (!this.univer) return
		setTimeout(() => {
			try {
				if (!this.univer) return
				const injector = this.univer.__getInjector()
				const permissionService = injector.get(IPermissionService)
				permissionService.setShowComponents(false)
				if (this.config.mode === componentModeMap.readonly) {
					this.setReadonlyMode(permissionService)
				}
			} catch (error) {
				console.warn("[UniverRenderer] 配置权限失败:", error)
			}
		}, 0)
	}

	/** 设置只读模式 */
	private setReadonlyMode(permissionService: IPermissionService): void {
		const unitId = this.workbookId || "workbook1"

		// 🎯 方案2：直接允许列相关权限，禁用其他编辑权限
		// console.log("[UniverRenderer] 设置只读模式，unitId:", unitId)

		// 获取当前活动工作表ID
		const worksheetId = this.getCurrentWorksheetId()
		// console.log("[UniverRenderer] 获取到工作表ID:", worksheetId)

		if (worksheetId) {
			// 🎯 精准权限控制：只允许列展开/隐藏，禁用其他编辑功能

			// ❌ 禁用单元格值编辑
			const cellValuePermission = new WorksheetSetCellValuePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(cellValuePermission.id)) {
				permissionService.addPermissionPoint(cellValuePermission)
			}
			permissionService.updatePermissionPoint(cellValuePermission.id, false)
			// console.log("[UniverRenderer] ❌ 已禁用单元格值编辑权限")

			// ❌ 禁用单元格样式编辑
			const cellStylePermission = new WorksheetSetCellStylePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(cellStylePermission.id)) {
				permissionService.addPermissionPoint(cellStylePermission)
			}
			permissionService.updatePermissionPoint(cellStylePermission.id, false)
			// console.log("[UniverRenderer] ❌ 已禁用单元格样式编辑权限")

			// ❌ 禁用工作表结构编辑（插入/删除行列等）
			// const worksheetEditPermission = new WorksheetEditPermission(unitId, worksheetId)
			// if (!permissionService.getPermissionPoint(worksheetEditPermission.id)) {
			// 	permissionService.addPermissionPoint(worksheetEditPermission)
			// }
			// permissionService.updatePermissionPoint(worksheetEditPermission.id, false)
			// console.log("[UniverRenderer] ❌ 已禁用工作表结构编辑权限")

			// ✅ 确保列展开/隐藏功能所需的权限是启用的

			// ✅ 启用工作簿编辑权限（SetSelectedColsVisibleCommand 需要）
			const workbookEditablePermission = new WorkbookEditablePermission(unitId)
			if (!permissionService.getPermissionPoint(workbookEditablePermission.id)) {
				permissionService.addPermissionPoint(workbookEditablePermission)
			}
			permissionService.updatePermissionPoint(workbookEditablePermission.id, true)
			// console.log("[UniverRenderer] ✅ 已启用工作簿编辑权限")

			// ✅ 启用列样式权限（SetSelectedColsVisibleCommand 需要）
			const columnStylePermission = new WorksheetSetColumnStylePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(columnStylePermission.id)) {
				permissionService.addPermissionPoint(columnStylePermission)
			}
			permissionService.updatePermissionPoint(columnStylePermission.id, true)
			// console.log("[UniverRenderer] ✅ 已启用列样式权限（包括列展开/隐藏）")
		} else {
			// console.warn("[UniverRenderer] 无法获取工作表ID，使用备用方案")
			// 备用方案：完全禁用编辑，但这会影响列展开功能
			const instance = new WorkbookEditablePermission(unitId)
			const editPermissionPoint = permissionService.getPermissionPoint(instance.id)
			if (!editPermissionPoint) {
				permissionService.addPermissionPoint(instance)
			}
			permissionService.updatePermissionPoint(instance.id, false)
		}
	}

	/** 获取当前工作表ID */
	private getCurrentWorksheetId(): string | null {
		try {
			if (!this.univer) return null

			const injector = this.univer.__getInjector()
			const univerInstanceService = injector.get(IUniverInstanceService)
			const workbook = univerInstanceService.getCurrentUnitForType<Workbook>(
				UniverInstanceType.UNIVER_SHEET,
			)
			if (!workbook) return null

			const activeSheet = workbook.getActiveSheet()
			return activeSheet ? activeSheet.getSheetId() : null
		} catch (error) {
			console.warn("[UniverRenderer] 获取工作表ID失败:", error)
			return null
		}
	}

	/** 设置只读行为 - 阻止所有编辑操作 */
	private setupReadonlyBehavior(): void {
		if (!this.univer) return

		setTimeout(() => {
			try {
				// 方法1: 通过 DOM 事件阻止双击编辑
				const container = this.config.container
				if (container) {
					// 阻止双击事件
					container.addEventListener(
						"dblclick",
						(e) => {
							e.preventDefault()
							e.stopPropagation()
							return false
						},
						true,
					) // 使用捕获阶段

					// 阻止键盘编辑（F2, Enter等）
					container.addEventListener(
						"keydown",
						(e) => {
							if (e.key === "F2" || e.key === "Enter") {
								e.preventDefault()
								e.stopPropagation()
								return false
							}
						},
						true,
					)
				}

				// 方法2: 通过命令服务阻止编辑命令
				if (!this.univer) return
				const injector = this.univer.__getInjector()
				const commandService = injector.get(ICommandService)

				// 拦截所有可能的编辑命令
				const editCommands = [
					"sheet.operation.set-cell-edit-visible",
					"sheet.command.start-edit",
					"sheet.command.edit-cell",
					"sheet.operation.start-edit",
					"doc.operation.insert-text",
					"doc.operation.delete-text",
					"doc.operation.replace-text",
				]

				editCommands.forEach((commandId) => {
					commandService.onCommandExecuted((command) => {
						if (command.id === commandId) {
							return false // 阻止命令执行
						}
					})
				})
			} catch (error) {
				console.warn("[UniverRenderer] 设置只读行为失败:", error)
			}
		}, 100)
	}

	/** 提取文件名 */
	private extractFileName(): string {
		if (this.config.data instanceof File) {
			return this.config.data.name || "未命名文件"
		}

		// 尝试从数据中获取名称
		const data = this.config.data as any
		if (data.name) {
			return data.name
		}

		// 根据类型返回默认文件名
		return this.config.type === SupportedFileTypeMap.doc ? "document.docx" : "workbook.xlsx"
	}

	/** 获取数据 */
	private getData(): File | Partial<IWorkbookData> | Partial<IDocumentData> {
		return this.config.data
	}

	/** 获取当前 worksheet 数据 */
	public getWorksheetData(): Partial<IWorkbookData> | null {
		if (!this.univer || !this.workbookId) {
			return null
		}

		try {
			const univerInstanceService = this.univer.__getInjector().get(IUniverInstanceService)
			const workbook = univerInstanceService.getUnit<Workbook>(
				this.workbookId,
				UniverInstanceType.UNIVER_SHEET,
			)

			if (!workbook) {
				return null
			}

			return workbook.save()
		} catch (error) {
			console.error("[UniverRenderer] 获取 worksheet 数据失败:", error)
			return null
		}
	}

	/** 获取当前 document 数据 */
	public getDocxData(): Partial<IDocumentData> | null {
		if (!this.univer || !this.documentId) {
			return null
		}

		try {
			const univerInstanceService = this.univer.__getInjector().get(IUniverInstanceService)
			const document = univerInstanceService.getUnit<DocumentDataModel>(
				this.documentId,
				UniverInstanceType.UNIVER_DOC,
			)

			if (!document) {
				return null
			}
			// DocumentDataModel 使用 getSnapshot() 获取数据
			const snapshot = document.getSnapshot()
			return {
				// @ts-ignore
				id: this.documentId,
				...snapshot,
			}
		} catch (error) {
			console.error("[UniverRenderer] 获取 document 数据失败:", error)
			return null
		}
	}

	/** 初始化 Worker 管理器 */
	private initializeWorkerManager(): void {
		try {
			this.workerManager = new UniverWorkerManager()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Worker 初始化失败"
			this.callbacks.onError?.(errorMessage)
			throw error
		}
	}

	/** 更新 worksheet 数据（支持增量更新和全量更新）-主动更新 */
	public async updateWorksheetData(
		newData: Partial<IWorkbookData>,
		options?: { fullUpdate?: boolean },
	): Promise<void> {
		if (!this.univer || !this.workbookId) {
			console.error("[UniverRenderer] updateWorksheetData 无法获取 workbook 实例")
			return
		}

		try {
			const injector = this.univer.__getInjector()
			const univerInstanceService = injector.get(IUniverInstanceService)

			// 如果是全量更新（从 JSON 编辑器更新）
			if (options?.fullUpdate) {
				console.log("[UniverRenderer] 执行全量更新 worksheet 数据")

				// 全量替换：销毁旧的，创建新的
				univerInstanceService.disposeUnit(this.workbookId)

				// 确保新数据有 id
				const workbookData: IWorkbookData = {
					id: this.workbookId,
					name: newData.name || "workbook",
					appVersion: newData.appVersion || "0.0.1",
					locale: newData.locale || LocaleType.ZH_CN,
					styles: newData.styles || {},
					sheets: newData.sheets || {},
					sheetOrder: newData.sheetOrder || [],
					...newData,
				} as IWorkbookData

				// 创建新的 workbook 实例
				this.univer.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData)

				// 重新配置权限
				this.configurePermissions()

				if (this.config.mode === componentModeMap.readonly) {
					this.setupReadonlyBehavior()
				}

				// 重新设置编辑监听器
				if (this.config.onDataChange) {
					const data = this.getWorksheetData()
					if (data) {
						setTimeout(() => {
							this.config.onDataChange?.(data)
						}, 100)
					}
				}

				console.log("[UniverRenderer] 全量更新 worksheet 数据完成")
				return
			}

			// 增量更新（保持光标等状态）
			const commandService = injector.get(ICommandService)

			// 获取当前 workbook
			const workbook = univerInstanceService.getUnit<Workbook>(
				this.workbookId,
				UniverInstanceType.UNIVER_SHEET,
			)

			if (!workbook) {
				console.error("[UniverRenderer] 无法获取 workbook 实例")
				return
			}

			// 如果新数据包含 sheets 数据，进行增量更新
			if (newData.sheets) {
				// 遍历所有 sheet 更新数据
				for (const [sheetId, sheetData] of Object.entries(newData.sheets)) {
					const worksheet = workbook.getSheetBySheetId(sheetId)

					if (!worksheet) {
						console.warn(`[UniverRenderer] Sheet ${sheetId} 不存在，跳过更新`)
						continue
					}

					// 使用 SetRangeValuesMutation 更新单元格数据
					if (sheetData.cellData) {
						await commandService.executeCommand(SetRangeValuesMutation.id, {
							unitId: this.workbookId,
							subUnitId: sheetId,
							cellValue: sheetData.cellData,
						})
					}
				}
			}

			console.log("[UniverRenderer] 增量更新 worksheet 数据完成")
		} catch (error) {
			console.error("[UniverRenderer] 更新 worksheet 数据失败:", error)
			throw error
		}
	}

	/** 更新 document 数据（全量替换）- 主动更新 */
	public async updateDocData(newData: Partial<IDocumentData>): Promise<void> {
		if (!this.univer || !this.documentId) {
			console.error("[UniverRenderer] 无法获取 document 实例")
			return
		}

		try {
			const univerInstanceService = this.univer.__getInjector().get(IUniverInstanceService)

			// Doc 的更新比较简单，直接全量替换（类似 Excel）
			const docData = transformJsonToDocData(newData)

			// 销毁旧的，创建新的（类似 Excel 的 loadFile）
			console.log("[UniverRenderer] 更新文档，旧ID:", this.documentId, "新ID:", docData.id)
			univerInstanceService.disposeUnit(this.documentId)
			this.documentId = docData.id as string
			console.log("[UniverRenderer] 创建文档单元，ID:", this.documentId, "数据:", {
				dataStreamLength: docData.body?.dataStream?.length,
				paragraphs: docData.body?.paragraphs?.length,
				textRuns: docData.body?.textRuns?.length,
			})
			this.univer.createUnit(UniverInstanceType.UNIVER_DOC, docData)

			// 重新配置权限
			this.configurePermissions()

			if (this.config.mode === componentModeMap.readonly) {
				this.setupReadonlyBehavior()
			}
		} catch (error) {
			console.error("[UniverRenderer] 更新 document 数据失败:", error)
			throw error
		}
	}

	/** 加载新文件（全量替换） */
	public async loadFile(file: File): Promise<void> {
		if (!this.univer) {
			console.error("[UniverRenderer] Univer 实例不存在")
			return
		}

		try {
			const univerInstanceService = this.univer.__getInjector().get(IUniverInstanceService)

			if (this.config.type === SupportedFileTypeMap.doc) {
				// Doc 文件加载
				if (!this.documentId) {
					console.error("[UniverRenderer] 无法获取 document 实例")
					return
				}

				console.log("🚀 [UniverRenderer] 加载文档，文件:", file)
				const docData = (await transformFileToDocData(file)) as IDocumentData

				// 全量替换：销毁旧的，创建新的（类似 Excel 的 loadFile）
				univerInstanceService.disposeUnit(this.documentId)
				this.documentId = docData.id as string

				this.univer.createUnit(UniverInstanceType.UNIVER_DOC, docData)

				// 重新配置权限
				this.configurePermissions()

				if (this.config.mode === componentModeMap.readonly) {
					this.setupReadonlyBehavior()
				}

				// 重新设置编辑监听器
				if (this.config.onDataChange) {
					const data = this.getDocxData()
					if (data) {
						setTimeout(() => {
							this.config.onDataChange?.(data)
						}, 100)
					}
				}
			} else {
				// Sheet 文件加载
				if (!this.workbookId || !this.workerManager) {
					console.error(
						"[UniverRenderer-loadFile] 无法获取 workbook 实例",
						this.workbookId,
						this.workerManager,
					)
					return
				}

				const isReadonly = this.config.mode === componentModeMap.readonly
				const workbookData = await this.workerManager.transformData(
					file,
					file.name,
					isReadonly,
				)

				// 全量替换：销毁旧的，创建新的
				univerInstanceService.disposeUnit(this.workbookId)
				this.workbookId = workbookData.id as string
				this.univer.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData)

				// 重新配置权限
				this.configurePermissions()

				if (this.config.mode === componentModeMap.readonly) {
					this.setupReadonlyBehavior()
				}

				// 重新设置编辑监听器
				if (this.config.onDataChange) {
					const data = this.getWorksheetData()
					if (data) {
						setTimeout(() => {
							this.config.onDataChange?.(data)
						}, 100)
					}
				}
			}

			console.log("[UniverRenderer] 文件加载完成:", file.name)
		} catch (error) {
			console.error("[UniverRenderer] 加载文件失败:", error)
			throw error
		}
	}

	/**
	 * @description: file-core: 导出 Excel 文件
	 * buffer链路: exportToExcel->getWorksheetBuffer(getWorksheetData + jsonToBufferInExcel)-> transformUniverToExcel
	 */
	public async exportToExcel(config: ExportConfigType): Promise<void> {
		const { mode, fileName, isDownload, data } = config
		const isBuffer = mode === SupportedFileOutputModeMap.buffer
		if (!isBuffer) {
			const worksheetData = this.getWorksheetData()
			console.log(
				"🚀 [UniverRenderer] 导出 Excel 文件 - 使用 ExcelJS 完整实现",
				worksheetData,
			)
			if (!worksheetData) {
				throw new Error("无法获取工作簿数据")
			}
			await transformUniverToExcel({
				snapshot: data || worksheetData,
				mode: SupportedFileOutputModeMap.json,
				fileName: fileName || `${this.fileName || "export"}_${new Date().getTime()}.xlsx`,
			})
			return
		}
		try {
			// 获取当前工作簿数据（snapshot）
			const worksheetData = await this.getWorksheetBuffer()
			if (isDownload) {
				await transformUniverToExcel({
					snapshot: worksheetData,
					mode: SupportedFileOutputModeMap.buffer,
					fileName:
						fileName || `${this.fileName || "export"}_${new Date().getTime()}.xlsx`,
					success: () => {
						console.log("[UniverRenderer] 文件导出成功")
					},
					error: (err) => {
						console.error("[UniverRenderer] 导出失败:", err)
						throw err
					},
				})
			}
		} catch (error) {
			console.error("[UniverRenderer] 导出文件失败:", error)
			throw error
		}
	}

	public async getWorksheetBuffer(): Promise<ArrayBuffer> {
		try {
			// 获取当前工作簿数据（snapshot）
			const snapshot = this.getWorksheetData()
			if (!snapshot || !snapshot.sheets) {
				throw new Error("无法获取工作簿数据")
			}
			// 使用完整的 ExcelJS 实现导出
			const buffer = await jsonToBufferInExcel(snapshot)
			return buffer
		} catch (error) {
			console.error("[UniverRenderer] 导出文件失败:", error)
			throw error
		}
	}

	/** 导出 Docx 文件 - 使用 docx 库生成 Buffer */
	public async getDocxBuffer(): Promise<ArrayBuffer> {
		try {
			// 获取当前文档数据
			const docData = this.getDocxData()
			if (!docData || !docData.body) {
				throw new Error("无法获取文档数据")
			}
			// 使用 docx 库实现导出
			const buffer = await jsonToBufferInDocx(docData)
			return buffer
		} catch (error) {
			console.error("[UniverRenderer] 导出 Docx Buffer 失败:", error)
			throw error
		}
	}

	/**
	 * @description: core: 导出 Docx 文件
	 * buffer链路: exportToDocx->getDocxBuffer(getDocxData + jsonToBufferInDocx)-> transformUniverToDocx
	 */
	public async exportToDocx(config: ExportConfigType): Promise<void> {
		const { mode, fileName, isDownload } = config
		const isBuffer = mode === SupportedFileOutputModeMap.buffer

		// 非 Buffer 模式：使用 JSON 模式导出
		if (!isBuffer) {
			const docData = this.getDocxData()
			console.log("🚀 [UniverRenderer] 导出 Docx 文件 - 使用 JSON 模式", docData)
			if (!docData || !docData.body) {
				throw new Error("无法获取文档数据")
			}
			await transformUniverToDocx({
				docData,
				mode: SupportedFileOutputModeMap.json,
				fileName: fileName || `${docData.title || "document"}_${new Date().getTime()}.docx`,
			})
			return
		}

		// Buffer 模式：使用 getDocxBuffer 获取 ArrayBuffer
		try {
			// 获取当前文档数据（buffer）
			const docBuffer = await this.getDocxBuffer()
			console.log("🚀 [UniverRenderer] 导出 Docx 文件 - 使用 buffer 模式", docBuffer)
			if (isDownload) {
				await transformUniverToDocx({
					docData: docBuffer,
					mode: "buffer",
					fileName:
						fileName || `${this.fileName || "document"}_${new Date().getTime()}.docx`,
					success: () => {
						console.log("[UniverRenderer] Docx 文件导出成功")
					},
					error: (err) => {
						console.error("[UniverRenderer] Docx 导出失败:", err)
						throw err
					},
				})
			}
		} catch (error) {
			console.error("[UniverRenderer] 导出 Docx 文件失败:", error)
			throw error
		}
	}
	/** 动态设置模式 - 在 readonly 和 edit 之间切换 */
	public setMode(mode: ComponentMode): void {
		if (!this.univer) {
			console.warn("[UniverRenderer] Univer 实例不存在，无法设置模式")
			return
		}

		// 更新配置
		this.config.mode = mode
		this.setupOutsideClickListener()
		try {
			const injector = this.univer.__getInjector()
			const permissionService = injector.get(IPermissionService)

			if (mode === componentModeMap.readonly) {
				// 切换到只读模式
				console.log("[UniverRenderer] 切换到只读模式")
				this.setReadonlyMode(permissionService)
				this.setupReadonlyBehavior()
			} else {
				this.setEditMode(permissionService)
			}
		} catch (error) {
			console.error("[UniverRenderer] 设置模式失败:", error)
		}
	}

	/** 设置编辑模式 - 启用所有编辑权限 */
	private setEditMode(permissionService: IPermissionService): void {
		const unitId = this.workbookId || "workbook1"
		const worksheetId = this.getCurrentWorksheetId()

		if (worksheetId) {
			// 启用单元格值编辑
			const cellValuePermission = new WorksheetSetCellValuePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(cellValuePermission.id)) {
				permissionService.addPermissionPoint(cellValuePermission)
			}
			permissionService.updatePermissionPoint(cellValuePermission.id, true)

			// 启用单元格样式编辑
			const cellStylePermission = new WorksheetSetCellStylePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(cellStylePermission.id)) {
				permissionService.addPermissionPoint(cellStylePermission)
			}
			permissionService.updatePermissionPoint(cellStylePermission.id, true)

			// 启用工作簿编辑权限
			const workbookEditablePermission = new WorkbookEditablePermission(unitId)
			if (!permissionService.getPermissionPoint(workbookEditablePermission.id)) {
				permissionService.addPermissionPoint(workbookEditablePermission)
			}
			permissionService.updatePermissionPoint(workbookEditablePermission.id, true)

			// 启用列样式权限
			const columnStylePermission = new WorksheetSetColumnStylePermission(unitId, worksheetId)
			if (!permissionService.getPermissionPoint(columnStylePermission.id)) {
				permissionService.addPermissionPoint(columnStylePermission)
			}
			permissionService.updatePermissionPoint(columnStylePermission.id, true)

			console.log("[UniverRenderer] ✅ 已启用编辑模式")
		}
	}
}

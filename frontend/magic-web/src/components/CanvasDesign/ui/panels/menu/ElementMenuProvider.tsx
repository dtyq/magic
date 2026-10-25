import {
	useState,
	useCallback,
	useRef,
	useMemo,
	useLayoutEffect,
	useEffect,
	type PropsWithChildren,
} from "react"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
	ContextMenuLabel,
} from "../../primitives/shadcn/context-menu"
import { ElementMenuContext } from "./ElementMenuContext"
import { getMenuItems } from "./getMenuItems"
import { MenuItemRenderer } from "./MenuItemRenderer"
import type { MenuItem, MenuOption, MenuSource } from "./types"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import { useCanvasUI } from "../../../app/providers/CanvasUIProvider"
import { useCanvasEvent } from "../../../app/hooks/canvas"
import { useUpdateEffect } from "ahooks"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { ClipboardPaste, Film, Image, Mic, Plus, Redo2, Undo2, Upload } from "lucide-react"
import { getShortcutDisplay } from "../../../runtime/shared/lib/index"
import {
	resolveCanvasDownloadMenuContext,
	type CanvasDownloadMenuContext,
} from "./resolveCanvasDownloadMenuContext"
import { getLoadedImageElements } from "../../../runtime/shared/ids"
import { getActiveContent } from "../../../runtime/document/elementContent"
import { getCreateElementMenuItems, type CreateElementMenuKind } from "./createElementMenuItems"
import { useSeedanceComplianceAction } from "./useSeedanceComplianceAction"
import { ElementTypeEnum } from "../../../runtime/document/types"
import type { CanvasOpenSaveAssetDialogParams } from "../../../public/magic-types"
import {
	getCanvasResourceFileName,
	parseAssetResourcePath,
	resolveCanvasStorageResourceReference,
} from "../../../runtime/shared/path/canvasResourcePath"
import styles from "./index.module.css"

export function ElementMenuProvider(props: PropsWithChildren<unknown>) {
	const { children } = props
	const { t } = useCanvasDesignI18n()
	const [currentElementId, setCurrentElementId] = useState<string | null>(null)
	const [menuKey, setMenuKey] = useState(0)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isClickEnabled, setIsClickEnabled] = useState(false)
	const [isCanvasMenu, setIsCanvasMenu] = useState(false)
	const [isCanvasCreateMenu, setIsCanvasCreateMenu] = useState(false)
	const [canvasMenuPosition, setCanvasMenuPosition] = useState<{
		x: number
		y: number
	} | null>(null)
	/** resource:image:loaded 时递增，触发下载菜单按资源管理器缓存重算 */
	const [fileInfoEpoch, setFileInfoEpoch] = useState(0)
	const [downloadMenuContext, setDownloadMenuContext] = useState<CanvasDownloadMenuContext>({
		useAiImageSubmenu: false,
		selectionKind: "none",
	})
	const menuSource = useRef<MenuSource | null>(null)
	const isMenuOpenRef = useRef(false)

	const triggerRef = useRef<HTMLDivElement>(null)

	const { canvas } = useCanvas()
	const { imageModelList, methods, permissions, videoModelList } = useMagic()
	const { selectedElementIds, setLayerRenamingElementId, closeCanvasRename } = useCanvasUI()

	const MENU_WIDTH = 220

	const getSaveAssetDialogParams = useCallback(
		(elementId: string): CanvasOpenSaveAssetDialogParams | undefined => {
			if (!canvas || !methods?.resolveResourceReference) return undefined
			const element = canvas.elementManager.getElementData(elementId)
			if (
				!element ||
				(element.type !== ElementTypeEnum.Image && element.type !== ElementTypeEnum.Video)
			) {
				return undefined
			}

			const effectiveContent =
				typeof canvas.getEffectiveContent === "function"
					? canvas.getEffectiveContent<{
							contentId: string
							src?: string
							assetId?: string
						}>(element.id)
					: undefined
			const content = effectiveContent ?? getActiveContent(element)
			const path = content?.src
			if (!content || !path) return undefined
			// 已绑定素材库的 Content 不能再次保存为新素材。画布合规流程也会把
			// 后端创建的 assetId 写回同一个 Content，因此无需依赖旧的检查字段拦截。
			if (content.assetId?.trim() || parseAssetResourcePath(path)) return undefined

			const resolution = resolveCanvasStorageResourceReference(
				path,
				methods.resolveResourceReference,
			)
			if (
				resolution.status !== "resolved" ||
				resolution.resourceKind !== "workspace-file" ||
				!resolution.workspacePath
			) {
				return undefined
			}

			const fileName = getCanvasResourceFileName(resolution.workspacePath)
			return {
				elementId: element.id,
				contentId: content.contentId,
				path,
				name: element.name || fileName.replace(/\.[^.]+$/, "") || undefined,
			}
		},
		[canvas, methods],
	)

	const handleSaveAsset = useCallback(
		(elementId: string) => {
			const params = getSaveAssetDialogParams(elementId)
			if (params) methods?.openSaveAssetToLibraryDialog?.(params)
		},
		[getSaveAssetDialogParams, methods],
	)

	const saveAssetMenuConfig = useMemo(
		() => ({
			onSaveAsset: handleSaveAsset,
			canSaveAsset: (elementId: string) =>
				Boolean(
					methods?.openSaveAssetToLibraryDialog && getSaveAssetDialogParams(elementId),
				),
		}),
		[getSaveAssetDialogParams, handleSaveAsset, methods],
	)
	const { canCheckCompliance, checkCompliance } = useSeedanceComplianceAction()
	const complianceMenuConfig = useMemo(
		() => ({
			onCheckCompliance: (elementId: string) => {
				void checkCompliance(elementId)
			},
			canCheckCompliance,
		}),
		[canCheckCompliance, checkCompliance],
	)

	// 菜单打开时触发未换链图片的 loadResource；resource:image:loaded 后刷新下载子菜单
	useLayoutEffect(() => {
		isMenuOpenRef.current = isMenuOpen
	}, [isMenuOpen])

	useLayoutEffect(() => {
		if (!isMenuOpen || isCanvasMenu || !canvas) return
		void (async () => {
			const images = getLoadedImageElements(canvas)
			for (const img of images) {
				const src =
					(typeof canvas.getEffectiveContent === "function"
						? (canvas.getEffectiveContent(img.id) as { src?: string } | undefined)
						: undefined
					)?.src ?? getActiveImageContent(img).src
				if (!src) continue
				const entry = await canvas.imageResourceManager.getEntry(src)
				if (entry?.fileName) continue
				canvas.imageResourceManager.loadResource(src)
			}
		})()
	}, [isMenuOpen, isCanvasMenu, canvas, menuKey, selectedElementIds, currentElementId])

	useEffect(() => {
		if (!canvas) return
		let cancelled = false
		void resolveCanvasDownloadMenuContext(canvas).then((ctx) => {
			if (!cancelled) setDownloadMenuContext(ctx)
		})
		return () => {
			cancelled = true
		}
	}, [canvas, fileInfoEpoch, currentElementId, selectedElementIds, isCanvasMenu])

	useCanvasEvent(
		"resource:image:loaded",
		() => {
			if (!isMenuOpenRef.current) return
			setFileInfoEpoch((n) => n + 1)
		},
		[],
	)

	// 替换开始后，右键菜单中的下载/定位等项目可能已经是旧快照；
	// 关闭菜单，让下一次打开时重新按 UserAction.canExecute 计算。
	useCanvasEvent(
		"element:media:replaceStateChanged",
		({ data }) => {
			if (data.status !== "uploading" && data.status !== "applying") return
			setMenuKey((previous) => previous + 1)
			setIsMenuOpen(false)
			setCurrentElementId(null)
			setIsCanvasMenu(false)
			setCanvasMenuPosition(null)
			setIsClickEnabled(false)
			menuSource.current = null
		},
		[],
	)

	// 监听菜单打开/关闭状态，控制 pan 和缩放
	// 只有当菜单是从画布打开时，才禁用 pan 和缩放
	useUpdateEffect(() => {
		if (!canvas) return
		if (isMenuOpen && menuSource.current === "canvas") {
			canvas.viewportController.disablePanZoom()
		} else {
			canvas.viewportController.enablePanZoom()
		}
	}, [isMenuOpen])

	// 处理元素选中逻辑（公共逻辑）
	const handleElementSelection = useCallback(
		(elementId: string) => {
			if (!canvas) return

			// 右键已选元素时保留多选；右键选区外元素时切回单选，避免意外批量下载。
			if (selectedElementIds.length > 1) {
				if (!selectedElementIds.includes(elementId)) {
					canvas.selectionManager.replaceSelection([elementId])
				}
			} else {
				// 单选或未选中状态，选中该元素
				canvas.selectionManager.replaceSelection([elementId])
			}
		},
		[canvas, selectedElementIds],
	)

	// 触发菜单显示（公共逻辑）
	const triggerMenuDisplay = useCallback((x: number, y: number) => {
		requestAnimationFrame(() => {
			if (triggerRef.current) {
				const contextMenuEvent = new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					clientX: x,
					clientY: y,
				})
				triggerRef.current.dispatchEvent(contextMenuEvent)
			}
		})
	}, [])

	// 清理菜单项：移除首尾分隔符和相邻的多个分隔符（递归处理子菜单）
	const cleanMenuItems = useCallback((items: MenuItem[]): MenuItem[] => {
		// 先过滤掉不可见的菜单项
		const visibleItems = items.filter((item) => {
			if ("type" in item && item.type === "separator") {
				return true
			}
			const option = item as MenuOption
			return !option.visible || option.visible()
		})

		if (visibleItems.length === 0) return []

		const cleaned: MenuItem[] = []
		let prevWasSeparator = false

		for (let i = 0; i < visibleItems.length; i++) {
			const item = visibleItems[i]
			const isSeparator = "type" in item && item.type === "separator"

			// 跳过首部的分隔符
			if (i === 0 && isSeparator) {
				continue
			}

			// 跳过尾部的分隔符
			if (i === visibleItems.length - 1 && isSeparator) {
				continue
			}

			// 跳过相邻的多个分隔符
			if (isSeparator && prevWasSeparator) {
				continue
			}

			// 如果是菜单项且有子菜单，递归清理子菜单
			if (!isSeparator) {
				const option = item as MenuOption
				if (option.children && option.children.length > 0) {
					cleaned.push({
						...option,
						children: cleanMenuItems(option.children),
					})
					prevWasSeparator = false
					continue
				}
			}

			cleaned.push(item)
			prevWasSeparator = isSeparator
		}

		// 再次检查并移除首尾的分隔符（可能在清理过程中又出现了）
		while (cleaned.length > 0) {
			const first = cleaned[0]
			const last = cleaned[cleaned.length - 1]
			const firstIsSeparator = "type" in first && first.type === "separator"
			const lastIsSeparator = "type" in last && last.type === "separator"

			if (firstIsSeparator) {
				cleaned.shift()
			} else if (lastIsSeparator) {
				cleaned.pop()
			} else {
				break
			}
		}

		return cleaned
	}, [])

	const handleRenameElement = useCallback(
		(elementId: string, source: MenuSource | null) => {
			if (!canvas) return

			if (source === "layers") {
				closeCanvasRename()
				setLayerRenamingElementId(elementId)
				return
			}

			setLayerRenamingElementId(null)
			canvas.elementRenameManager.startRename(elementId)
		},
		[canvas, closeCanvasRename, setLayerRenamingElementId],
	)

	const canRenameElement = useCallback(
		(elementId: string) => {
			if (!canvas) return false

			return canvas.elementRenameManager.canRename(elementId)
		},
		[canvas],
	)

	// 预计算元素菜单项数量（用于决定是否展开菜单）
	const getElementMenuItemsCount = useCallback(
		async (elementId: string, source: MenuSource) => {
			void fileInfoEpoch
			if (!canvas) return 0
			const ctx = await resolveCanvasDownloadMenuContext(canvas)
			return cleanMenuItems(
				getMenuItems({
					canvas,
					selectedIds: canvas.selectionManager.getSelectedIds(),
					currentElementId: elementId,
					t,
					downloadMenuContext: ctx,
					renameMenuConfig: {
						menuSource: source,
						onRenameElement: handleRenameElement,
						canRenameElement,
					},
					saveAssetMenuConfig,
					complianceMenuConfig,
					permissions,
				}),
			).length
		},
		[
			canvas,
			t,
			cleanMenuItems,
			fileInfoEpoch,
			handleRenameElement,
			canRenameElement,
			saveAssetMenuConfig,
			complianceMenuConfig,
			permissions,
		],
	)

	// 打开菜单
	const openMenu = useCallback(
		(event: React.MouseEvent, elementId: string, source: MenuSource = "layers") => {
			event.preventDefault()
			event.stopPropagation()
			// 须先同步画布选区：canExecute 依赖 selectionManager，否则会误判菜单为空
			handleElementSelection(elementId)
			void (async () => {
				if ((await getElementMenuItemsCount(elementId, source)) === 0) return
				menuSource.current = source
				setCurrentElementId(elementId)
				setMenuKey((prev) => prev + 1)
				triggerMenuDisplay(event.clientX, event.clientY)
			})()
		},
		[handleElementSelection, triggerMenuDisplay, getElementMenuItemsCount],
	)

	// 打开菜单（通过坐标）
	const openMenuByPosition = useCallback(
		(elementId: string, x: number, y: number, source: MenuSource = "canvas") => {
			// 须先同步画布选区：canExecute 依赖 selectionManager，否则会误判菜单为空
			handleElementSelection(elementId)
			void (async () => {
				if ((await getElementMenuItemsCount(elementId, source)) === 0) return
				menuSource.current = source
				setCurrentElementId(elementId)
				setMenuKey((prev) => prev + 1)
				triggerMenuDisplay(x, y)
			})()
		},
		[handleElementSelection, triggerMenuDisplay, getElementMenuItemsCount],
	)

	// 获取画布空白区域的菜单项（只有粘贴项），position 用于预计算时传入即将使用的位置
	const getCanvasPasteMenuItems = useCallback(
		(position?: { x: number; y: number }): MenuItem[] => {
			if (!canvas || !canvas.permissionManager.can("document.write")) return []

			const translate = (key: string, fallback: string) => {
				return t ? t(key, fallback) : fallback
			}
			const pastePosition = position ?? canvasMenuPosition

			// 只返回粘贴项
			return [
				{
					id: "paste",
					label: translate("menu.paste", "粘贴"),
					icon: ClipboardPaste,
					shortcut: getShortcutDisplay("edit.paste"),
					onClick: async () => {
						// 菜单粘贴路径没有浏览器同步 ClipboardEvent，只能依赖 Clipboard API read()。
						// 如果系统文件只在 paste event 中暴露字节，菜单粘贴无法补齐文件内容。
						await canvas.userActionRegistry.execute("edit.paste", {
							pastePosition: pastePosition || undefined,
							pasteSource: "menu",
						})
					},
					visible: () => {
						return canvas.userActionRegistry.canExecute("edit.paste")
					},
				},
			]
		},
		[canvas, t, canvasMenuPosition],
	)

	const createElementAtCanvasPoint = useCallback(
		(kind: CreateElementMenuKind, position?: { x: number; y: number }) => {
			const targetPosition = position ?? canvasMenuPosition
			if (!canvas || !canvas.permissionManager.can("document.write") || !targetPosition)
				return

			if (kind === "text") {
				canvas.textEditingManager.startCreatingAt(targetPosition.x, targetPosition.y)
				return
			}

			if (kind === "audio-generator") {
				canvas.toolManager
					.getAudioGeneratorTool()
					.createAudioAtCanvasPoint(targetPosition.x, targetPosition.y)
				return
			}

			if (kind === "image-generator") {
				canvas.toolManager
					.getImageGeneratorTool()
					.createImageAtCanvasPoint(targetPosition.x, targetPosition.y, imageModelList)
				return
			}

			canvas.toolManager
				.getVideoGeneratorTool()
				.createVideoAtCanvasPoint(targetPosition.x, targetPosition.y, videoModelList)
		},
		[canvas, canvasMenuPosition, imageModelList, videoModelList],
	)

	const getCanvasCreateMenuItems = useCallback(
		(position?: { x: number; y: number }): MenuItem[] => {
			const targetPosition = position ?? canvasMenuPosition
			if (!canvas || !canvas.permissionManager.can("document.write") || !targetPosition)
				return []

			const translate = (key: string, fallback: string) => {
				return t ? t(key, fallback) : fallback
			}

			return getCreateElementMenuItems({
				idPrefix: "canvas-create",
				translate,
				onSelect: (kind) => createElementAtCanvasPoint(kind, targetPosition),
				translationKeys: {
					text: "menu.createText",
					imageGenerator: "menu.createImageGenerator",
					videoGenerator: "menu.createVideoGenerator",
					audioGenerator: "menu.createAudioGenerator",
				},
			})
		},
		[canvas, canvasMenuPosition, createElementAtCanvasPoint, t],
	)

	const getCanvasUploadMenuItems = useCallback(
		(position?: { x: number; y: number }): MenuItem[] => {
			const targetPosition = position ?? canvasMenuPosition
			if (!canvas || !targetPosition || !canvas.permissionManager.can("document.write"))
				return []

			const requestUpload = (mediaType: "image" | "video" | "audio") => {
				canvas.eventEmitter.emit({
					type: "ui:upload:request",
					data: { mediaType, position: targetPosition },
				})
			}
			return [
				{
					id: "canvas-upload",
					label: t("tools.upload", "上传"),
					icon: Upload,
					children: [
						{
							id: "canvas-upload-image",
							label: t("tools.uploadImage", "上传图片"),
							icon: Image,
							onClick: () => requestUpload("image"),
						},
						{
							id: "canvas-upload-video",
							label: t("tools.uploadVideo", "上传视频"),
							icon: Film,
							onClick: () => requestUpload("video"),
						},
						{
							id: "canvas-upload-audio",
							label: t("tools.uploadAudio", "上传音频"),
							icon: Mic,
							onClick: () => requestUpload("audio"),
						},
					],
				},
			]
		},
		[canvas, canvasMenuPosition, t],
	)

	const getCanvasMenuItems = useCallback(
		(position?: { x: number; y: number }): MenuItem[] => {
			if (!canvas || !canvas.permissionManager.can("document.write")) return []
			return [
				...getCanvasUploadMenuItems(position),
				{
					id: "canvas-add-node",
					label: t("menu.addNode", "添加节点"),
					icon: Plus,
					children: getCanvasCreateMenuItems(position),
				},
				{ type: "separator" },
				{
					id: "canvas-undo",
					label: t("menu.undo", "撤销"),
					icon: Undo2,
					shortcut: getShortcutDisplay("edit.undo"),
					disabled: () => !canvas.userActionRegistry.canExecute("edit.undo"),
					onClick: () => {
						void canvas.userActionRegistry.execute("edit.undo")
					},
				},
				{
					id: "canvas-redo",
					label: t("menu.redo", "重做"),
					icon: Redo2,
					shortcut: getShortcutDisplay("edit.redo"),
					disabled: () => !canvas.userActionRegistry.canExecute("edit.redo"),
					onClick: () => {
						void canvas.userActionRegistry.execute("edit.redo")
					},
				},
				{ type: "separator" },
				...getCanvasPasteMenuItems(position),
			]
		},
		[canvas, t, getCanvasUploadMenuItems, getCanvasCreateMenuItems, getCanvasPasteMenuItems],
	)

	// 获取菜单项
	const menuItems = useMemo(() => {
		void fileInfoEpoch
		if (!canvas) return []

		// 画布空白区域菜单根据触发方式显示粘贴项或创建项
		if (isCanvasMenu) {
			if (isCanvasCreateMenu)
				return [
					...getCanvasCreateMenuItems(),
					{ type: "separator" } as const,
					...getCanvasUploadMenuItems(),
				]
			return getCanvasMenuItems()
		}

		const items = getMenuItems({
			canvas,
			selectedIds: canvas.selectionManager.getSelectedIds(),
			currentElementId,
			t,
			downloadMenuContext,
			renameMenuConfig: {
				menuSource: menuSource.current,
				onRenameElement: handleRenameElement,
				canRenameElement,
			},
			saveAssetMenuConfig,
			complianceMenuConfig,
			permissions,
		})
		return cleanMenuItems(items)
	}, [
		canvas,
		currentElementId,
		t,
		cleanMenuItems,
		isCanvasMenu,
		isCanvasCreateMenu,
		getCanvasCreateMenuItems,
		getCanvasUploadMenuItems,
		getCanvasMenuItems,
		fileInfoEpoch,
		handleRenameElement,
		canRenameElement,
		saveAssetMenuConfig,
		complianceMenuConfig,
		permissions,
		downloadMenuContext,
	])

	// 处理菜单打开/关闭状态变化
	const handleMenuOpenChange = useCallback((open: boolean) => {
		setIsMenuOpen(open)
		if (open) {
			// 菜单打开时，延迟启用点击，防止右键拖动误触发
			setIsClickEnabled(false)
			setTimeout(() => {
				setIsClickEnabled(true)
			}, 150)
		} else {
			// 如果菜单关闭，清空当前元素 ID 和菜单来源
			menuSource.current = null
			setCurrentElementId(null)
			setIsCanvasMenu(false)
			setIsCanvasCreateMenu(false)
			setCanvasMenuPosition(null)
			setIsClickEnabled(false)
		}
	}, [])

	// 监听 Canvas 层的右键菜单事件
	useCanvasEvent(
		"element:contextmenu",
		useCallback(
			({ data }) => {
				const { elementId, x, y } = data
				setIsCanvasMenu(false)
				setCanvasMenuPosition(null)
				openMenuByPosition(elementId, x, y, "canvas")
			},
			[openMenuByPosition],
		),
		[openMenuByPosition],
	)

	// 监听画布空白区域的右键菜单事件
	useCanvasEvent(
		"canvas:contextmenu",
		useCallback(
			({ data }) => {
				const { x, y, canvasX, canvasY } = data
				const canvasItems = cleanMenuItems(getCanvasMenuItems({ x: canvasX, y: canvasY }))
				if (canvasItems.length === 0) return
				setIsCanvasMenu(true)
				setIsCanvasCreateMenu(false)
				setCanvasMenuPosition({ x: canvasX, y: canvasY })
				setCurrentElementId(null)
				menuSource.current = "canvas"
				setMenuKey((prev) => prev + 1)
				triggerMenuDisplay(x, y)
			},
			[triggerMenuDisplay, cleanMenuItems, getCanvasMenuItems],
		),
		[triggerMenuDisplay, cleanMenuItems, getCanvasMenuItems],
	)

	// 监听画布空白区域的左键双击菜单事件
	useCanvasEvent(
		"canvas:dblclick",
		useCallback(
			({ data }) => {
				if (!canvas || !canvas.permissionManager.can("document.write")) return
				if (canvas.toolManager.getActiveTool() !== canvas.toolManager.getSelectionTool()) {
					return
				}

				const { x, y, canvasX, canvasY } = data
				const position = { x: canvasX, y: canvasY }
				const canvasItems = cleanMenuItems(getCanvasCreateMenuItems(position))
				if (canvasItems.length === 0) return

				setIsCanvasMenu(true)
				setIsCanvasCreateMenu(true)
				setCanvasMenuPosition(position)
				setCurrentElementId(null)
				menuSource.current = "canvas"
				setMenuKey((prev) => prev + 1)
				triggerMenuDisplay(x, y)
			},
			[canvas, cleanMenuItems, getCanvasCreateMenuItems, triggerMenuDisplay],
		),
		[canvas, cleanMenuItems, getCanvasCreateMenuItems, triggerMenuDisplay],
	)

	return (
		<ElementMenuContext.Provider value={{ openMenu, openMenuAt: openMenuByPosition }}>
			<ContextMenu key={menuKey} onOpenChange={handleMenuOpenChange}>
				<ContextMenuTrigger asChild>
					<div
						ref={triggerRef}
						style={{
							position: "absolute",
							width: 0,
							height: 0,
							pointerEvents: "none",
							visibility: "hidden",
						}}
					/>
				</ContextMenuTrigger>
				<ContextMenuContent
					className={`box-border data-[state=closed]:hidden data-[state=closed]:!animate-none data-[state=closed]:!transition-none data-[state=closed]:!duration-0 ${isCanvasMenu ? styles.canvasMenu : ""}`}
					style={isCanvasMenu ? undefined : { width: MENU_WIDTH, minWidth: MENU_WIDTH }}
					data-canvas-ui-component
					onCloseAutoFocus={(event) => {
						event.preventDefault()
					}}
				>
					{((isCanvasMenu && !!menuItems.length) ||
						(currentElementId && !!menuItems.length)) && (
						<>
							{isCanvasMenu && isCanvasCreateMenu && (
								<ContextMenuLabel className="text-xs font-normal text-muted-foreground">
									{t("menu.addNode", "添加节点")}
								</ContextMenuLabel>
							)}
							<MenuItemRenderer
								menuWidth={MENU_WIDTH}
								items={menuItems}
								isClickEnabled={isClickEnabled}
								// 子菜单以菜单行定位，与主菜单边缘轻微搭接，保持连续层级。
								submenuSideOffset={isCanvasMenu ? 3 : undefined}
							/>
						</>
					)}
				</ContextMenuContent>
			</ContextMenu>
			{children}
		</ElementMenuContext.Provider>
	)
}

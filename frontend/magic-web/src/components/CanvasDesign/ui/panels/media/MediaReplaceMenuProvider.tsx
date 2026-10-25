import { useCallback, useEffect, useState, type CSSProperties, type PropsWithChildren } from "react"
import { useCanvasEvent } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { getActiveContent } from "../../../runtime/document/elementContent"
import { ElementTypeEnum, type MediaElementType } from "../../../runtime/document/types"
import ReferenceResourcePopover from "../../editors/message/reference-assets/ReferenceResourcePopover"
import {
	REFERENCE_RESOURCE_SOURCE_TYPES,
	REFERENCE_RESOURCE_TYPES,
	type ReferenceResourceSourceType,
} from "../../editors/message/reference-assets/reference-resource.types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../public/props"

interface MediaReplaceMenuState {
	elementId: string
	mediaType: MediaElementType
	contentId: string | null
	x: number
	y: number
	anchorElement?: HTMLElement
}

/** 将三类媒体替换入口桥接到同一个本地上传/项目文件来源菜单。 */
export function MediaReplaceMenuProvider({ children }: PropsWithChildren<unknown>) {
	const { canvas } = useCanvas()
	const [menu, setMenu] = useState<MediaReplaceMenuState | null>(null)

	const openMenu = useCallback(
		(options: {
			elementId: string
			mediaType: MediaElementType
			contentId: string | null
			anchorElement?: HTMLElement
			anchorRect?: { left: number; top: number; width: number; height: number }
			clientX?: number
			clientY?: number
		}) => {
			if (!canvas || !canvas.permissionManager.can("document.write")) return
			if (canvas.mediaReplaceController.getReplacementState()) return
			const bounds = canvas.container.getBoundingClientRect()
			const anchorRect = options.anchorElement?.getBoundingClientRect() ?? options.anchorRect
			const anchorX = anchorRect
				? anchorRect.left
				: (options.clientX ?? bounds.left + bounds.width / 2)
			const anchorY = anchorRect
				? anchorRect.top + anchorRect.height
				: (options.clientY ?? bounds.top + bounds.height / 2)
			setMenu({
				elementId: options.elementId,
				mediaType: options.mediaType,
				contentId: options.contentId,
				x: anchorX - bounds.left,
				y: anchorY - bounds.top,
				anchorElement: options.anchorElement,
			})
		},
		[canvas],
	)

	useEffect(() => {
		const anchorElement = menu?.anchorElement
		if (!canvas || !anchorElement) return

		let animationFrameId = 0
		const updateAnchorPosition = () => {
			if (!anchorElement.isConnected) {
				setMenu((current) => (current?.anchorElement === anchorElement ? null : current))
				return
			}

			const bounds = canvas.container.getBoundingClientRect()
			const anchorRect = anchorElement.getBoundingClientRect()
			const x = anchorRect.left - bounds.left
			const y = anchorRect.bottom - bounds.top
			setMenu((current) => {
				if (
					!current ||
					current.anchorElement !== anchorElement ||
					(current.x === x && current.y === y)
				)
					return current
				return { ...current, x, y }
			})
			animationFrameId = requestAnimationFrame(updateAnchorPosition)
		}

		animationFrameId = requestAnimationFrame(updateAnchorPosition)
		return () => cancelAnimationFrame(animationFrameId)
	}, [canvas, menu?.anchorElement])

	useCanvasEvent(
		"element:media:replaceClick",
		useCallback(({ data }) => openMenu(data), [openMenu]),
		[openMenu],
	)

	useCanvasEvent(
		"element:image:replaceClick",
		useCallback(
			({ data }) => openMenu({ ...data, mediaType: ElementTypeEnum.Image }),
			[openMenu],
		),
		[openMenu],
	)

	// 兼容音频元素内部角落按钮；其点击时同步捕获当前 Content。
	useCanvasEvent(
		"element:audio:replaceClick",
		useCallback(
			({ data }) => {
				const element = canvas?.elementManager.getElementData(data.elementId)
				const contentId =
					element?.type === ElementTypeEnum.Audio
						? (canvas?.getEffectiveContentId?.(element.id) ??
							getActiveContent(element)?.contentId ??
							null)
						: null
				openMenu({ ...data, mediaType: ElementTypeEnum.Audio, contentId })
			},
			[canvas, openMenu],
		),
		[canvas, openMenu],
	)

	useCanvasEvent(
		"element:media:replaceStateChanged",
		useCallback(({ data }) => {
			if (data.status === "uploading" || data.status === "applying") {
				setMenu(null)
			}
		}, []),
		[],
	)

	const handleOpenChange = useCallback((open: boolean) => {
		if (!open) setMenu(null)
	}, [])

	const handleSelectSource = useCallback(
		(source: ReferenceResourceSourceType) => {
			if (!canvas || !menu || source !== REFERENCE_RESOURCE_SOURCE_TYPES.localUpload) return
			if (canvas.mediaReplaceController.getReplacementState()) {
				setMenu(null)
				return
			}
			const target = {
				elementId: menu.elementId,
				mediaType: menu.mediaType,
				contentId: menu.contentId,
			}
			setMenu(null)
			canvas.mediaReplaceController.openLocalFilePicker(target)
		},
		[canvas, menu],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			if (!canvas || !menu) return
			if (canvas.mediaReplaceController.getReplacementState()) {
				setMenu(null)
				return
			}
			const target = {
				elementId: menu.elementId,
				mediaType: menu.mediaType,
				contentId: menu.contentId,
				path: item.data.file_path,
			}
			context?.reset?.()
			setMenu(null)
			void canvas.mediaReplaceController.replaceWithProjectFile(target)
		},
		[canvas, menu],
	)

	const anchorStyle = menu
		? ({
				position: "absolute",
				left: menu.x,
				top: menu.y,
				width: 1,
				height: 1,
				pointerEvents: "none",
				zIndex: 60,
			} satisfies CSSProperties)
		: undefined

	return (
		<>
			{children}
			{menu && (
				<div style={anchorStyle} data-canvas-ui-component>
					<ReferenceResourcePopover
						open
						onOpenChange={handleOpenChange}
						onMouseEnter={() => undefined}
						onMouseLeave={() => undefined}
						trigger={<span aria-hidden />}
						triggerClassName="block size-px"
						onSelectSource={handleSelectSource}
						maxReferenceFiles={1}
						currentReferenceFiles={[]}
						isReferenceFileLimitReached={false}
						referenceResourceType={REFERENCE_RESOURCE_TYPES[menu.mediaType]}
						referenceFileInfos={[]}
						onProjectSelect={handleProjectSelect}
						maxProjectSelectBatchCount={1}
						enableProjectSelectMultiSelect={false}
					/>
				</div>
			)}
		</>
	)
}

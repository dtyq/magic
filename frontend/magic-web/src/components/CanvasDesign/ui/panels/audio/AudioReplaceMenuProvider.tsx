import { useCallback, useState, type CSSProperties, type PropsWithChildren } from "react"
import { useCanvasEvent } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
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

interface AudioReplaceMenuState {
	elementId: string
	x: number
	y: number
}

/** 将 Konva 音频替换按钮桥接到可复用的本地上传/项目文件来源菜单。 */
export function AudioReplaceMenuProvider({ children }: PropsWithChildren<unknown>) {
	const { canvas } = useCanvas()
	const [menu, setMenu] = useState<AudioReplaceMenuState | null>(null)

	useCanvasEvent(
		"element:audio:replaceClick",
		useCallback(
			({ data }) => {
				if (!canvas || !canvas.permissionManager.can("document.write")) return
				const bounds = canvas.container.getBoundingClientRect()
				setMenu({
					elementId: data.elementId,
					x: (data.clientX ?? bounds.left + bounds.width / 2) - bounds.left,
					y: (data.clientY ?? bounds.top + bounds.height / 2) - bounds.top,
				})
			},
			[canvas],
		),
		[canvas],
	)

	const handleOpenChange = useCallback((open: boolean) => {
		if (!open) setMenu(null)
	}, [])

	const handleSelectSource = useCallback(
		(source: ReferenceResourceSourceType) => {
			if (!canvas || !menu) return
			if (source !== REFERENCE_RESOURCE_SOURCE_TYPES.localUpload) return
			const elementId = menu.elementId
			setMenu(null)
			canvas.audioReplaceController.openLocalFilePicker(elementId)
		},
		[canvas, menu],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			if (!canvas || !menu) return
			const elementId = menu.elementId
			context?.reset?.()
			setMenu(null)
			void canvas.audioReplaceController.replaceWithProjectFile(
				elementId,
				item.data.file_path,
			)
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
						referenceResourceType={REFERENCE_RESOURCE_TYPES.audio}
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

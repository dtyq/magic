import { PopoverContent } from "@/opensource/components/shadcn-ui/popover"
import { CanvasMarkerMentionData } from "@/opensource/components/business/MentionPanel/types"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { cn } from "@/opensource/lib/utils"
import { useDebounceFn } from "ahooks"
import { memo, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import MarkerIcon from "./marker.svg"
import { useMarkerImageUrl } from "./useMarkerImageUrl"

interface MarkerDropdownProps {
	markerData: CanvasMarkerMentionData
	onSelect?: (index: number, customLabel?: string) => void
	onCustomLabelChange?: (label: string) => void
	popoverClassName?: string
	side?: "top" | "right" | "bottom" | "left"
	imageUrl?: string | null
}

function MarkerDropdown({
	markerData,
	onSelect,
	onCustomLabelChange,
	popoverClassName,
	side = "top",
	imageUrl: imageUrlProp,
}: MarkerDropdownProps) {
	const { t } = useTranslation("super")
	const suggestions = markerData.data?.result?.suggestions || []
	const selectedIndex = markerData.data?.selectedSuggestionIndex ?? 0
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
	const customInputRef = useRef<HTMLInputElement>(null)
	const THUMBNAIL_SIZE = 24

	const { imageUrl: imageUrlFromHook } = useMarkerImageUrl(
		imageUrlProp !== undefined ? undefined : markerData.image_path,
	)
	const imageUrl = imageUrlProp !== undefined ? imageUrlProp : imageUrlFromHook

	const getCropStyle = (
		bbox?: { x: number; y: number; width: number; height: number },
		aspectRatio?: number | null,
	) => {
		if (!bbox || bbox.width === 0 || bbox.height === 0) {
			return {
				outerContainerStyle: {
					width: THUMBNAIL_SIZE,
					height: THUMBNAIL_SIZE,
					border: "1px solid rgb(229, 229, 229)",
					borderRadius: "8px",
				},
				cropContainerStyle: {
					width: THUMBNAIL_SIZE,
					height: THUMBNAIL_SIZE,
					overflow: "hidden" as const,
				},
				imageStyle: {
					width: THUMBNAIL_SIZE,
					height: THUMBNAIL_SIZE,
					objectFit: "cover" as const,
				},
			}
		}

		const bboxAspectRatio = bbox.width / bbox.height

		let cropContainerWidth: number
		let cropContainerHeight: number

		if (bboxAspectRatio >= 1) {
			cropContainerWidth = THUMBNAIL_SIZE
			cropContainerHeight = THUMBNAIL_SIZE / bboxAspectRatio
		} else {
			cropContainerHeight = THUMBNAIL_SIZE
			cropContainerWidth = THUMBNAIL_SIZE * bboxAspectRatio
		}

		const centerX = bbox.x + bbox.width / 2
		const centerY = bbox.y + bbox.height / 2

		let scaledWidth: number
		let scaledHeight: number

		if (aspectRatio && aspectRatio > 0) {
			const scaleX = cropContainerWidth / bbox.width
			const scaleY = cropContainerHeight / bbox.height
			const scaledHeightFromX = scaleX / aspectRatio
			const meetsY = scaledHeightFromX * bbox.height >= cropContainerHeight

			if (meetsY) {
				scaledWidth = scaleX
				scaledHeight = scaledHeightFromX
			} else {
				scaledHeight = scaleY
				scaledWidth = scaledHeight * aspectRatio
			}
		} else {
			const scaleX = cropContainerWidth / bbox.width
			const scaleY = cropContainerHeight / bbox.height
			const scale = Math.max(scaleX, scaleY)
			scaledWidth = scale
			scaledHeight = scale
		}

		const offsetX = cropContainerWidth / 2 - centerX * scaledWidth
		const offsetY = cropContainerHeight / 2 - centerY * scaledHeight

		return {
			outerContainerStyle: {
				width: THUMBNAIL_SIZE,
				height: THUMBNAIL_SIZE,
				border: "1px solid rgb(229, 229, 229)",
				borderRadius: "8px",
				overflow: "hidden" as const,
			},
			cropContainerStyle: {
				width: cropContainerWidth,
				height: cropContainerHeight,
			},
			imageStyle: {
				maxWidth: "unset !important",
				maxHeight: "unset !important",
				width: scaledWidth,
				height: scaledHeight,
				transform: `translate(${offsetX}px, ${offsetY}px)`,
				transformOrigin: "top left",
			},
		}
	}

	const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const img = e.currentTarget
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			setImageAspectRatio(img.naturalWidth / img.naturalHeight)
		}
	}

	const existingCustom = suggestions.find((s) => s.kind === "custom")
	const existingCustomIndex = existingCustom
		? suggestions.findIndex((s) => s.kind === "custom")
		: -1
	const [customLabel, setCustomLabel] = useState<string>(existingCustom?.label || "")
	const CUSTOM_ITEM_INDEX = existingCustomIndex !== -1 ? existingCustomIndex : suggestions.length
	const isCustomSelected =
		existingCustomIndex !== -1
			? selectedIndex === existingCustomIndex
			: selectedIndex === suggestions.length

	const { run: debouncedUpdate } = useDebounceFn(
		(label: string) => {
			onCustomLabelChange?.(label)
		},
		{ wait: 300 },
	)

	const handleStopKeyboardEvent = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
		event.stopPropagation()
	}, [])

	const handleCustomInputMouseDown = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
		event.stopPropagation()
	}, [])

	const handleCustomInputClick = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
		event.stopPropagation()
		customInputRef.current?.focus()
	}, [])

	return (
		<PopoverContent
			side={side}
			className={cn("z-[1100] max-h-64 w-[220px] overflow-y-auto p-[10px]", popoverClassName)}
			onOpenAutoFocus={(event) => {
				// 避免 Popover 打开时自动聚焦到输入框，导致已有自定义文本被整段选中
				event.preventDefault()
			}}
		>
			<div className="mb-[10px] text-sm font-semibold">
				{t("messageEditor.markerDropdown.markedObjectTitle")}
			</div>
			<div className="flex flex-col gap-[4px]">
				{suggestions
					.filter((suggestion) => suggestion.kind !== "custom")
					.map((suggestion, index) => {
						const isSelected = index === selectedIndex
						const isHovered = hoveredIndex === index
						const cropStyle = getCropStyle(suggestion.bbox, imageAspectRatio)
						return (
							<div
								key={index}
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
									"hover:bg-accent hover:text-accent-foreground",
									isSelected && "bg-accent text-accent-foreground",
								)}
								onMouseEnter={() => setHoveredIndex(index)}
								onMouseLeave={() => setHoveredIndex(null)}
								onClick={() => onSelect?.(index)}
							>
								{imageUrl ? (
									<div
										className="relative flex flex-none shrink-0 items-center justify-center"
										style={cropStyle.outerContainerStyle}
									>
										<div
											className="rounded-md"
											style={cropStyle.cropContainerStyle}
										>
											<img
												src={imageUrl}
												alt={suggestion.label}
												style={cropStyle.imageStyle}
												onLoad={handleImageLoad}
											/>
										</div>
									</div>
								) : (
									<div className="h-6 w-6 shrink-0 rounded-md bg-muted" />
								)}
								<div className="flex-1 text-sm font-medium">{suggestion.label}</div>
								<Checkbox
									checked={isSelected}
									onCheckedChange={() => onSelect?.(index)}
									onClick={(event) => event.stopPropagation()}
									className={cn(
										"shrink-0",
										!(isHovered || isSelected) && "invisible",
									)}
								/>
							</div>
						)
					})}
				<div
					className={cn(
						"flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
						"hover:bg-accent hover:text-accent-foreground",
						isCustomSelected && "bg-accent text-accent-foreground",
					)}
					onMouseEnter={() => setHoveredIndex(CUSTOM_ITEM_INDEX)}
					onMouseLeave={() => setHoveredIndex(null)}
					onClick={(event) => {
						if ((event.target as HTMLElement).tagName === "INPUT") {
							return
						}
						const targetIndex =
							existingCustomIndex !== -1 ? existingCustomIndex : suggestions.length
						onSelect?.(targetIndex, customLabel)
					}}
				>
					<div
						className="flex flex-none shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
						style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
					>
						<img src={MarkerIcon} alt="marker" style={{ width: 18, height: 18 }} />
					</div>
					<Input
						ref={customInputRef}
						value={customLabel}
						onChange={(event) => {
							const value = event.target.value
							setCustomLabel(value)
							debouncedUpdate(value)
						}}
						placeholder={t("messageEditor.markerDropdown.customPlaceholder")}
						className="h-8 flex-1 text-sm"
						onMouseDown={handleCustomInputMouseDown}
						onClick={handleCustomInputClick}
						onKeyDown={handleStopKeyboardEvent}
						onKeyUp={handleStopKeyboardEvent}
						onKeyPress={handleStopKeyboardEvent}
					/>
					<Checkbox
						checked={isCustomSelected}
						onCheckedChange={() => {
							const targetIndex =
								existingCustomIndex !== -1
									? existingCustomIndex
									: suggestions.length
							onSelect?.(targetIndex, customLabel)
						}}
						onClick={(event) => event.stopPropagation()}
						className={cn(
							"shrink-0",
							!(hoveredIndex === CUSTOM_ITEM_INDEX || isCustomSelected) &&
								"invisible",
						)}
					/>
				</div>
			</div>
		</PopoverContent>
	)
}

export default memo(MarkerDropdown)

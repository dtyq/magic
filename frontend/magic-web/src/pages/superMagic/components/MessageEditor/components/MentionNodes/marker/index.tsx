import MarkerTooltipPreview from "./MarkerTooltipPreview"
import MarkerDropdown from "./MarkerDropdown"
import {
	PropsWithChildren,
	useState,
	useCallback,
	useRef,
	useEffect,
	type MouseEvent as ReactMouseEvent,
} from "react"
import { CanvasMarkerMentionData } from "@/components/business/MentionPanel/types"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/shadcn-ui/popover"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { observer } from "mobx-react-lite"
import { useUpdateEffect } from "ahooks"
import { createPortal } from "react-dom"
import {
	getCanvasMarkerMentionSuggestions,
	mergeCanvasMarkerMentionRecognitionData,
} from "@/components/business/MentionPanel/utils/canvasMarkerMention"

interface MarkerTooltipProps {
	isInMessageList: boolean
	markerData: CanvasMarkerMentionData | null
	onSuggestionSelect?: (index: number) => void
	loading?: boolean
	popoverClassName?: string
	parentPopoverOpen?: boolean
	side?: "top" | "right" | "bottom" | "left"
	imageUrl?: string | null
}

function MarkerTooltip(props: PropsWithChildren<MarkerTooltipProps>) {
	const {
		isInMessageList,
		markerData,
		children,
		onSuggestionSelect,
		loading = false,
		popoverClassName,
		parentPopoverOpen,
		side = "top",
		imageUrl,
	} = props

	const [previewOpen, setPreviewOpen] = useState(false)
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const triggerRef = useRef<HTMLDivElement>(null)
	const dropdownAnchorRef = useRef<HTMLDivElement>(null)
	const suppressNextFocusOutsideRef = useRef(false)

	const actualMarkerData = markerData

	const handlePreviewOpenChange = useCallback(
		(open: boolean) => {
			if (!dropdownOpen) {
				setPreviewOpen(open)
			}
		},
		[dropdownOpen],
	)

	const openDropdown = useCallback(() => {
		suppressNextFocusOutsideRef.current = true
		setDropdownOpen(true)
		setPreviewOpen(false)
	}, [])

	const closeDropdown = useCallback(() => {
		suppressNextFocusOutsideRef.current = false
		setDropdownOpen(false)
	}, [])

	const handleDropdownOpenChange = useCallback(
		(open: boolean) => {
			if (open && (loading || isInMessageList || !actualMarkerData)) {
				return
			}

			if (open) {
				openDropdown()
				return
			}

			closeDropdown()
		},
		[actualMarkerData, isInMessageList, loading, openDropdown, closeDropdown],
	)

	const handleClickCapture = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			const isRemoveClick = !!(event.target as HTMLElement).closest(
				'[data-marker-remove="true"]',
			)
			if (loading || isInMessageList || !actualMarkerData) {
				return
			}

			if (isRemoveClick) {
				return
			}

			openDropdown()
		},
		[actualMarkerData, isInMessageList, loading, openDropdown],
	)

	const handleClick = useCallback(() => {
		if (loading || isInMessageList || !actualMarkerData) {
			return
		}

		openDropdown()
	}, [actualMarkerData, isInMessageList, loading, openDropdown])

	const handleCustomLabelChange = useCallback(
		(label: string) => {
			if (isInMessageList || !actualMarkerData) {
				return
			}

			const suggestions = getCanvasMarkerMentionSuggestions(actualMarkerData)
			const existingCustomIndex = suggestions.findIndex(
				(suggestion) => suggestion.kind === "custom",
			)

			let updatedSuggestions = suggestions

			if (existingCustomIndex !== -1) {
				updatedSuggestions = [...suggestions]
				updatedSuggestions[existingCustomIndex] = {
					...updatedSuggestions[existingCustomIndex],
					label: label,
				}
			} else {
				const customSuggestion = {
					label: label,
					kind: "custom" as const,
				}
				updatedSuggestions = [...suggestions, customSuggestion]
			}

			if (actualMarkerData.marker_id) {
				pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
					markerId: actualMarkerData.marker_id,
					designProjectId: actualMarkerData.design_project_id,
					suggestions: updatedSuggestions,
					selectedSuggestionIndex: actualMarkerData.selected_suggestion_index,
				})
			}
		},
		[isInMessageList, actualMarkerData],
	)

	const handleSuggestionSelect = useCallback(
		(index: number, customLabel?: string) => {
			if (isInMessageList || !actualMarkerData) {
				onSuggestionSelect?.(index)
				return
			}

			onSuggestionSelect?.(index)

			const suggestions = getCanvasMarkerMentionSuggestions(actualMarkerData)
			const isCustomItem = index === suggestions.length

			let updatedData = actualMarkerData

			if (isCustomItem && customLabel) {
				const existingCustomIndex = suggestions.findIndex(
					(suggestion) => suggestion.kind === "custom",
				)

				if (existingCustomIndex !== -1) {
					const updatedSuggestions = [...suggestions]
					updatedSuggestions[existingCustomIndex] = {
						...updatedSuggestions[existingCustomIndex],
						label: customLabel,
					}
					updatedData = mergeCanvasMarkerMentionRecognitionData({
						data: actualMarkerData,
						suggestions: updatedSuggestions,
						selectedSuggestionIndex: existingCustomIndex,
					})
				} else {
					const customSuggestion = {
						label: customLabel,
						kind: "custom" as const,
					}
					const updatedSuggestions = [...suggestions, customSuggestion]
					updatedData = mergeCanvasMarkerMentionRecognitionData({
						data: actualMarkerData,
						suggestions: updatedSuggestions,
						selectedSuggestionIndex: updatedSuggestions.length - 1,
					})
				}
			} else {
				updatedData = mergeCanvasMarkerMentionRecognitionData({
					data: actualMarkerData,
					selectedSuggestionIndex: index,
				})
			}

			if (actualMarkerData.marker_id) {
				pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
					markerId: actualMarkerData.marker_id,
					designProjectId: actualMarkerData.design_project_id,
					suggestions: updatedData.suggestions,
					selectedSuggestionIndex: updatedData.selected_suggestion_index,
				})
			}
		},
		[isInMessageList, onSuggestionSelect, actualMarkerData],
	)

	const handleMouseEnter = useCallback(() => {
		if (!dropdownOpen) {
			setPreviewOpen(true)
		}
	}, [dropdownOpen])

	const handleMouseLeave = useCallback(() => {
		setPreviewOpen(false)
	}, [])

	useUpdateEffect(() => {
		if (parentPopoverOpen === false) {
			setPreviewOpen(false)
			closeDropdown()
		}
	}, [parentPopoverOpen, closeDropdown])

	useUpdateEffect(() => {
		if (!loading) return

		setPreviewOpen(false)
		closeDropdown()
	}, [loading, closeDropdown])

	useEffect(() => {
		if (!dropdownOpen || !triggerRef.current || !dropdownAnchorRef.current) {
			return
		}

		const updateAnchorPosition = () => {
			const rect = triggerRef.current?.getBoundingClientRect()
			const anchorElement = dropdownAnchorRef.current

			if (!rect || !anchorElement) {
				return
			}

			anchorElement.style.top = `${rect.top}px`
			anchorElement.style.left = `${rect.left}px`
			anchorElement.style.width = `${rect.width}px`
			anchorElement.style.height = `${rect.height}px`
		}

		updateAnchorPosition()
		window.addEventListener("scroll", updateAnchorPosition, true)
		window.addEventListener("resize", updateAnchorPosition)

		return () => {
			window.removeEventListener("scroll", updateAnchorPosition, true)
			window.removeEventListener("resize", updateAnchorPosition)
		}
	}, [dropdownOpen])

	const previewTriggerElement = (
		<div
			ref={triggerRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onClick={handleClick}
			onClickCapture={handleClickCapture}
		>
			{children}
		</div>
	)

	const triggerElement = loading ? (
		previewTriggerElement
	) : (
		<Popover open={previewOpen} onOpenChange={handlePreviewOpenChange} modal={false}>
			<PopoverAnchor asChild>{previewTriggerElement}</PopoverAnchor>
			<PopoverContent
				side={side}
				className={`z-[1100] w-auto bg-white p-0 ${popoverClassName || ""}`}
				onOpenAutoFocus={(event) => {
					event.preventDefault()
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
				}}
			>
				{actualMarkerData ? (
					<MarkerTooltipPreview markerData={actualMarkerData} imageUrl={imageUrl} />
				) : null}
			</PopoverContent>
		</Popover>
	)

	return (
		<>
			{triggerElement}
			<Popover open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
				{typeof document !== "undefined"
					? createPortal(
							<PopoverAnchor asChild>
								<div
									ref={dropdownAnchorRef}
									style={{
										position: "fixed",
										top: 0,
										left: 0,
										width: 0,
										height: 0,
										pointerEvents: "none",
									}}
								/>
							</PopoverAnchor>,
							document.body,
						)
					: null}
				{!loading && !isInMessageList && !!actualMarkerData && (
					<MarkerDropdown
						markerData={actualMarkerData}
						onSelect={handleSuggestionSelect}
						onCustomLabelChange={handleCustomLabelChange}
						popoverClassName={popoverClassName}
						side={side}
						imageUrl={imageUrl}
						onFocusOutside={(event) => {
							if (suppressNextFocusOutsideRef.current) {
								suppressNextFocusOutsideRef.current = false
								event.preventDefault()
							}
						}}
					/>
				)}
			</Popover>
		</>
	)
}

export default observer(MarkerTooltip)

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
import type { Marker } from "@/components/CanvasDesign/canvas/types"
import { createPortal } from "react-dom"

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

	const actualMarkerData = markerData

	const handlePreviewOpenChange = useCallback(
		(open: boolean) => {
			if (!dropdownOpen) {
				setPreviewOpen(open)
			}
		},
		[dropdownOpen],
	)

	const handleDropdownOpenChange = useCallback(
		(open: boolean) => {
			if (open && (loading || isInMessageList || !actualMarkerData)) {
				return
			}

			setDropdownOpen(open)
			if (open) {
				setPreviewOpen(false)
			}
		},
		[actualMarkerData, isInMessageList, loading],
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

			setDropdownOpen(true)
			setPreviewOpen(false)
		},
		[actualMarkerData, isInMessageList, loading],
	)

	const handleClick = useCallback(() => {
		if (loading || isInMessageList || !actualMarkerData) {
			return
		}

		setDropdownOpen(true)
		setPreviewOpen(false)
	}, [actualMarkerData, isInMessageList, loading])

	const handleCustomLabelChange = useCallback(
		(label: string) => {
			if (isInMessageList || !actualMarkerData) {
				return
			}

			const currentMarker = actualMarkerData.data
			if (!currentMarker?.result) return

			const suggestions = currentMarker.result.suggestions || []
			const existingCustomIndex = suggestions.findIndex(
				(suggestion) => suggestion.kind === "custom",
			)

			let updatedMarker: Marker

			if (existingCustomIndex !== -1) {
				const updatedSuggestions = [...suggestions]
				updatedSuggestions[existingCustomIndex] = {
					...updatedSuggestions[existingCustomIndex],
					label: label,
				}
				updatedMarker = {
					...currentMarker,
					result: {
						...currentMarker.result,
						suggestions: updatedSuggestions,
					},
				}
			} else {
				const customSuggestion = {
					label: label,
					kind: "custom" as const,
				}
				updatedMarker = {
					...currentMarker,
					result: {
						...currentMarker.result,
						suggestions: [...suggestions, customSuggestion],
					},
				}
			}

			if (currentMarker.id) {
				pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
					markerId: currentMarker.id,
					designProjectId: actualMarkerData.design_project_id,
					suggestions: updatedMarker.result?.suggestions,
					selectedSuggestionIndex: updatedMarker.selectedSuggestionIndex,
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

			const currentMarker = actualMarkerData.data
			if (!currentMarker?.result) return

			const suggestions = currentMarker.result.suggestions || []
			const isCustomItem = index === suggestions.length

			let updatedMarker: Marker

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
					updatedMarker = {
						...currentMarker,
						result: {
							...currentMarker.result,
							suggestions: updatedSuggestions,
						},
						selectedSuggestionIndex: existingCustomIndex,
					}
				} else {
					const customSuggestion = {
						label: customLabel,
						kind: "custom" as const,
					}
					const updatedSuggestions = [...suggestions, customSuggestion]
					updatedMarker = {
						...currentMarker,
						result: {
							...currentMarker.result,
							suggestions: updatedSuggestions,
						},
						selectedSuggestionIndex: updatedSuggestions.length - 1,
					}
				}
			} else {
				updatedMarker = {
					...currentMarker,
					selectedSuggestionIndex: index,
				}
			}

			if (currentMarker.id) {
				pubsub.publish(PubSubEvents.Super_Magic_Marker_Data_Updated, {
					markerId: currentMarker.id,
					designProjectId: actualMarkerData.design_project_id,
					suggestions: updatedMarker.result?.suggestions,
					selectedSuggestionIndex: updatedMarker.selectedSuggestionIndex,
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
			setDropdownOpen(false)
		}
	}, [parentPopoverOpen])

	useUpdateEffect(() => {
		if (!loading) return

		setPreviewOpen(false)
		setDropdownOpen(false)
	}, [loading])

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
					/>
				)}
			</Popover>
		</>
	)
}

export default observer(MarkerTooltip)

import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useModelSwitchSelection } from "./useModelSwitchSelection"
import type { ModelItem } from "../types"

const SCROLL_TO_SELECTED_DELAY_MS = 100

interface UseModelSwitchLogicProps {
	onModelClick: (model: ModelItem) => void
	shouldCloseOnSelect?: boolean
	onBeforeOpen?: () => Promise<void> | void
}

export function useModelSwitchLogic({
	onModelClick,
	onBeforeOpen,
	shouldCloseOnSelect,
}: UseModelSwitchLogicProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [searchKeyword, setSearchKeyword] = useState("")
	const isMobile = useIsMobile()
	const selectedItemRef = useRef<HTMLDivElement>(null)
	const desktopScrollContainerRef = useRef<HTMLDivElement>(null)
	const mobileScrollContainerRef = useRef<HTMLDivElement>(null)

	const { isOpeningModal, handleModelClick, resetIsOpeningModal } = useModelSwitchSelection({
		onModelClick,
		onModelSelected: () => {
			if (shouldCloseOnSelect ?? isMobile) {
				setIsOpen(false)
			}
			setSearchKeyword("")
		},
	})

	const handleClose = useMemoizedFn(() => {
		setIsOpen(false)
		setSearchKeyword("")
	})

	const handleOpenChange = useMemoizedFn(async (open: boolean) => {
		if (isOpeningModal) {
			resetIsOpeningModal()
			return
		}

		if (open) {
			try {
				await onBeforeOpen?.()
			} finally {
				setIsOpen(true)
			}
			return
		}

		setIsOpen(open)
	})

	// Auto scroll to selected model after dropdown opens
	useEffect(() => {
		if (isOpen) {
			setSearchKeyword("")
			setTimeout(() => {
				const selectedItem = selectedItemRef.current
				if (!selectedItem) return

				const scrollContainer = isMobile
					? mobileScrollContainerRef.current
					: desktopScrollContainerRef.current

				if (!scrollContainer) return

				const containerRect = scrollContainer.getBoundingClientRect()
				const itemRect = selectedItem.getBoundingClientRect()
				const scrollTop = scrollContainer.scrollTop
				const itemOffsetTop = itemRect.top - containerRect.top + scrollTop
				// 桌面分组标题吸顶，选中行要停在标题下方，否则会被标题盖住；移动端标题不吸顶，高度按 0 计。
				const groupHeader = scrollContainer.querySelector<HTMLElement>(
					"[data-model-switch-group-header]",
				)
				const stickyHeaderHeight =
					groupHeader && getComputedStyle(groupHeader).position === "sticky"
						? groupHeader.offsetHeight
						: 0
				const visibleTop = containerRect.top + stickyHeaderHeight
				// 选中行已经完整可见时不滚动，列表保持在开头，靠前的分组也能看到。
				if (itemRect.top >= visibleTop && itemRect.bottom <= containerRect.bottom) return

				scrollContainer.scrollTo({
					top: Math.max(0, itemOffsetTop - stickyHeaderHeight),
					behavior: "smooth",
				})
			}, SCROLL_TO_SELECTED_DELAY_MS)
		}
	}, [isOpen, isMobile])

	const getModelDescription = useMemoizedFn((model: ModelItem) => {
		return model.model_description
	})

	return {
		isOpen,
		setIsOpen,
		searchKeyword,
		setSearchKeyword,
		isOpeningModal,
		isMobile,
		selectedItemRef,
		desktopScrollContainerRef,
		mobileScrollContainerRef,
		handleModelClick,
		handleClose,
		handleOpenChange,
		getModelDescription,
	}
}

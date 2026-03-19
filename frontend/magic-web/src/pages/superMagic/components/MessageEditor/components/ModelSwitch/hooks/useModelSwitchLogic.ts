import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import { useModelSwitchSelection } from "./useModelSwitchSelection"
import type { ModelItem } from "../types"

const SCROLL_TO_SELECTED_DELAY_MS = 100

interface UseModelSwitchLogicProps {
	onModelClick: (model: ModelItem) => void
	shouldCloseOnSelect?: boolean
	onBeforeOpen?: () => Promise<void> | void
}

export function useModelSwitchLogic({ onModelClick, onBeforeOpen }: UseModelSwitchLogicProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [searchKeyword, setSearchKeyword] = useState("")
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const selectedItemRef = useRef<HTMLDivElement>(null)
	const desktopScrollContainerRef = useRef<HTMLDivElement>(null)
	const mobileScrollContainerRef = useRef<HTMLDivElement>(null)

	const { isOpeningModal, handleModelClick, resetIsOpeningModal } = useModelSwitchSelection({
		onModelClick,
		onModelSelected: () => {
			if (isMobile) {
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

				scrollContainer.scrollTo({
					top: itemOffsetTop,
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
		t,
		selectedItemRef,
		desktopScrollContainerRef,
		mobileScrollContainerRef,
		handleModelClick,
		handleClose,
		handleOpenChange,
		getModelDescription,
	}
}

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
	menuItemsIncludeNoWaterMarkDownload,
	type MobileDownloadMenuItem,
} from "../utils/build-single-file-download-menu"

const MOBILE_SHEET_MAX_HEIGHT = {
	maxHeight: "calc(100dvh - var(--safe-area-inset-top) - var(--safe-area-inset-bottom) - 16px)",
} as const

interface MobileFileDownloadSheetProps {
	visible: boolean
	onClose: () => void
	mode: "single" | "batch"
	/** Root header title override (e.g. selected file name for single-file download). */
	title?: string
	/** Root menu items; batch mode usually has a single ZIP action. */
	menuItems: MobileDownloadMenuItem[]
	selectedCount?: number
	isLoading?: boolean
	/** Preload watermark modal chunk when sheet shows no-watermark option (parity with desktop hover). */
	preloadWaterMarkFreeModal?: () => void
}

/**
 * Mobile bottom sheet for file download actions with nested submenu navigation (single-file export).
 */
export function MobileFileDownloadSheet({
	visible,
	onClose,
	mode,
	title,
	menuItems,
	selectedCount = 0,
	isLoading = false,
	preloadWaterMarkFreeModal,
}: MobileFileDownloadSheetProps) {
	const { t } = useTranslation("super")
	const [menuStack, setMenuStack] = useState<MobileDownloadMenuItem[][]>([])

	const sheetTitle =
		title ??
		(mode === "batch" ? t("topicFiles.downloadTitle") : t("topicFiles.contextMenu.download"))

	const currentItems = menuStack.length > 0 ? menuStack[menuStack.length - 1] : menuItems

	const parentTitle = useMemo(() => {
		if (menuStack.length === 0) return sheetTitle
		const parentLevel = menuStack.length === 1 ? menuItems : menuStack[menuStack.length - 2]
		const activeKey = currentItems[0]?.key
		const parentItem = parentLevel.find((entry) =>
			entry.children?.some((child) => child.key === activeKey),
		)
		return parentItem?.label || sheetTitle
	}, [currentItems, menuItems, menuStack, sheetTitle])

	// Preload when sheet is open and current level lists no-watermark (incl. after submenu navigation).
	useEffect(() => {
		if (!visible || !preloadWaterMarkFreeModal) return
		if (menuItemsIncludeNoWaterMarkDownload(currentItems)) preloadWaterMarkFreeModal()
	}, [visible, currentItems, preloadWaterMarkFreeModal])

	const handleClose = () => {
		setMenuStack([])
		onClose()
	}

	const handleBack = () => {
		setMenuStack((prev) => prev.slice(0, -1))
	}

	const handleItemClick = (item: MobileDownloadMenuItem) => {
		if (item.children && item.children.length > 0) {
			setMenuStack((prev) => [...prev, item.children!])
			return
		}
		item.onClick?.()
		handleClose()
	}

	return (
		<MagicPopup
			visible={visible}
			onClose={handleClose}
			title={parentTitle}
			headerVariant="actionHeader"
			headerTitle={parentTitle}
			headerLeadingAction={{
				icon:
					menuStack.length > 0 ? (
						<ChevronLeft className="size-[22px] text-foreground" />
					) : (
						<X className="size-[22px] text-foreground" />
					),
				ariaLabel: menuStack.length > 0 ? t("common.back") : t("close"),
				onClick: menuStack.length > 0 ? handleBack : handleClose,
				testId:
					menuStack.length > 0
						? "mobile-file-download-back-button"
						: "mobile-file-download-close-button",
			}}
			position="bottom"
			className="rounded-t-xl border-0 bg-muted"
			bodyClassName="flex flex-col overflow-hidden px-2.5 pb-[max(var(--safe-area-inset-bottom),16px)] pt-2"
			style={MOBILE_SHEET_MAX_HEIGHT}
			destroyOnClose
		>
			<div className="overflow-hidden rounded-lg bg-card">
				{currentItems.map((item, index) => (
					<button
						key={item.key}
						type="button"
						disabled={isLoading}
						className={cn(
							"flex h-14 w-full items-center gap-3 bg-transparent px-3.5 text-left active:opacity-60 disabled:opacity-40",
							index > 0 && "border-t border-border/60",
						)}
						onClick={() => handleItemClick(item)}
						data-testid={`mobile-file-download-item-${item.key}`}
					>
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
							<Download className="size-5" strokeWidth={1.8} />
						</div>
						<span className="flex-1 text-left text-base leading-5 text-foreground">
							{mode === "batch" && item.key === "batchZip"
								? t("topicFiles.downloadSelected", { count: selectedCount })
								: item.label}
						</span>
						{item.children && item.children.length > 0 ? (
							<ChevronRight className="size-5 shrink-0 text-muted-foreground" />
						) : null}
					</button>
				))}
			</div>
		</MagicPopup>
	)
}

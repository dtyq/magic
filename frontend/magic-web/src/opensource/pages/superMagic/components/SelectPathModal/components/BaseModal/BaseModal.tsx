import React, { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { IconSearch } from "@tabler/icons-react"

import { cn } from "@/opensource/lib/utils"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { PopupProps } from "antd-mobile"

export interface BaseModalProps {
	visible: boolean
	title?: ReactNode
	tips?: ReactNode
	searchInput?: {
		value: string
		placeholder?: string
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
		onCompositionStart?: (e: React.CompositionEvent<HTMLInputElement>) => void
		onCompositionEnd?: (e: React.CompositionEvent<HTMLInputElement>) => void
	}
	content: ReactNode
	footer?: {
		leftContent?: ReactNode
		okText?: string
		cancelText?: string
		onOk?: () => void
		onCancel?: () => void
		okDisabled?: boolean
	}
	onClose?: () => void
	width?: number
	className?: string
	/** 点击遮罩是否关闭，默认 false */
	maskClosable?: boolean
	customPopupProps?: PopupProps
}

function BaseModal({
	visible,
	title,
	tips,
	searchInput,
	content,
	footer,
	onClose,
	width = 720,
	className,
	maskClosable = false,
	customPopupProps,
}: BaseModalProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	const handleCancel = () => {
		onClose?.()
	}

	const searchInputEl = searchInput ? (
		<div className={cn("flex border-b-0 bg-transparent p-0", isMobile && "flex-[0_0_52px]")}>
			<div className="relative w-full">
				<IconSearch
					size={16}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					value={searchInput.value}
					className="h-8 rounded-lg border-border py-1 pl-9 pr-3 text-sm leading-5 placeholder:text-foreground/35"
					onChange={searchInput.onChange}
					onCompositionStart={searchInput.onCompositionStart}
					onCompositionEnd={searchInput.onCompositionEnd}
					placeholder={searchInput.placeholder}
				/>
			</div>
		</div>
	) : null

	const bodyContent = (
		<div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-none border border-transparent bg-transparent">
				{searchInputEl}
				{content}
			</div>
		</div>
	)

	const modalContent = isMobile ? (
		<CommonPopup
			title={t("topicFiles.title")}
			popupProps={{
				visible: visible,
				onClose: () => {
					onClose?.()
				},
				onMaskClick: () => {
					onClose?.()
				},
				...customPopupProps,
			}}
		>
			<div className={cn("flex h-full flex-col gap-2 p-3")}>
				<div
					className={cn(
						"flex max-h-[694px] min-h-[280px] flex-col overflow-y-auto rounded-none border border-transparent bg-transparent",
						isMobile && "h-full",
					)}
				>
					{searchInputEl}
					{content}
					<div className="m-3 flex items-center justify-start gap-1.5">
						<Button
							variant="outline"
							onClick={footer?.onCancel || handleCancel}
							className="h-9 flex-[0_0_auto] rounded-lg px-8"
						>
							{footer?.cancelText || t("common.cancel")}
						</Button>
						<Button
							disabled={footer?.okDisabled}
							onClick={footer?.onOk}
							className="h-9 min-w-0 flex-1 rounded-lg px-4 py-2"
						>
							{footer?.okText || t("common.confirm")}
						</Button>
					</div>
				</div>
			</div>
		</CommonPopup>
	) : (
		<Dialog
			open={visible}
			onOpenChange={(open) => {
				if (!open) handleCancel()
			}}
		>
			<DialogContent
				className={cn(
					"flex h-[500px] max-w-[calc(100%-2rem)] flex-col gap-0 rounded-[10px] border border-border bg-white p-0 shadow-sm dark:bg-card [&_[data-slot=dialog-close]]:right-[15px] [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]_svg]:size-4 [&_[data-slot=dialog-close]_svg]:text-foreground",
					className,
				)}
				style={{
					width: width,
					minWidth: 720,
				}}
				showCloseButton
				onInteractOutside={maskClosable ? undefined : (e) => e.preventDefault()}
				onPointerDownOutside={maskClosable ? undefined : (e) => e.preventDefault()}
			>
				{(title || tips) && (
					<DialogHeader className="mb-0 max-h-[60px] border-b border-border p-3">
						<DialogTitle asChild>
							<div className="flex flex-col gap-0.5">
								{title && (
									<div className="text-base font-semibold leading-6 text-foreground">
										{title}
									</div>
								)}
								{tips && (
									<div className="text-xs font-normal text-foreground/35">
										{tips}
									</div>
								)}
							</div>
						</DialogTitle>
					</DialogHeader>
				)}
				{bodyContent}
				{footer && (
					<div className="mt-0 flex h-auto items-center justify-between border-t border-border p-3">
						{footer.leftContent ?? (
							<div className="px-2 py-0.5 text-sm text-muted-foreground" />
						)}
						<div className="flex">
							<Button
								variant="outline"
								className="mr-2.5 h-9 rounded-lg px-4 py-2"
								onClick={footer.onCancel || handleCancel}
							>
								{footer.cancelText || t("common.cancel")}
							</Button>
							<Button
								disabled={footer.okDisabled}
								onClick={footer.onOk}
								className="h-9 rounded-lg px-4 py-2"
							>
								{footer.okText || t("common.confirm")}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)

	return modalContent
}

export default BaseModal

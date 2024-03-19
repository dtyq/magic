import MagicIcon from "@/opensource/components/base/MagicIcon"
import type { DetailData } from "@/opensource/pages/superMagic/components/Detail/types"
import { IconX } from "@tabler/icons-react"
import type { PopupProps } from "antd-mobile"
import { memo } from "react"
import MobileButton from "../MobileButton"
import { useStyles } from "./styles"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { cn } from "@/opensource/lib/utils"

export interface PreviewDetail<T extends keyof DetailData = any> {
	type: T
	data: DetailData[T]
	currentFileId: string
}

export interface PreviewDetailPopupRef {
	open: () => void
}

interface PreviewDetailPopupProps extends React.PropsWithChildren {
	title: string | React.ReactNode
	popupProps?: PopupProps
	headerExtra?: React.ReactNode
	showHeader?: boolean
	wrapperStyle?: React.CSSProperties
}

function CommonPopup(props: PreviewDetailPopupProps) {
	const { styles } = useStyles()
	const { children, title, popupProps, headerExtra, showHeader = true, wrapperStyle } = props

	const mergePopupProps = {
		...popupProps,
		showCloseButton: popupProps?.showCloseButton ?? true,
	}

	// Extract getContainer to handle type incompatibility
	const { getContainer, bodyClassName, bodyStyle, ...restPopupProps } = popupProps || {}

	return (
		<MagicPopup
			position="bottom"
			bodyClassName={cn(styles.popupBody, bodyClassName)}
			{...restPopupProps}
			getContainer={getContainer || undefined}
			bodyStyle={{
				width: "100%",
				background: "#fff",
				height: "100%",
				borderRadius: "12px 12px 0px 0px",
				...bodyStyle,
			}}
		>
			<div
				className="max-h-[calc(100vh - 44px - 60px - var(--safe-area-inset-top) - var(--safe-area-inset-bottom))] flex h-full flex-col"
				style={wrapperStyle}
			>
				{showHeader && (
					<div className={styles.header}>
						<div className={styles.title}>{title}</div>
						{headerExtra && <div className={styles.headerExtra}>{headerExtra}</div>}
						{mergePopupProps?.showCloseButton && (
							<div className={styles.close}>
								<MobileButton
									borderDisabled={popupProps?.visible}
									className={styles.closeButton}
									onClick={() => {
										popupProps?.onClose?.()
									}}
								>
									<MagicIcon size={22} stroke={2} component={IconX} />
								</MobileButton>
							</div>
						)}
					</div>
				)}
				<div className={cn(styles.body, "flex-1")}>{children}</div>
			</div>
		</MagicPopup>
	)
}

export default memo(CommonPopup)

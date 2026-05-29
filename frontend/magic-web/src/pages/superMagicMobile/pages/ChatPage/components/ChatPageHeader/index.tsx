import { Loader2, MessageCirclePlus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { MobileShellSidebarToggleButton } from "@/pages/superMagicMobile/components/MobileShell"
import { usePoppinsFont } from "@/styles/font"

interface ChatPageHeaderProps {
	/** Open-only fallback when this header renders outside `SuperMobileShellRouteLayout`. */
	onMenuClick?: () => void
	onPrimaryAction?: () => void
	isPrimaryActionLoading?: boolean
}

function ChatPageHeader({
	onMenuClick,
	onPrimaryAction,
	isPrimaryActionLoading = false,
}: ChatPageHeaderProps) {
	const { t } = useTranslation("super")
	const { t: tCommon } = useTranslation("common")
	const brandName = tCommon("platform.name") || t("mobile.shell.brandName")
	// 标题沿用原型里的 Poppins 字体节奏，避免首页品牌感与欢迎区不一致。
	usePoppinsFont([400])
	const isPrimaryActionDisabled = onPrimaryAction == null || isPrimaryActionLoading
	// 顶部安全区沿用移动端一级页的统一补偿方式，避免刘海屏下 header 视觉过重或按钮贴边。

	return (
		<div className="mobile-page-header pb-0" data-testid="chat-page-header-root">
			<MobileShellSidebarToggleButton
				testId="chat-page-header-menu-button"
				onFallbackOpen={onMenuClick}
			/>

			{/* 标题改为绝对居中，避免右侧 loading 与禁用态切换时品牌名左右跳动。 */}
			<h1 className="mobile-page-header-title">{brandName}</h1>

			<div
				className="mobile-page-header-btn ml-auto"
				data-testid="chat-page-header-primary-action-shell"
			>
				<button
					type="button"
					className="flex size-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
					onClick={onPrimaryAction}
					disabled={isPrimaryActionDisabled}
					aria-disabled={isPrimaryActionDisabled}
					aria-busy={isPrimaryActionLoading}
					aria-label={t("home.header.newChatAria")}
					data-testid="chat-page-header-primary-button"
				>
					{isPrimaryActionLoading ? (
						<Loader2 className="size-[22px] animate-spin text-foreground" />
					) : (
						<MessageCirclePlus className="size-[22px] text-foreground" />
					)}
				</button>
			</div>
		</div>
	)
}

export default observer(ChatPageHeader)

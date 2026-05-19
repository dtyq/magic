import { Loader2, Menu, MessageCirclePlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { usePoppinsFont } from "@/styles/font"

interface ChatPageHeaderProps {
	onMenuClick: () => void
	onPrimaryAction?: () => void
	isPrimaryActionLoading?: boolean
}

export default function ChatPageHeader({
	onMenuClick,
	onPrimaryAction,
	isPrimaryActionLoading = false,
}: ChatPageHeaderProps) {
	const { t } = useTranslation("super")
	// 标题沿用原型里的 Poppins 字体节奏，避免首页品牌感与欢迎区不一致。
	usePoppinsFont([400])
	const isPrimaryActionDisabled = onPrimaryAction == null || isPrimaryActionLoading
	// 顶部安全区沿用移动端一级页的统一补偿方式，避免刘海屏下 header 视觉过重或按钮贴边。

	return (
		<div
			className="relative z-10 flex h-14 shrink-0 items-center gap-2 rounded-b-[14px] px-[10px] pb-0"
			data-testid="chat-page-header-root"
		>
			<button
				type="button"
				className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card transition-transform active:scale-95"
				style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
				onClick={onMenuClick}
				aria-label={t("mobile.shell.menuAria")}
				data-testid="chat-page-header-menu-button"
			>
				<Menu className="size-[22px] text-foreground" strokeWidth={2.25} />
			</button>

			{/* 标题改为绝对居中，避免右侧 loading 与禁用态切换时品牌名左右跳动。 */}
			<h1 className="pointer-events-none absolute inset-x-0 truncate px-[114px] text-center font-poppins text-[18px] font-medium leading-6 text-foreground">
				{t("mobile.shell.brandName")}
			</h1>

			<div
				className="ml-auto flex h-12 shrink-0 items-center rounded-full bg-card"
				style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
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
						<Loader2
							className="size-[22px] animate-spin text-foreground"
							strokeWidth={2.25}
						/>
					) : (
						<MessageCirclePlus
							className="size-[22px] text-foreground"
							strokeWidth={2.25}
						/>
					)}
				</button>
			</div>
		</div>
	)
}

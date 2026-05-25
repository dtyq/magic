import { Menu, Plus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface MagiClawMobileHeaderProps {
	title: string
	menuAriaLabel: string
	createAriaLabel: string
	disableCreateTrigger?: boolean
	onOpenSidebar: () => void
	onOpenCreate: () => void
}

/**
 * MagiClawMobileHeader 负责还原原型顶部的菜单按钮、居中标题和加号入口。
 */
export function MagiClawMobileHeader({
	title,
	menuAriaLabel,
	createAriaLabel,
	disableCreateTrigger = false,
	onOpenSidebar,
	onOpenCreate,
}: MagiClawMobileHeaderProps) {
	return (
		<header
			className="mobile-floating-page-header relative z-10 flex h-14 shrink-0 items-center gap-2 px-[10px]"
			data-testid="magi-claw-mobile-header"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70"
				aria-label={menuAriaLabel}
				data-testid="magi-claw-mobile-menu-button"
				onClick={onOpenSidebar}
			>
				<Menu className="h-[22px] w-[22px] text-foreground" aria-hidden />
			</Button>

			<p
				className="pointer-events-none absolute inset-x-0 truncate px-[64px] text-center font-poppins text-[18px] font-medium leading-6 text-foreground"
				data-testid="magi-claw-mobile-page-title"
			>
				{title}
			</p>

			<div className="ml-auto shrink-0">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70"
					aria-label={createAriaLabel}
					data-testid="magi-claw-mobile-create-trigger"
					disabled={disableCreateTrigger}
					onClick={onOpenCreate}
				>
					<Plus className="h-[22px] w-[22px] text-foreground" aria-hidden />
				</Button>
			</div>
		</header>
	)
}

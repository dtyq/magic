import { useMemo } from "react"
import { Menu, MessageCirclePlus } from "lucide-react"
import { useOutletContext } from "react-router"
import { useTranslation } from "react-i18next"

import { MobileShellIconButton } from "@/pages/superMagicMobile/components/MobileShell"

import type { ShellDemoOutletContext } from "./shellDemoOutletContext"

function ComposerChip({ label }: { label: string }) {
	return (
		<div className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm">
			{label}
		</div>
	)
}

/**
 * ShellDemo 子路由页面：仅主面板内容；Shell 由父级 `ShellDemoAppRouteLayout` 挂载。
 */
export default function ShellDemoPanel() {
	const { t } = useTranslation("sidebar")
	const { activeView, setActiveView, viewLabelMap, isSidebarOpen, setIsSidebarOpen } =
		useOutletContext<ShellDemoOutletContext>()

	const currentCards = useMemo(
		() => [
			{
				id: `${activeView}-1`,
				title: "Summer Campaign",
				tag: t("shellDemo.cardTags.priority"),
			},
			{
				id: `${activeView}-2`,
				title: "SEO Optimization Sprint",
				tag: t("shellDemo.cardTags.collaboration"),
			},
			{
				id: `${activeView}-3`,
				title: "MagiCrew Shell Validation",
				tag: t("shellDemo.cardTags.demo"),
			},
		],
		[activeView, t],
	)

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div
				className="flex items-center gap-3 px-3"
				style={{ paddingTop: "calc(var(--safe-area-inset-top, 0px) + 12px)" }}
			>
				<MobileShellIconButton
					label={isSidebarOpen ? t("shellDemo.closeSidebar") : t("shellDemo.openSidebar")}
					onClick={() => setIsSidebarOpen((value) => !value)}
					testId="mobile-shell-demo-menu-trigger"
				>
					<Menu size={22} />
				</MobileShellIconButton>

				<div className="min-w-0 flex-1 text-center text-lg font-semibold text-foreground">
					{viewLabelMap[activeView]}
				</div>

				<MobileShellIconButton
					label={t("shellDemo.newChat")}
					onClick={() => setActiveView("home")}
					testId="mobile-shell-demo-new-chat-button"
				>
					<MessageCirclePlus size={22} />
				</MobileShellIconButton>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6">
				{activeView === "home" ? (
					<div className="flex h-full flex-col items-center justify-center gap-5 pb-28 text-center">
						<div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd84d] text-4xl font-semibold text-black shadow-sm">
							M
						</div>
						<div className="space-y-2">
							<div className="text-sm text-muted-foreground">
								{t("shellDemo.home.eyebrow")}
							</div>
							<h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
								{t("shellDemo.home.title")}
							</h1>
							<p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
								{t("shellDemo.home.description")}
							</p>
						</div>
						<div
							className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
							data-testid="mobile-shell-demo-home-badge"
						>
							{t("shellDemo.previewBadge")}
						</div>
					</div>
				) : (
					<div className="space-y-4" data-testid="mobile-shell-demo-list-content">
						<div className="rounded-3xl bg-muted p-5 shadow-sm">
							<div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
								{t("shellDemo.previewBadge")}
							</div>
							<h2 className="mt-2 text-2xl font-semibold text-foreground">
								{viewLabelMap[activeView]}
							</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{t("shellDemo.listSummary", {
									view: viewLabelMap[activeView],
								})}
							</p>
						</div>

						{currentCards.map((card) => (
							<div
								key={card.id}
								className="rounded-2xl border border-border bg-background p-4 shadow-sm"
								data-testid={`mobile-shell-demo-card-${card.id}`}
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-lg font-medium text-foreground">
											{card.title}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{t("shellDemo.cardSubtitle")}
										</div>
									</div>
									<div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
										{card.tag}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div
				className="px-4"
				style={{ paddingBottom: "calc(var(--safe-area-inset-bottom, 0px) + 16px)" }}
			>
				<div
					className="rounded-3xl border border-border bg-background p-3 shadow-2xl"
					data-testid="mobile-shell-demo-composer"
				>
					<div className="mb-3 text-base text-muted-foreground">
						{t("shellDemo.inputPlaceholder")}
					</div>
					<div className="flex flex-wrap gap-2">
						<ComposerChip label={t("shellDemo.quickActions.slides")} />
						<ComposerChip label={t("shellDemo.quickActions.design")} />
						<ComposerChip label={t("shellDemo.quickActions.recording")} />
					</div>
				</div>
			</div>
		</div>
	)
}

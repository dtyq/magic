import {
	Clock3,
	Heart,
	House,
	LoaderCircle,
	MessageCircleMore,
	Presentation,
	RefreshCw,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import type { MySlidesTemplatesEmptyStatus } from "./useMySlidesTemplates"
import type { MySlidesTemplateSection } from "@/pages/superMagic/services/mySlidesTemplateAdapter"

/* Hallmark · pre-emit critique: P5 H4 E5 S4 R5 V3 */

interface MySlidesTemplatesEmptyStateProps {
	status: MySlidesTemplatesEmptyStatus
	onRetry?: () => void
	bottomInset?: number
	variant?: "inline" | "overlay"
	section?: MySlidesTemplateSection
}

function MySlidesTemplatesGuideIllustration({ isOverlay }: { isOverlay: boolean }) {
	return (
		<div className="relative h-24 w-64 max-w-full" aria-hidden="true">
			<div className="absolute inset-6 rounded-full bg-primary/10 blur-2xl" />
			<svg viewBox="0 0 240 104" className="relative size-full">
				<g fill="none" strokeLinecap="round" strokeLinejoin="round">
					<g
						stroke="currentColor"
						className={isOverlay ? "text-white/45" : "text-muted-foreground/60"}
					>
						<path d="M14 26h48a8 8 0 0 1 8 8v23a8 8 0 0 1-8 8H42l-10 9 2-9H14a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8Z" />
						<path d="M19 40h37M19 50h25" opacity=".65" />
						<path d="M75 51c6 1 10 3 15 7M83 52l7 6-8 2" strokeDasharray="3 4" />
					</g>

					<g
						stroke="currentColor"
						className={isOverlay ? "text-cyan-200/75" : "text-primary/75"}
					>
						<path d="M99 39h22l7 7h25a8 8 0 0 1 8 8v27a8 8 0 0 1-8 8H95a8 8 0 0 1-8-8V51a12 12 0 0 1 12-12Z" />
						<path d="M104 58h39v20h-39zM111 64h24M111 71h17" opacity=".8" />
					</g>

					<g
						stroke="currentColor"
						className={isOverlay ? "text-violet-200/60" : "text-violet-500/60"}
					>
						<path d="M178 21h48a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8h-48a8 8 0 0 1-8-8V29a8 8 0 0 1 8-8Z" />
						<path d="M184 34h24M184 46h36M184 57h30" opacity=".65" />
						<path d="M166 52c-5 1-9 3-13 7M160 53l-7 6 8 2" strokeDasharray="3 4" />
					</g>
				</g>
			</svg>
		</div>
	)
}

export default function MySlidesTemplatesEmptyState({
	status,
	onRetry,
	bottomInset = 0,
	variant = "overlay",
	section = "created",
}: MySlidesTemplatesEmptyStateProps) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const isOverlay = variant === "overlay"
	const isCreatedSection = section === "created"
	const emptyTitle =
		section === "created"
			? t("mySlidesTemplates.empty.created.title")
			: section === "favorites"
				? t("mySlidesTemplates.empty.favorites.title")
				: t("mySlidesTemplates.empty.used.title")
	const emptyDescription =
		section === "created"
			? t("mySlidesTemplates.empty.created.description")
			: section === "favorites"
				? t("mySlidesTemplates.empty.favorites.description")
				: t("mySlidesTemplates.empty.used.description")

	if (status === "loading") {
		return (
			<div
				className={cn(
					"flex items-center justify-center text-sm",
					isOverlay
						? "absolute inset-0 z-10 text-white/60"
						: "min-h-64 flex-1 text-muted-foreground",
				)}
				style={isOverlay ? { paddingBottom: bottomInset } : undefined}
				role="status"
				data-testid="my-slides-templates-loading"
			>
				<LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
				{t("mySlidesTemplates.loading")}
			</div>
		)
	}

	return (
		<section
			className={cn(
				"relative flex items-center justify-center overflow-hidden px-6 text-center",
				isOverlay ? "absolute inset-0 z-10" : "min-h-64 flex-1 py-8",
			)}
			style={isOverlay ? { paddingBottom: bottomInset } : undefined}
			aria-labelledby="my-slides-templates-empty-title"
			data-testid={`my-slides-templates-${status}`}
		>
			<div className="relative flex w-full max-w-2xl flex-col items-center">
				{isCreatedSection ? (
					<MySlidesTemplatesGuideIllustration isOverlay={isOverlay} />
				) : (
					<div
						className={cn(
							"flex size-16 items-center justify-center rounded-full",
							isOverlay
								? "bg-white/8 text-white/55"
								: "bg-muted text-muted-foreground",
						)}
						aria-hidden="true"
					>
						{section === "favorites" ? (
							<Heart className="size-7" />
						) : (
							<Clock3 className="size-7" />
						)}
					</div>
				)}
				<h2
					id="my-slides-templates-empty-title"
					className={cn(
						"mt-3 text-xl font-semibold tracking-[-0.02em]",
						isOverlay ? "text-white/95" : "text-foreground",
					)}
				>
					{emptyTitle}
				</h2>
				<p
					className={cn(
						"mt-1.5 text-sm",
						isOverlay ? "text-white/50" : "text-muted-foreground",
					)}
				>
					{emptyDescription}
				</p>

				{isCreatedSection ? (
					<ul className="mt-6 flex w-full max-w-xl flex-col gap-5 text-left">
						<li
							className={cn("flex items-start gap-4", isOverlay && "justify-between")}
						>
							<div className="flex min-w-0 items-start gap-3">
								<MessageCircleMore
									className={cn(
										"mt-0.5 size-5 shrink-0",
										isOverlay ? "text-cyan-200/80" : "text-primary/80",
									)}
									aria-hidden="true"
								/>
								<div className="min-w-0">
									<p
										className={cn(
											"text-sm font-medium",
											isOverlay ? "text-white/85" : "text-foreground/85",
										)}
									>
										{t("mySlidesTemplates.guide.chat")}
									</p>
									<p
										className={cn(
											"mt-1 text-xs leading-5",
											isOverlay ? "text-white/40" : "text-muted-foreground",
										)}
									>
										{t("mySlidesTemplates.guide.chatDescription")}
									</p>
								</div>
							</div>
							{isOverlay ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-0.5 gap-1.5 border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white"
									onClick={() => navigate({ name: RouteName.Super })}
									data-testid="my-slides-templates-go-home"
								>
									<House className="size-4" aria-hidden="true" />
									{t("mobile.shell.brandGoHome")}
								</Button>
							) : null}
						</li>
						<li className="flex items-start gap-3">
							<Presentation
								className={cn(
									"mt-0.5 size-5 shrink-0",
									isOverlay ? "text-violet-200/75" : "text-violet-500/75",
								)}
								aria-hidden="true"
							/>
							<div className="min-w-0">
								<p
									className={cn(
										"text-sm font-medium",
										isOverlay ? "text-white/85" : "text-foreground/85",
									)}
								>
									{t("mySlidesTemplates.guide.project")}
								</p>
								<p
									className={cn(
										"mt-1 text-xs leading-5",
										isOverlay ? "text-white/40" : "text-muted-foreground",
									)}
								>
									{t("mySlidesTemplates.guide.projectDescription")}
								</p>
							</div>
						</li>
					</ul>
				) : null}

				{status === "unavailable" ? (
					<p
						className={cn(
							"mt-5 text-xs",
							isOverlay ? "text-white/35" : "text-muted-foreground/80",
						)}
					>
						{t("mySlidesTemplates.unavailableDescription")}
					</p>
				) : null}

				{status === "error" ? (
					<div className="mt-5" role="alert">
						<p
							className={cn(
								"text-xs",
								isOverlay ? "text-white/45" : "text-muted-foreground",
							)}
						>
							{t("mySlidesTemplates.loadFailedDescription")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={cn(
								"mt-3 gap-1.5",
								isOverlay &&
									"border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white",
							)}
							onClick={onRetry}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							{t("mySlidesTemplates.retry")}
						</Button>
					</div>
				) : null}
			</div>
		</section>
	)
}

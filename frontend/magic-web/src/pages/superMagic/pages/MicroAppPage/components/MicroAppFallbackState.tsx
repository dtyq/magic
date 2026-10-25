import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import {
	MicroAppPermissionIllustration,
	MicroAppRetryIllustration,
} from "@/pages/superMagic/components/MicroAppStateIllustration"
import { cn } from "@/utils/cn"

interface MicroAppFallbackStateProps {
	variant: "load" | "permission"
	onBack: () => void
	mobile?: boolean
}

export default function MicroAppFallbackState({
	variant,
	onBack,
	mobile = false,
}: MicroAppFallbackStateProps) {
	const { t } = useTranslation("super")
	const isPermissionError = variant === "permission"
	const title = isPermissionError
		? t("microAppPage.errors.permissionTitle")
		: t("microAppPage.errors.loadFailed")

	return (
		<div
			className={cn(
				"relative flex h-full w-full justify-center",
				mobile
					? "absolute inset-0 min-h-0 items-start overflow-y-auto bg-mobile-background px-4 pb-[max(var(--safe-area-inset-bottom),20px)] pt-[max(var(--safe-area-inset-top),20px)]"
					: "min-h-[420px] items-center overflow-hidden rounded-lg bg-background px-6 py-12",
			)}
			data-testid="micro-app-fallback"
			data-mobile={mobile}
		>
			<div
				className={cn(
					"pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-3xl",
					mobile ? "size-[300px]" : "size-[420px]",
				)}
				aria-hidden
			/>
			<section
				className={cn(
					"relative flex w-full flex-col items-center overflow-hidden border border-border/70 bg-card/95 text-center shadow-[0_24px_80px_rgba(23,32,55,0.10)] backdrop-blur-sm dark:shadow-[0_24px_80px_rgba(0,0,0,0.24)]",
					mobile
						? "my-auto max-w-[360px] rounded-[24px] px-5 py-8"
						: "max-w-[460px] rounded-[28px] px-8 py-10",
				)}
				role="alert"
			>
				<div
					className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
					aria-hidden
				/>

				{isPermissionError ? (
					<MicroAppPermissionIllustration
						size={mobile ? "sm" : "md"}
						testId="micro-app-permission-fallback-illustration"
					/>
				) : (
					<MicroAppRetryIllustration
						size={mobile ? "sm" : "md"}
						testId="micro-app-load-fallback-illustration"
					/>
				)}

				<div className={cn("space-y-2", mobile ? "mt-4" : "mt-5")}>
					<h1
						className={cn(
							"break-words font-semibold tracking-[-0.02em] text-foreground",
							mobile ? "text-lg" : "text-xl",
						)}
					>
						{title}
					</h1>
					<p className="mx-auto max-w-[360px] text-sm leading-6 text-muted-foreground">
						{isPermissionError
							? t("microAppPage.errors.permissionDescription")
							: t("microAppPage.errors.loadDescription")}
					</p>
				</div>

				<Button
					type="button"
					size="lg"
					className={cn(
						"mt-6 h-11 gap-2 rounded-xl px-5 shadow-sm active:scale-[0.98]",
						mobile && "w-full",
					)}
					onClick={onBack}
				>
					<ArrowLeft className="size-4" aria-hidden />
					{t("microAppPage.header.backToApps")}
				</Button>
			</section>
		</div>
	)
}

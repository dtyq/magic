import { Cloudy, MessageCircleMore } from "lucide-react"
import { useTranslation } from "react-i18next"

import avatarHighlight from "@/opensource/assets/resources/magi-claw/card-avatar-highlight.svg"
import heroBackground from "@/opensource/assets/resources/magi-claw/hero-background.webp"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { MagiClaw } from "@/opensource/enhance/lucide-react"
import { usePoppinsFont } from "@/opensource/styles/font"
import useGeistFont from "@/opensource/styles/fonts/geist"

function MagiClawPage() {
	const { t } = useTranslation("sidebar")
	usePoppinsFont()
	useGeistFont()

	const featureItems = [
		{
			key: "customization",
			icon: <MagiClaw className="size-6 text-foreground" />,
			title: t("superLobster.features.customization.title"),
			description: t("superLobster.features.customization.description"),
		},
		{
			key: "deployment",
			icon: <Cloudy className="size-6 text-foreground" strokeWidth={1.75} />,
			title: t("superLobster.features.deployment.title"),
			description: t("superLobster.features.deployment.description"),
		},
		{
			key: "connect",
			icon: <MessageCircleMore className="size-6 text-foreground" strokeWidth={1.75} />,
			title: t("superLobster.features.connect.title"),
			description: t("superLobster.features.connect.description"),
		},
	]

	return (
		<div
			className="flex h-full min-h-0 w-full justify-center overflow-auto bg-background px-4 py-10 md:px-6 md:py-20"
			data-testid="magi-claw-page"
		>
			<div className="flex w-full max-w-[896px] flex-col gap-6">
				<section
					className="relative h-[220px] overflow-hidden rounded-[32px]"
					style={{
						backgroundImage: `url(${heroBackground})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
					}}
					data-testid="magi-claw-hero"
				>
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-center">
						<h1 className="flex items-center gap-0.5 whitespace-nowrap font-poppins text-[36px] leading-none tracking-[-0.72px] text-foreground">
							<span className="font-semibold">Super</span>
							<span className="font-black text-[#EF4444]">
								{t("superLobster.titleAccent")}
							</span>
						</h1>
						<p className="font-['Geist'] text-base leading-6 text-muted-foreground">
							{t("superLobster.description")}
						</p>
					</div>
				</section>

				<section className="flex flex-col gap-4 px-2.5" data-testid="magi-claw-features">
					{featureItems.map((featureItem) => (
						<div
							key={featureItem.key}
							className="flex items-start gap-2"
							data-testid={`magi-claw-feature-${featureItem.key}`}
						>
							<div className="flex size-6 shrink-0 items-center justify-center">
								{featureItem.icon}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<h2 className="text-base font-medium leading-6 text-foreground">
									{featureItem.title}
								</h2>
								<p className="text-sm leading-5 text-muted-foreground">
									{featureItem.description}
								</p>
							</div>
						</div>
					))}
				</section>

				<section className="flex flex-col gap-2 px-2.5" data-testid="magi-claw-get-started">
					<h2 className="text-base font-medium leading-6 text-foreground">
						{t("superLobster.getStarted")}
					</h2>

					<div
						className="flex items-center gap-3 overflow-hidden rounded-[10px] bg-sidebar px-4 py-3"
						data-testid="magi-claw-get-started-card"
					>
						<div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
							<img
								alt=""
								aria-hidden
								className="pointer-events-none max-w-none"
								src={avatarHighlight}
							/>
						</div>

						<div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
							<p className="truncate text-sm font-medium leading-none text-foreground">
								{t("superLobster.card.title")}
							</p>
							<p className="truncate text-sm leading-none text-muted-foreground">
								{t("superLobster.card.description")}
							</p>
						</div>

						<Button
							disabled
							className="h-9 rounded-md px-4 text-sm font-medium shadow-xs disabled:opacity-50"
							data-testid="magi-claw-beta-access-button"
							type="button"
						>
							{t("superLobster.card.betaAccess")}
						</Button>
					</div>
				</section>
			</div>
		</div>
	)
}

export default MagiClawPage

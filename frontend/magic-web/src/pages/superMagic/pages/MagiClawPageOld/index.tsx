import { Cloudy, MessageCircleMore } from "lucide-react"
import { useTranslation } from "react-i18next"

import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
import heroBackground from "@/assets/resources/magi-claw/hero-background.webp"
import heroLeft from "@/assets/resources/magi-claw/hero-left.webp"
import heroRight from "@/assets/resources/magi-claw/hero-right.webp"
import { Button } from "@/components/shadcn-ui/button"
import { MagiClaw } from "@/enhance/lucide-react"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { usePoppinsFont } from "@/styles/font"
import useGeistFont from "@/styles/fonts/geist"

const HERO_GRADIENT =
	"linear-gradient(90.87deg, rgb(255, 247, 247) 6.65%, rgb(238, 245, 255) 97.64%)"

function MagiClawPage() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	usePoppinsFont()
	useGeistFont()

	const featureItems = [
		{
			key: "customization",
			icon: <MagiClaw className="size-5 shrink-0 text-foreground md:size-6" aria-hidden />,
			title: t("superLobster.features.customization.title"),
			description: t("superLobster.features.customization.description", clawBrandValues),
		},
		{
			key: "deployment",
			icon: (
				<Cloudy
					className="size-5 shrink-0 text-foreground md:size-6"
					strokeWidth={1.75}
					aria-hidden
				/>
			),
			title: t("superLobster.features.deployment.title"),
			description: t("superLobster.features.deployment.description", clawBrandValues),
		},
		{
			key: "connect",
			icon: (
				<MessageCircleMore
					className="size-5 shrink-0 text-foreground md:size-6"
					strokeWidth={1.75}
					aria-hidden
				/>
			),
			title: t("superLobster.features.connect.title"),
			description: t("superLobster.features.connect.description", clawBrandValues),
		},
	]

	return (
		<div
			className="flex h-full min-h-0 w-full justify-center overflow-auto bg-background px-2 pb-10 pt-safe-top md:px-6 md:py-20 md:pb-20"
			data-testid="magi-claw-page"
		>
			<div className="flex w-full max-w-[896px] flex-col gap-3 md:gap-6">
				{/* Mobile hero — align with MagiClawPage index.mobile */}
				<section
					className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg md:hidden"
					style={{ backgroundImage: HERO_GRADIENT }}
					data-testid="magi-claw-mobile-hero"
				>
					<div
						className="pointer-events-none absolute -left-12 -top-2 flex h-[135px] w-[148px] items-center justify-center"
						aria-hidden
					>
						<div className="flex-none rotate-[170.87deg] -scale-y-100">
							<div className="relative h-[116px] w-[132px]">
								<img
									src={heroLeft}
									alt=""
									className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
								/>
							</div>
						</div>
					</div>
					<div
						className="pointer-events-none absolute -right-[93px] -top-[65px] flex size-[227px] items-center justify-center"
						aria-hidden
					>
						<div className="flex-none rotate-[-33.64deg]">
							<div className="relative size-[164px]">
								<img
									src={heroRight}
									alt=""
									className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
								/>
							</div>
						</div>
					</div>
					<div className="relative z-10 flex h-full flex-col items-center justify-center gap-0.5 px-4 text-center">
						<div className="flex items-center gap-0.5 whitespace-nowrap text-xl tracking-[-0.4px]">
							<span className="font-['Poppins'] font-semibold text-foreground">
								{t("superLobster.heroLead", clawBrandValues)}
							</span>
							<span className="font-['Poppins'] font-black text-red-500">
								{t("superLobster.titleAccent", clawBrandValues)}
							</span>
						</div>
						<p className="text-xs leading-4 text-muted-foreground">
							{t("superLobster.description", clawBrandValues)}
						</p>
					</div>
				</section>

				{/* Desktop hero */}
				<section
					className="relative hidden h-[220px] overflow-hidden rounded-[32px] md:block"
					style={{
						backgroundImage: `url(${heroBackground})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
					}}
					data-testid="magi-claw-hero"
				>
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-center">
						<h1 className="flex items-center gap-0.5 whitespace-nowrap font-poppins text-[36px] leading-none tracking-[-0.72px] text-foreground">
							<span className="font-semibold">
								{t("superLobster.heroLead", clawBrandValues)}
							</span>
							<span className="font-black text-[#EF4444]">
								{t("superLobster.titleAccent", clawBrandValues)}
							</span>
						</h1>
						<p className="font-['Geist'] text-base leading-6 text-muted-foreground">
							{t("superLobster.description", clawBrandValues)}
						</p>
					</div>
				</section>

				<section
					className="order-2 flex flex-col gap-2 px-0.5 md:order-3 md:px-2.5"
					data-testid="magi-claw-get-started"
				>
					<h2 className="text-base font-medium leading-6 text-foreground">
						{t("superLobster.getStarted")}
					</h2>

					{/* Mobile: vertical card like index.mobile */}
					<div
						className="flex w-full flex-col items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 md:hidden"
						data-testid="magi-claw-get-started-card"
					>
						<div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-background">
							<img
								alt=""
								aria-hidden
								className="absolute inset-0 size-full scale-125 object-cover object-center"
								src={heroLeft}
							/>
						</div>
						<div className="flex w-full flex-col gap-2 text-center text-sm leading-none">
							<p className="font-medium text-foreground">
								{t("superLobster.card.title", clawBrandValues)}
							</p>
							<p className="font-normal text-muted-foreground">
								{t("superLobster.card.description", clawBrandValues)}
							</p>
						</div>
						<Button
							disabled
							className="h-9 w-full gap-2 shadow-xs disabled:opacity-50"
							data-testid="magi-claw-beta-access-button"
							type="button"
						>
							{t("superLobster.card.betaAccess", clawBrandValues)}
						</Button>
					</div>

					{/* Desktop: horizontal row */}
					<div
						className="hidden items-center gap-3 overflow-hidden rounded-[10px] bg-sidebar px-4 py-3 md:flex"
						data-testid="magi-claw-get-started-card-desktop"
					>
						<div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
							<img
								alt=""
								aria-hidden
								className="pointer-events-none size-full max-w-none object-cover object-center"
								src={avatarHighlight}
							/>
						</div>

						<div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
							<p className="truncate text-sm font-medium leading-none text-foreground">
								{t("superLobster.card.title", clawBrandValues)}
							</p>
							<p className="truncate text-sm leading-none text-muted-foreground">
								{t("superLobster.card.description", clawBrandValues)}
							</p>
						</div>

						<Button
							disabled
							className="h-9 rounded-md px-4 text-sm font-medium shadow-xs disabled:opacity-50"
							data-testid="magi-claw-beta-access-button-desktop"
							type="button"
						>
							{t("superLobster.card.betaAccess", clawBrandValues)}
						</Button>
					</div>
				</section>

				<section
					className="order-3 flex flex-col gap-4 px-0.5 pb-4 pt-2 md:order-2 md:px-2.5 md:pb-0 md:pt-0"
					data-testid="magi-claw-features"
				>
					{featureItems.map((featureItem) => (
						<div
							key={featureItem.key}
							className="flex gap-2 md:items-start"
							data-testid={`magi-claw-feature-${featureItem.key}`}
						>
							<div className="flex shrink-0 items-center justify-center md:size-6">
								{featureItem.icon}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<h2 className="text-sm font-medium leading-5 text-foreground md:text-base md:leading-6">
									{featureItem.title}
								</h2>
								<p className="text-xs leading-4 text-muted-foreground md:text-sm md:leading-5">
									{featureItem.description}
								</p>
							</div>
						</div>
					))}
				</section>
			</div>
		</div>
	)
}

export default MagiClawPage

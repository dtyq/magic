import { Cloudy, MessageCircleMore } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagiClaw } from "@/enhance/lucide-react"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

export function MagiClawFeatures() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	const featureItems = [
		{
			key: "customization",
			icon: <MagiClaw className="size-6 text-foreground" />,
			title: t("superLobster.features.customization.title"),
			description: t("superLobster.features.customization.description", clawBrandValues),
		},
		{
			key: "deployment",
			icon: <Cloudy className="size-6 text-foreground" strokeWidth={1.75} />,
			title: t("superLobster.features.deployment.title"),
			description: t("superLobster.features.deployment.description", clawBrandValues),
		},
		{
			key: "connect",
			icon: <MessageCircleMore className="size-6 text-foreground" strokeWidth={1.75} />,
			title: t("superLobster.features.connect.title"),
			description: t("superLobster.features.connect.description", clawBrandValues),
		},
	]

	return (
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
	)
}

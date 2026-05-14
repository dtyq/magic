import { Cloud, MessageCircle, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

/**
 * MagiClawMobileFeatureList 渲染列表区下方的三条能力说明，替换旧 hero 视觉。
 */
export function MagiClawMobileFeatureList() {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	const featureItems = [
		{
			key: "customization",
			icon: <Sparkles className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden />,
			title: t("superLobster.features.customization.title"),
			description: t("superLobster.features.customization.description", clawBrandValues),
		},
		{
			key: "deployment",
			icon: <Cloud className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden />,
			title: t("superLobster.features.deployment.title"),
			description: t("superLobster.features.deployment.description", clawBrandValues),
		},
		{
			key: "connect",
			icon: (
				<MessageCircle className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden />
			),
			title: t("superLobster.features.connect.title"),
			description: t("superLobster.features.connect.description", clawBrandValues),
		},
	]

	return (
		<section
			className="flex flex-col gap-5 px-0.5 pb-1"
			data-testid="magi-claw-mobile-feature-list"
		>
			{featureItems.map((featureItem) => (
				<div
					key={featureItem.key}
					className="flex gap-3"
					data-testid={`magi-claw-mobile-feature-${featureItem.key}`}
				>
					<div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-foreground">
						{featureItem.icon}
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<h2 className="text-[15px] font-medium leading-snug text-foreground">
							{featureItem.title}
						</h2>
						<p className="text-[13px] leading-[1.45] text-muted-foreground">
							{featureItem.description}
						</p>
					</div>
				</div>
			))}
		</section>
	)
}

import { SupportLocales } from "@/opensource/constants/locale"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import { isPrivateDeployment } from "@/opensource/utils/env"
import MagicRoleAnimation from "../../components/EmptyWorkspacePanel/components/Slogan/components/MagicRoleAnimation"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { useTranslation } from "react-i18next"

// Design tokens from Figma (Magic---SuperMagic-Shadcn)
const DESIGN_TOKENS = {
	colors: {
		foreground: "#0a0a0a", // base/foreground
		gradientStart: "#315cec", // palette/brand/--semi-brand-5
		gradientEnd: "#6431e5", // palette/violet/--semi-violet-5
	},
} as const

function SloganSketch() {
	const { i18n, t } = useTranslation("super")
	const globalConfig = globalConfigStore.globalConfig

	return (
		<div className="flex w-full flex-col items-center gap-4 pb-8 pt-6">
			{/* Logo/Animation skeleton - 120px width for MagicRoleAnimation */}
			{isPrivateDeployment() ? (
				globalConfig?.minimal_logo && (
					<div className="flex w-full items-center justify-center">
						<img
							fetchPriority="high"
							className="h-[100px] w-auto"
							src={getAvatarUrl(globalConfig.minimal_logo, 100)}
							alt={globalConfig.name_i18n?.[i18n.language as SupportLocales]}
							draggable={false}
						/>
					</div>
				)
			) : (
				<MagicRoleAnimation />
			)}
			{/* Title skeleton */}
			<div className="flex justify-center">
				<div className="flex items-center justify-center gap-2">
					{/* Static prefix text skeleton */}
					<span
						className="inline-block whitespace-nowrap text-4xl font-medium"
						style={{ color: DESIGN_TOKENS.colors.foreground }}
					>
						{t("ui.slogan.rotatingText.prefix")}
					</span>
					{/* Dynamic text wrapper skeleton */}
					<div
						className="relative flex h-[54px] w-[180px] items-center overflow-hidden rounded-xl px-2.5"
						style={{
							backgroundImage: `linear-gradient(135.7deg, ${DESIGN_TOKENS.colors.gradientStart} 18.884%, ${DESIGN_TOKENS.colors.gradientEnd} 76.71%)`,
						}}
					/>
				</div>
			</div>
		</div>
	)
}

export default SloganSketch

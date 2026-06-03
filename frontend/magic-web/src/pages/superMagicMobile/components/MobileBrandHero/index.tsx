import { SupportLocales } from "@/constants/locale"
import { cn } from "@/lib/utils"
import { globalConfigStore } from "@/stores/globalConfig"
import { usePoppinsFont } from "@/styles/font"
import { getAvatarUrl } from "@/utils/avatar"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

interface MobileBrandHeroProps {
	className?: string
	imageClassName?: string
	subtitleClassName?: string
	titleClassName?: string
	dataTestId?: string
}

const HERO_LOGO_PIXEL_SIZE = 80

/** Shared brand hero for mobile home and chat empty states; logo/name follow platform_settings. */
const MobileBrandHero = observer(function MobileBrandHero({
	className,
	imageClassName,
	subtitleClassName,
	titleClassName,
	dataTestId,
}: MobileBrandHeroProps) {
	const { t, i18n } = useTranslation("super")
	const { t: tCommon } = useTranslation("common")
	// 共享品牌欢迎区覆盖首页与聊天空态，两处都依赖当前已注册的 Poppins 字重集合。
	usePoppinsFont([300, 400])

	const globalConfig = globalConfigStore.globalConfig
	const minimalLogo = globalConfig?.minimal_logo?.trim()
	const logoSrc = minimalLogo ? getAvatarUrl(minimalLogo, HERO_LOGO_PIXEL_SIZE * 2) : null
	const brandName =
		globalConfig?.name_i18n?.[i18n.language as SupportLocales] ||
		tCommon("platform.name") ||
		t("mobile.shell.brandName")

	return (
		<div
			className={cn(
				"-mt-10 flex w-full max-w-[348px] shrink-0 flex-col items-center gap-3 text-center",
				className,
			)}
			data-testid={dataTestId}
		>
			{logoSrc ? (
				<img
					src={logoSrc}
					alt={brandName}
					className={cn("h-20 w-20 shrink-0", imageClassName)}
					draggable={false}
				/>
			) : null}
			<p
				className={cn(
					"font-poppins text-muted-foreground shrink-0 text-sm leading-6",
					subtitleClassName,
				)}
			>
				{t("home.sloganSubtitle")}
			</p>
			<p
				className={cn(
					"font-poppins text-foreground shrink-0 text-2xl font-medium leading-[1.18] tracking-[-0.03em]",
					titleClassName,
				)}
			>
				{t("home.sloganTitle")}
			</p>
		</div>
	)
})

export default MobileBrandHero

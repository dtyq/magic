import { SupportLocales } from "@/constants/locale"
import { cn } from "@/utils/cn"
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
	subtitle?: string
	title?: string
}

const HERO_LOGO_PIXEL_SIZE = 80

/** Shared brand hero for mobile home and chat empty states; logo/name follow platform_settings. */
const MobileBrandHero = observer(function MobileBrandHero({
	className,
	imageClassName,
	subtitleClassName,
	titleClassName,
	dataTestId,
	subtitle,
	title,
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
					className={cn("h-20 w-20 shrink-0 object-contain", imageClassName)}
					draggable={false}
					data-testid="mobile-brand-hero-image"
				/>
			) : null}
			<p
				className={cn(
					"shrink-0 font-poppins text-sm leading-6 text-muted-foreground",
					subtitleClassName,
				)}
			>
				{subtitle ?? t("home.sloganSubtitle")}
			</p>
			<p
				className={cn(
					"shrink-0 font-poppins text-2xl font-medium leading-[1.18] tracking-[-0.03em] text-foreground",
					titleClassName,
				)}
			>
				{title ?? t("home.sloganTitle")}
			</p>
		</div>
	)
})

export default MobileBrandHero

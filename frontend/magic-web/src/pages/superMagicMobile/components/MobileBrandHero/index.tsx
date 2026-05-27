import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { usePoppinsFont } from "@/styles/font"
import { globalConfigStore } from "@/stores/globalConfig"

interface MobileBrandHeroProps {
	className?: string
	imageClassName?: string
	subtitleClassName?: string
	titleClassName?: string
	dataTestId?: string
}

export default function MobileBrandHero({
	className,
	imageClassName,
	subtitleClassName,
	titleClassName,
	dataTestId,
}: MobileBrandHeroProps) {
	const { t } = useTranslation("super")
	// 共享品牌欢迎区覆盖首页与聊天空态，两处都依赖当前已注册的 Poppins 字重集合。
	usePoppinsFont([300, 400])

	const sloganImage = globalConfigStore.globalConfig?.minimal_logo

	return (
		<div
			className={cn(
				"flex w-full max-w-[348px] shrink-0 flex-col items-center gap-3 text-center",
				className,
			)}
			data-testid={dataTestId}
		>
			{sloganImage ? (
				<img
					src={sloganImage}
					alt={t("mobile.shell.brandName")}
					className={cn("h-20 w-20 shrink-0", imageClassName)}
					draggable={false}
				/>
			) : null}
			<p
				className={cn(
					"shrink-0 font-poppins text-base leading-6 text-muted-foreground",
					subtitleClassName,
				)}
			>
				{t("home.sloganSubtitle")}
			</p>
			<p
				className={cn(
					"shrink-0 font-poppins text-2xl font-medium leading-[1.18] tracking-[-0.03em] text-foreground",
					titleClassName,
				)}
			>
				{t("home.sloganTitle")}
			</p>
		</div>
	)
}

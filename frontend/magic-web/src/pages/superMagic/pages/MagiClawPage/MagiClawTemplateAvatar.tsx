import type { MagicClawTemplateCode } from "@/apis"
import openClawAvatar from "@/assets/resources/magi-claw/template-open-claw.png"
import magiShockAvatar from "@/assets/resources/magi-claw/template-magi-shock.png"
import { cn } from "@/lib/utils"

interface MagiClawTemplateAvatarProps {
	templateCode?: MagicClawTemplateCode | string | null
	src?: string | null
	className?: string
	imageClassName?: string
}

interface MagiClawTemplateAvatarConfig {
	src: string
	backgroundClassName: string
}

const DEFAULT_TEMPLATE_CODE: MagicClawTemplateCode = "openclaw"

const MAGI_CLAW_TEMPLATE_AVATAR_CONFIG_MAP: Record<
	MagicClawTemplateCode,
	MagiClawTemplateAvatarConfig
> = {
	openclaw: {
		src: openClawAvatar,
		backgroundClassName: "bg-[#E1F1FF]",
	},
	magishock: {
		src: magiShockAvatar,
		backgroundClassName: "bg-[#FFE1E1]",
	},
}

export function getMagiClawTemplateAvatarConfig(
	templateCode?: MagicClawTemplateCode | string | null,
) {
	return (
		MAGI_CLAW_TEMPLATE_AVATAR_CONFIG_MAP[templateCode as MagicClawTemplateCode] ??
		MAGI_CLAW_TEMPLATE_AVATAR_CONFIG_MAP[DEFAULT_TEMPLATE_CODE]
	)
}

export function MagiClawTemplateAvatar({
	templateCode,
	src,
	className,
	imageClassName,
}: MagiClawTemplateAvatarProps) {
	const config = getMagiClawTemplateAvatarConfig(templateCode)
	const avatarSrc = src || config.src

	return (
		<div
			className={cn(
				"relative flex items-center justify-center overflow-hidden bg-background",
				config.backgroundClassName,
				className,
			)}
		>
			<img
				alt=""
				aria-hidden
				className={cn("pointer-events-none size-full object-cover", imageClassName)}
				src={avatarSrc}
			/>
		</div>
	)
}

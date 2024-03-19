import type { ImgHTMLAttributes } from "react"
import { memo } from "react"

const basePath = "/emojis"

export interface MagicEmojiProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
	code: string
	ns?: string
	suffix?: string
	size?: number
}

const MagicEmoji = memo(({ code, ns = "emojis/", suffix = ".png", ...rest }: MagicEmojiProps) => {
	if (!code) return null

	return <img draggable={false} src={`${basePath}/${ns}${code}${suffix}`} alt={code} {...rest} />
})

export default MagicEmoji

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { SkillDefaultIcon } from "./SkillDefaultIcon"

export interface SkillThumbnailProps {
	src?: string | null
	alt: string
	/** Resets image error state when key or URL identity changes */
	resetKey?: string
	iconSize?: number
	className?: string
	imgClassName?: string
	"data-testid"?: string
}

const defaultContainerClass =
	"relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"

const defaultSkillPalette = {
	backgroundColor: "#6366F1",
	foregroundColor: "#FFFFFF",
}

function getStringHash(value: string) {
	let hash = 0

	for (const character of value) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0
	}

	return hash
}

function getSkillPalette(skillName?: string | null) {
	const normalizedSkillName = skillName?.trim()

	if (!normalizedSkillName) return defaultSkillPalette

	const hash = getStringHash(normalizedSkillName)
	const hue = hash % 360
	const saturation = 28 + (hash % 9)
	const backgroundLightness = 95 + (hash % 2)
	const foregroundLightness = 61 + ((hash >> 3) % 4)

	return {
		backgroundColor: `hsl(${hue} ${saturation}% ${backgroundLightness}%)`,
		foregroundColor: `hsl(${hue} ${Math.max(saturation + 19, 46)}% ${foregroundLightness}%)`,
	}
}

export function SkillThumbnail({
	src,
	alt,
	resetKey,
	iconSize = 48,
	className,
	imgClassName,
	"data-testid": dataTestId,
}: SkillThumbnailProps) {
	const [loadFailed, setLoadFailed] = useState(false)
	const palette = getSkillPalette(alt)

	useEffect(() => {
		setLoadFailed(false)
	}, [resetKey, src])

	const showImage = Boolean(src) && !loadFailed

	return (
		<div className={cn(defaultContainerClass, className)} data-testid={dataTestId}>
			{showImage ? (
				<img
					src={src ?? undefined}
					alt={alt}
					className={cn("size-full object-cover", imgClassName)}
					onError={() => setLoadFailed(true)}
				/>
			) : (
				<SkillDefaultIcon
					size={iconSize}
					backgroundColor={palette.backgroundColor}
					foregroundColor={palette.foregroundColor}
				/>
			)}
		</div>
	)
}

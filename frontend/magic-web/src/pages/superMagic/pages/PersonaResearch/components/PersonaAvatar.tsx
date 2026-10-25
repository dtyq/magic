import { useEffect, useId, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { useFileUrl } from "@/pages/superMagic/hooks/useFileUrl"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { attachmentVersionKey } from "../services/researchFiles"
import { subscribePortraitRecovery, usePersonaPortrait } from "../hooks/usePersonaPortrait"
import { BACK_HAIR, FRONT_HAIR, ageOf, genderOf, resolvePortrait } from "./personaPortrait"

interface PersonaAvatarProps {
	id: string
	name: string
	className?: string
	/**
	 * Gender and age from outside the research page (for example a chat tool card), used when the
	 * persona file is not loaded in a research store, so the portrait matches the research page.
	 */
	demographics?: Record<string, unknown>
	/** Square portraits (rounded 30%) lead persona cards and headers; circles are for lists. */
	shape?: "circle" | "square"
}

/**
 * A bound generated image covers the original SVG only after loading. Missing or failed
 * media retains the same deterministic fallback; the surrounding AI disclosure is unchanged.
 */
function PersonaAvatar({
	id,
	name,
	className,
	demographics: fallback,
	shape = "circle",
}: PersonaAvatarProps) {
	const { persona, image, accessKey } = usePersonaPortrait(id)
	const demographics = persona?.dimensions?.demographics ?? fallback
	const spec = resolvePortrait(name || id, genderOf(demographics), ageOf(demographics))
	const clipId = useId()
	const backHair = BACK_HAIR[spec.hairStyle]

	return (
		<span
			aria-hidden
			className={cn(
				"relative flex size-9 shrink-0 select-none overflow-hidden",
				shape === "square" ? "rounded-[30%]" : "rounded-full",
				className,
			)}
		>
			<svg viewBox="0 0 64 64" className="size-full">
				<defs>
					<clipPath id={clipId}>
						{shape === "square" ? (
							<rect width="64" height="64" />
						) : (
							<circle cx="32" cy="32" r="32" />
						)}
					</clipPath>
				</defs>
				<g clipPath={`url(#${clipId})`}>
					<rect width="64" height="64" fill={spec.backdrop} />
					{/* Portrait crop: head and shoulders fill the circle. */}
					<g transform="translate(-6.4 -5) scale(1.2)">
						<path d="M9 66C9 51 19 43.5 32 43.5S55 51 55 66Z" fill={spec.clothes} />
						{/* Long hair falls over the shoulders, so it is drawn after the body. */}
						{backHair ? <path d={backHair} fill={spec.hair} /> : null}
						<path d="M27.5 43.6L32 49.5L36.5 43.6Z" fill={spec.skin} />
						<rect x="28.6" y="35" width="6.8" height="9" rx="2" fill={spec.skin} />
						<rect x="28.6" y="35" width="6.8" height="3.4" fill="#000" opacity="0.08" />
						<ellipse cx="22.6" cy="28.6" rx="1.7" ry="2.4" fill={spec.skin} />
						<ellipse cx="41.4" cy="28.6" rx="1.7" ry="2.4" fill={spec.skin} />
						<ellipse cx="32" cy="27" rx="9.4" ry="11" fill={spec.skin} />
						<path d={FRONT_HAIR[spec.hairStyle]} fill={spec.hair} />
						{spec.glasses ? (
							<g fill="none" stroke="#2a2522" strokeWidth="0.9" opacity="0.75">
								<circle cx="28.2" cy="28" r="2.9" />
								<circle cx="35.8" cy="28" r="2.9" />
								<path d="M31.1 28H32.9" />
							</g>
						) : null}
					</g>
				</g>
			</svg>
			{image?.file_id && (
				<PortraitPhoto key={`${accessKey}:${attachmentVersionKey(image)}`} file={image} />
			)}
		</span>
	)
}

/** FileApi owns scope, request coalescing and expiry checks; this consumer retries once. */
function PortraitPhoto({ file }: { file: AttachmentItem }) {
	const { fileUrl, refreshFileUrl } = useFileUrl({
		file_id: file.file_id ?? "",
		updated_at: typeof file.updated_at === "string" ? file.updated_at : undefined,
	})
	const [loadedSource, setLoadedSource] = useState("")
	const [failed, setFailed] = useState(false)
	const [attempt, setAttempt] = useState(0)
	const retry = useRef(false)
	const mounted = useRef(true)
	useEffect(() => {
		const unsubscribe = subscribePortraitRecovery(() => {
			if (!retry.current) void refreshFileUrl()
		})
		mounted.current = true
		return () => {
			mounted.current = false
			unsubscribe()
		}
	}, [refreshFileUrl])
	if (!fileUrl || failed) return null
	return (
		<img
			key={`${fileUrl}:${attempt}`}
			src={fileUrl}
			alt=""
			aria-hidden
			className="absolute inset-0 size-full object-cover"
			style={{ visibility: loadedSource === `${fileUrl}:${attempt}` ? "visible" : "hidden" }}
			onLoad={() => setLoadedSource(`${fileUrl}:${attempt}`)}
			onError={() => {
				setLoadedSource("")
				if (retry.current) {
					setFailed(true)
					return
				}
				retry.current = true
				void refreshFileUrl(true).then((resource) => {
					if (!mounted.current) return
					if (resource?.url) setAttempt(1)
					else setFailed(true)
				})
			}}
		/>
	)
}

export default observer(PersonaAvatar)

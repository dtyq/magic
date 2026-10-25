import type { ComponentType } from "react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/utils/cn"

import { ConversationEmptyScene } from "./ConversationStateScenes"
import {
	BuildingScene,
	ConfirmScene,
	EmptyScene,
	LoadingScene,
	SearchEmptyScene,
} from "./WorkspaceStateScenes"
import {
	DatabaseEmptyScene,
	PermissionScene,
	PublishedScene,
	RetryScene,
} from "./SystemStateScenes"
import type { MicroAppStateIllustrationType, MicroAppStateSceneProps } from "./types"

export type { MicroAppStateIllustrationType } from "./types"

type IllustrationSize = "sm" | "md" | "lg"

interface MicroAppStateIllustrationProps {
	state: MicroAppStateIllustrationType
	size?: IllustrationSize
	animated?: boolean
	label?: string
	className?: string
	testId?: string
}

type NamedIllustrationProps = Omit<MicroAppStateIllustrationProps, "state">

const STATE_STYLE: Record<
	MicroAppStateIllustrationType,
	{
		accent: string
		surface: string
		scene: ComponentType<MicroAppStateSceneProps>
	}
> = {
	empty: { accent: "#8390A6", surface: "#F6F7F9", scene: EmptyScene },
	loading: { accent: "#5B7FEA", surface: "#F4F6FD", scene: LoadingScene },
	"conversation-empty": {
		accent: "#786FCE",
		surface: "#F5F3FC",
		scene: ConversationEmptyScene,
	},
	building: { accent: "#5B7FEA", surface: "#F4F6FD", scene: BuildingScene },
	confirm: { accent: "#806FE8", surface: "#F6F4FC", scene: ConfirmScene },
	"search-empty": { accent: "#8390A6", surface: "#F6F7F9", scene: SearchEmptyScene },
	retry: { accent: "#D79B3E", surface: "#FCF7EC", scene: RetryScene },
	permission: { accent: "#D85A54", surface: "#FCF3F2", scene: PermissionScene },
	published: { accent: "#58C98B", surface: "#F2FAF5", scene: PublishedScene },
	"database-empty": {
		accent: "#8390A6",
		surface: "#F6F7F9",
		scene: DatabaseEmptyScene,
	},
}

const SIZE_CLASS: Record<IllustrationSize, string> = {
	sm: "w-[120px]",
	md: "w-[156px]",
	lg: "w-[min(68vw,280px)]",
}

export function MicroAppStateIllustration({
	state,
	size = "md",
	animated = false,
	label,
	className,
	testId,
}: MicroAppStateIllustrationProps) {
	const reduceMotion = Boolean(useReducedMotion())
	const { accent, surface, scene: Scene } = STATE_STYLE[state]

	return (
		<div
			className={cn("relative aspect-[16/11] shrink-0", SIZE_CLASS[size], className)}
			data-testid={testId || `micro-app-state-${state}`}
			data-state={state}
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<svg viewBox="0 0 320 220" className="size-full overflow-visible">
				<Scene accent={accent} surface={surface} animated={animated && !reduceMotion} />
			</svg>
		</div>
	)
}

export function MicroAppEmptyIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="empty" />
}

export function MicroAppLoadingIllustration({ animated = true, ...props }: NamedIllustrationProps) {
	const reduceMotion = Boolean(useReducedMotion())
	const shouldAnimate = animated && !reduceMotion

	return (
		<div className="relative inline-flex shrink-0">
			<MicroAppStateIllustration {...props} state="loading" animated={false} />
			{shouldAnimate ? (
				<motion.span
					className="pointer-events-none absolute left-[31%] top-[49%] size-1.5 rounded-full bg-[#5B7FEA]/70"
					animate={{ opacity: [0, 1, 0], x: [0, 64] }}
					transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
					aria-hidden
				/>
			) : null}
		</div>
	)
}

export function MicroAppConversationEmptyIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="conversation-empty" />
}

export function MicroAppBuildingIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="building" />
}

export function MicroAppConfirmIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="confirm" />
}

export function MicroAppSearchEmptyIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="search-empty" />
}

export function MicroAppRetryIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="retry" />
}

export function MicroAppPermissionIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="permission" />
}

export function MicroAppPublishedIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="published" />
}

export function MicroAppDatabaseEmptyIllustration(props: NamedIllustrationProps) {
	return <MicroAppStateIllustration {...props} state="database-empty" />
}

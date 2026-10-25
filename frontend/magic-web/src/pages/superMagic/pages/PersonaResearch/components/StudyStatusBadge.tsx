import {
	CircleAlert,
	CircleCheck,
	CirclePause,
	MessageCircle,
	MessageCircleQuestion,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/utils/cn"
import type { StudyStatus } from "../services/studyStatus"
import styles from "./StudyStatusBadge.module.css"

/** Compact status pill with a live dot while the agent works; used in list rows and the header. */
export function StudyStatusBadge({
	status,
	className,
}: {
	status: StudyStatus
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	const config = {
		running: {
			label: t("status.running"),
			className: "bg-primary/10 text-primary",
			icon: (
				<span className="relative flex size-2">
					{/* Ping ring signals live work; reduced-motion users get a static dot. */}
					<span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
					<span className="relative inline-flex size-2 rounded-full bg-primary" />
				</span>
			),
		},
		waiting_user: {
			label: t("status.waitingUser"),
			className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
			icon: <MessageCircleQuestion className="size-3.5" />,
		},
		done: {
			label: t("status.done"),
			className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
			icon: <CircleCheck className="size-3.5" />,
		},
		failed: {
			label: t("status.failed"),
			className: "bg-destructive/10 text-destructive",
			icon: <CircleAlert className="size-3.5" />,
		},
		conversation: {
			label: t("status.conversation"),
			className: "bg-muted text-muted-foreground",
			icon: <MessageCircle className="size-3.5" />,
		},
		idle: {
			label: t("status.idle"),
			className: "bg-muted text-muted-foreground",
			icon: <CirclePause className="size-3.5" />,
		},
	}[status.kind]

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
				config.className,
				className,
			)}
		>
			{config.icon}
			{config.label}
		</span>
	)
}

/** Segmented 6-step progress bar; reads as "how far along" without labels. */
export function StudyProgressSegments({
	status,
	className,
}: {
	status: StudyStatus
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	return (
		<span
			className={cn("flex items-center gap-0.5", className)}
			role="img"
			aria-label={t("study.progress", { done: status.completed, total: status.total })}
		>
			{Array.from({ length: status.total }, (_, index) => (
				<span
					key={index}
					className={cn(
						"relative h-1 flex-1 overflow-hidden rounded-full transition-colors duration-500",
						index < status.completed ? "bg-primary" : "bg-border",
					)}
				>
					{index === status.completed && status.kind === "running" ? (
						<span
							className={cn(
								"absolute inset-y-0 left-0 rounded-full bg-primary",
								styles.runningFill,
							)}
						/>
					) : null}
				</span>
			))}
		</span>
	)
}

/** Placeholder for the status pill while study files load, instead of a misleading "paused". */
export function StudyStatusBadgeSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn("h-5 w-14 shrink-0 rounded-full", className)} />
}

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import MobileBrandHero from "@/pages/superMagicMobile/components/MobileBrandHero"

interface TopicPageMessageListFallbackProps {
	className?: string
}

export function TopicPageMessageListFallback({ className }: TopicPageMessageListFallbackProps) {
	return (
		<div
			className={cn(
				"mx-auto flex min-h-full w-full flex-1 items-center justify-center px-6 py-5",
				className,
			)}
			data-testid="mobile-topic-page-empty"
		>
			<MobileBrandHero imageClassName="size-[76px] rounded-[26px]" />
		</div>
	)
}

export function resolveTopicPageMessageListFallback(override?: ReactNode) {
	return override ?? <TopicPageMessageListFallback />
}

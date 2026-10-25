import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { SelfMediaPostOpsArtifacts } from "../services/selfMediaOpsArtifactStates"
import type { SelfMediaPostPublishStatus } from "../types"

type SelfMediaPostLifecycle = "draft" | "planned" | "archived" | "published" | "synced" | "reviewed"

const LIFECYCLE_STYLES: Record<SelfMediaPostLifecycle, string> = {
	draft: "bg-[#fff7ed] text-[#9a3412]",
	planned: "bg-[#f5f3ff] text-[#6d28d9]",
	archived: "bg-[#f4f4f5] text-[#52525b]",
	published: "bg-[#ecfeff] text-[#0e7490]",
	reviewed: "bg-[#ecfdf5] text-[#047857]",
	synced: "bg-[#eef2ff] text-[#4338ca]",
}

function resolvePostLifecycle(
	opsArtifacts: SelfMediaPostOpsArtifacts,
	publishStatus?: SelfMediaPostPublishStatus,
): SelfMediaPostLifecycle {
	if (publishStatus === "archived" || publishStatus === "planned") return publishStatus
	if (opsArtifacts.review) return "reviewed"
	if (opsArtifacts.metrics || opsArtifacts.comments) return "synced"
	if (opsArtifacts.source) return "published"
	return "draft"
}

export default function SelfMediaPostLifecycleStatus({
	opsArtifacts,
	postId,
	publishStatus,
}: {
	opsArtifacts: SelfMediaPostOpsArtifacts
	postId: string
	publishStatus?: SelfMediaPostPublishStatus
}) {
	const { t } = useTranslation("super")
	const lifecycle = resolvePostLifecycle(opsArtifacts, publishStatus)

	return (
		<span
			className={cn(
				"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-[760] leading-4",
				LIFECYCLE_STYLES[lifecycle],
			)}
			data-lifecycle={lifecycle}
			data-testid={`self-media-home-post-lifecycle-${postId}`}
		>
			{t(`detail.selfMedia.home.lifecycle.${lifecycle}`)}
		</span>
	)
}

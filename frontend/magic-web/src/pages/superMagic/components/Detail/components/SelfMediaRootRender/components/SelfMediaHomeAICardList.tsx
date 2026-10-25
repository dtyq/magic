import { Sparkles } from "lucide-react"
import type { SelfMediaAttachmentNode } from "../types"
import { CARD_THUMBNAIL_IMAGE_PROCESS } from "../constants/imageProcess"
import CardFrame from "./CardFrame"
import type {
	AICardFolderItem,
	SelfMediaHomeOpeningPost,
	SelfMediaHomeTranslate,
} from "./SelfMediaHomeTypes"
import { cn } from "@/utils/cn"

interface SelfMediaHomeAICardListProps {
	aiCardFolders: AICardFolderItem[]
	attachmentList?: SelfMediaAttachmentNode[]
	openingPost: SelfMediaHomeOpeningPost | null
	onOpenAICardFolder?: (folder: AICardFolderItem) => void
	t: SelfMediaHomeTranslate
}

function SelfMediaHomeAICardList({
	aiCardFolders,
	attachmentList,
	openingPost,
	onOpenAICardFolder,
	t,
}: SelfMediaHomeAICardListProps) {
	if (aiCardFolders.length === 0 || !onOpenAICardFolder) return null

	return (
		<section
			className={cn(
				"self-media-home-enter-item mb-8 space-y-4",
				openingPost && "self-media-home-opening-dim",
			)}
			style={{ animationDelay: "150ms" }}
			data-testid="self-media-home-ai-card-list"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<Sparkles size={14} />
					<span>
						{t("detail.selfMedia.home.aiCardCount", {
							count: aiCardFolders.length,
						})}
					</span>
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{aiCardFolders.map((folder) => {
					const name = folder.file_name || t("detail.selfMedia.home.aiCard")
					const latestHtml = folder.children?.find(
						(child) => child.file_name === "latest.html" && !child.is_directory,
					)
					return (
						<button
							key={folder.file_id}
							type="button"
							className="group flex min-h-28 cursor-pointer flex-col gap-3 rounded-[20px] bg-[#ffffff] p-4 text-left shadow-[inset_0_1px_rgba(255,255,255,0.75),0_10px_30px_rgba(47,43,36,0.06)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
							onClick={() => onOpenAICardFolder(folder)}
							data-testid={`self-media-home-ai-card-open-${folder.file_id}`}
						>
							<div className="flex items-start gap-3">
								<div className="flex h-[4.5rem] w-[3.375rem] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#e4e4e7] text-[#71717a]">
									{latestHtml?.file_id ? (
										<div className="pointer-events-none h-full w-full bg-white">
											<CardFrame
												cardId={`home-aicard-${folder.file_id}`}
												fileId={latestHtml.file_id}
												version={latestHtml.updated_at}
												attachmentList={attachmentList}
												imageProcessOptions={CARD_THUMBNAIL_IMAGE_PROCESS}
												className="h-full w-full"
												title={name}
											/>
										</div>
									) : (
										<Sparkles size={17} />
									)}
								</div>
								<div className="min-w-0 flex-1 space-y-1">
									<h3 className="truncate text-sm font-medium text-[#18181b]">
										{name}
									</h3>
									<p className="text-xs text-[#71717a]">
										{t("detail.selfMedia.home.aiCard")}
									</p>
								</div>
							</div>
						</button>
					)
				})}
			</div>
		</section>
	)
}

export default SelfMediaHomeAICardList

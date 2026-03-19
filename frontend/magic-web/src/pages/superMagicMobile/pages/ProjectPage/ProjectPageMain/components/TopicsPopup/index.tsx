import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconMessageCirclePlus } from "@tabler/icons-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import TopicItem from "./components/TopicItem/index"
import type { TopicsPopupProps } from "./types"

function TopicsPopup({ open, onOpenChange, onCreateTopic, onOpenActionsPopup }: TopicsPopupProps) {
	const { t } = useTranslation("super")
	const topics = topicStore.topics

	return (
		<MagicPopup
			visible={open}
			onClose={() => onOpenChange(false)}
			position="bottom"
			bodyClassName="h-[80vh]"
			title={t("topic.allTopics")}
		>
			<div className="flex h-full flex-col">
				{/* Header */}
				<div className="px-4 py-2.5">
					<div className="text-start text-lg font-semibold text-foreground">
						{t("topic.allTopics")} ({topics.length})
					</div>
				</div>

				{/* Content - Topic List */}
				<div className="flex-1 overflow-y-auto px-4">
					<div className="flex flex-col gap-0.5">
						{topics.map((topic) => (
							<TopicItem
								key={topic.id}
								topic={topic}
								onClose={() => onOpenChange(false)}
								onOpenActionsPopup={(topic) =>
									onOpenActionsPopup(topic, projectStore.selectedProject)
								}
							/>
						))}
					</div>
				</div>

				{/* Footer - Create Topic Button */}
				<div className="p-4">
					<button
						onClick={() => {
							onCreateTopic()
							onOpenChange(false)
						}}
						className="shadow-xs flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						<IconMessageCirclePlus size={16} />
						<span>{t("topic.createNewTopic")}</span>
					</button>
				</div>
			</div>
		</MagicPopup>
	)
}

export default observer(TopicsPopup)

import { observer } from "mobx-react-lite"
import type { ReactNode } from "react"
import CurrentSceneBadge from "@/pages/superMagic/components/MainInputContainer/components/SelectedSkillBadge"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { SCENE_INPUT_IDS } from "@/pages/superMagic/components/MainInputContainer/constants"
import { sceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"
import SceneSwitcher from "@/pages/superMagic/components/MainInputContainer/components/SceneSwitcher"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import MobileComposerModeSelector from "./MobileComposerModeSelector"

interface MobileComposerHeaderProps {
	scenes?: SceneItem[]
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
	agentCode?: string | null
	selectorVariant?: "default" | "claw"
	messagesLength?: number
	sceneControlNode?: ReactNode
	onModeChange?: SceneEditorContext["setTopicMode"]
}

function MobileComposerHeaderComponent({
	scenes,
	selectedTopic,
	selectedProject,
	topicMode,
	agentCode,
	selectorVariant = "default",
	messagesLength,
	sceneControlNode,
	onModeChange,
}: MobileComposerHeaderProps) {
	const selectedScene = sceneStateStore.currentScene
	const shouldShowSelector = selectorVariant !== "claw"
	const hasSceneContent =
		Boolean(sceneControlNode) || Boolean(selectedScene) || Boolean(scenes?.length)

	if (!shouldShowSelector && !hasSceneContent) return null

	return (
		<div className="flex min-h-8 items-center gap-2" data-testid="mobile-composer-header">
			{shouldShowSelector ? (
				<MobileComposerModeSelector
					className="pl-1 pr-2"
					iconSize={28}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					topicMode={topicMode}
					agentCode={agentCode}
					selectorVariant={selectorVariant}
					messagesLength={messagesLength}
					onModeChange={onModeChange}
				/>
			) : null}

			<div className="relative flex h-8 min-w-0 flex-1 items-center overflow-hidden">
				{sceneControlNode ? (
					sceneControlNode
				) : selectedScene ? (
					<CurrentSceneBadge
						scene={selectedScene}
						variant="outlineButton"
						onClose={() => {
							sceneStateStore.setCurrentScene(null)
						}}
					/>
				) : scenes?.length ? (
					<SceneSwitcher scenes={scenes} onSceneClick={sceneStateStore.setCurrentScene} />
				) : (
					<div id={SCENE_INPUT_IDS.SCENES_SWITCHER} className="min-w-0 flex-1" />
				)}
			</div>
		</div>
	)
}

const MobileComposerHeader = observer(MobileComposerHeaderComponent)

export default MobileComposerHeader

import { observer } from "mobx-react-lite"
import LazyScenePanel from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel"
import CurrentSceneBadge from "@/pages/superMagic/components/MainInputContainer/components/SelectedSkillBadge"
import ModeSelector from "../BottomInputBar/ModeSelector"
import {
	SceneStateProvider,
	sceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import {
	SCENE_INPUT_IDS,
	INPUT_CONTAINER_MIN_HEIGHT,
} from "@/pages/superMagic/components/MainInputContainer/constants"
import { roleStore } from "@/pages/superMagic/stores/RoleStore"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { ScenePanelVariant } from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel/types"

const MobileInputLayout = observer(function MobileInputLayout({
	editorContext,
}: {
	editorContext: SceneEditorContext
}) {
	const selectedScene = sceneStateStore.currentScene
	const currentRole = roleStore.currentRole

	const scenes = currentRole
		? superMagicModeService.getModeConfigWithLegacy(currentRole)?.mode.playbooks
		: []

	return (
		<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.Mobile}>
			<div className="flex w-full flex-col gap-2.5">
				{/* Plugin Tips or Selected Skill Badge */}
				<div className="flex items-center gap-2 pr-2.5 pt-2.5">
					<ModeSelector className="h-7" iconSize={28} />
					{scenes && scenes.length > 0 && <div className="h-5 w-[1px] bg-border" />}
					{selectedScene ? (
						<CurrentSceneBadge
							scene={selectedScene}
							variant="outlineButton"
							onClose={() => {
								sceneStateStore.setCurrentScene(null)
							}}
						/>
					) : (
						<div id={SCENE_INPUT_IDS.SCENES_SWITCHER} className="min-w-0 flex-1" />
					)}
				</div>
				<div className="mx-2.5 border-b border-border pb-5 pt-3 [&:empty]:hidden">
					<LazyScenePanel scenes={scenes} editorContext={editorContext} />
				</div>
				{/* skill editor input container with min height to prevent layout shift */}
				<div
					id={SCENE_INPUT_IDS.INPUT_CONTAINER}
					style={{ minHeight: INPUT_CONTAINER_MIN_HEIGHT.HomePage }}
				/>
			</div>
		</SceneStateProvider>
	)
})

export default MobileInputLayout

import { GuideTourElementId } from "../LazyGuideTour"
import { ScenePanelVariant } from "../MainInputContainer/components/LazyScenePanel/types"
import CurrentSceneBadge from "../MainInputContainer/components/SelectedSkillBadge"
import { SCENE_INPUT_IDS, INPUT_CONTAINER_MIN_HEIGHT } from "../MainInputContainer/constants"
import { SceneStateProvider, SceneStateStore } from "../MainInputContainer/stores"
import { ModeToggle } from "../TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import LazyScenePanel from "../MainInputContainer/components/LazyScenePanel"
import { cn } from "@/lib/utils"
import {
	SceneEditorContext,
	SceneEditorNodes,
} from "../MainInputContainer/components/editors/types"
import { MessageEditorSize } from "../MessageEditor/types"
import { observer } from "mobx-react-lite"
import { getEditorSpanClass } from "../MessageEditor/constants/editor_span_map"

interface DesktopInputContainerProps {
	sceneStateStore: SceneStateStore
	containerRef?: React.RefObject<HTMLDivElement>
	className?: string
	classNames?: {
		container?: string
		editorWrapper?: string
		editor?: string
	}
	editorSize: MessageEditorSize
	isFocused: boolean
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
}

function DesktopInputContainer({
	sceneStateStore,
	containerRef,
	className,
	classNames,
	editorSize,
	isFocused,
	editorContext,
	editorNodes,
}: DesktopInputContainerProps) {
	const scenes = superMagicModeService.getModeConfigWithLegacy(editorContext.topicMode)?.mode
		.playbooks
	const currentScene = sceneStateStore.currentScene

	return (
		<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.TopicPage}>
			<div
				ref={containerRef}
				id={GuideTourElementId.MessagePanel}
				className={cn(
					"relative flex w-full flex-none flex-col items-start gap-2 self-stretch",
					"rounded-2xl border border-border bg-sidebar p-2",
					getEditorSpanClass(editorSize),
					className,
					classNames?.container,
				)}
			>
				<div className="flex w-full flex-col gap-2 [&:empty]:hidden">
					{editorNodes?.taskDataNode}
					{editorNodes?.messageQueueNode}
				</div>
				<div className="flex w-full items-center gap-4 overflow-hidden">
					{/* 话题模式切换器 */}
					<ModeToggle
						size={editorSize}
						topicMode={editorContext.topicMode}
						allowChangeMode={(editorContext.messagesLength ?? 0) > 0 ? false : true}
						onModeChange={editorContext.setTopicMode}
					/>
					{scenes && scenes.length > 0 && (
						<div className="h-[60%] w-[1px] bg-border"></div>
					)}
					{/* 场景切换器 */}
					{currentScene ? (
						<CurrentSceneBadge
							scene={currentScene}
							variant="outlineButton"
							onClose={() => sceneStateStore.setCurrentScene(null)}
						/>
					) : (
						<div id={SCENE_INPUT_IDS.SCENES_SWITCHER} className="min-w-0 flex-1"></div>
					)}
				</div>
				<div className={cn("w-full", classNames?.editorWrapper)}>
					<div
						className={cn(
							"z-[2] flex flex-col gap-2 overflow-hidden border border-transparent",
							classNames?.editor,
							isFocused && "border-blue-500",
						)}
						data-testid="message-panel-input-group"
					>
						<div
							className={cn("flex flex-col", {
								"gap-1.5": editorSize !== "default",
							})}
						>
							<div
								id={SCENE_INPUT_IDS.INPUT_CONTAINER}
								className="h-full"
								style={{ minHeight: INPUT_CONTAINER_MIN_HEIGHT.TopicPage }}
							></div>
						</div>
						{/* skill config container with smooth transition */}
						<LazyScenePanel
							scenes={scenes}
							editorContext={editorContext}
							editorNodes={editorNodes}
						/>
					</div>
				</div>
			</div>
		</SceneStateProvider>
	)
}

export default observer(DesktopInputContainer)

import { useEffect, useMemo, useRef, useState, type Ref } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { ScenePanelVariant } from "@/pages/superMagic/components/MainInputContainer/components/LazyScenePanel/types"
import {
	SceneStateProvider,
	buildTopicInputScopeKey,
	createSceneStateStore,
	sceneStateStore as sharedSceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { CreatedProject, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { analyticsService } from "@/services/analytics"
import { resolveMicroAppModelSelectionMode } from "@/pages/superMagic/pages/MicroAppPage/utils/microAppModelMode"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import promptExampleData from "./microAppPromptExamples.json"
import styles from "./MicroAppCreatePrompt.module.css"
import cableStyles from "./MicroAppKeyboardCable.module.css"

interface MicroAppCreatePromptProps {
	workspace: Workspace | null
	onCreated: (appId: string) => void
	onFocusChange?: (focused: boolean) => void
	mobile?: boolean
	keyboardPortRef?: Ref<HTMLSpanElement>
	keyboardConnectorReady?: boolean
	keyboardConnectorVisible?: boolean
}

const EDITOR_CONTAINER_CLASS_NAME = [
	// 输入框继续保持白色和轻盈感，边框与层级细节由场景样式统一控制。
	"!rounded-[12px] !border !bg-[#f7f8f8]",
	"dark:!bg-zinc-950/[0.82]",
	"[&_[data-testid=super-message-editor-toolbar]_button]:!rounded-[7px]",
	"[&_[data-testid=super-message-editor-toolbar-right]_button]:!h-8",
	"[&_[data-testid=super-message-editor-toolbar-right]_button]:!min-w-8",
].join(" ")

function MicroAppCreatePrompt({
	workspace,
	onCreated,
	onFocusChange,
	mobile = false,
	keyboardPortRef,
	keyboardConnectorReady = true,
	keyboardConnectorVisible = true,
}: MicroAppCreatePromptProps) {
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const [sceneStateStore] = useState(() =>
		mobile ? sharedSceneStateStore : createSceneStateStore(),
	)
	const modelTopicMode = resolveMicroAppModelSelectionMode()
	const appIdsByProjectIdRef = useRef(new Map<string, string>())
	const promptCarousel = useMemo<SceneEditorContext["promptCarousel"]>(() => {
		if (mobile) return undefined

		return {
			examples: promptExampleData.examples
				.map((example) => lt(example.text))
				.filter((example): example is string => Boolean(example)),
			typingIntervalMs: 45,
			holdDurationMs: 3000,
			fadeDurationMs: 180,
			clickable: true,
			tabLabel: "Tab",
			acceptLabel: t("microAppsPage.heroPromptAccept"),
			navigationLabel: t("microAppsPage.heroPromptSwitch"),
			applyAriaLabel: t("microAppsPage.heroPromptApply"),
		}
	}, [lt, mobile, t])

	useEffect(() => {
		sceneStateStore.setInputScopeKey(
			buildTopicInputScopeKey(TopicMode.MicroApp, "", "micro-apps-create"),
		)

		return () => sceneStateStore.setInputScopeKey("")
	}, [sceneStateStore])

	useEffect(() => {
		// 列表页的输入始终创建新项目，不能继承用户上一个详情页残留的项目和话题。
		projectStore.setSelectedProject(null)
		topicStore.setSelectedTopic(null)
	}, [])

	const editorContext = useMemo<SceneEditorContext>(
		() => ({
			draftKey: createMessageEditorDraftKey({
				selectedWorkspace: workspace,
				selectedProject: null,
				selectedTopic: null,
			}),
			selectedWorkspace: workspace,
			selectedProject: null,
			selectedTopic: null,
			setSelectedWorkspace: workspaceStore.setSelectedWorkspace,
			setSelectedProject: projectStore.setSelectedProject,
			setSelectedTopic: topicStore.setSelectedTopic,
			refreshProjectAfterTopicRename: true,
			topicMode: TopicMode.MicroApp,
			modelTopicMode,
			placeholder: t("microAppsPage.heroPlaceholder"),
			promptCarousel,
			enableMessageSendByContent: true,
			skipInitialDraftRestore: true,
			size: mobile ? "mobile" : "default",
			containerClassName: mobile
				? undefined
				: `${EDITOR_CONTAINER_CLASS_NAME} ${styles.retroEnterKeyScope}`,
			className: mobile ? undefined : "min-h-[92px]",
			showModeToggle: mobile ? false : undefined,
			showModelSelector: mobile ? true : undefined,
			onEditorFocus: () => onFocusChange?.(true),
			onEditorBlur: () => onFocusChange?.(false),
			layoutConfig: {
				topBarLeft: [ToolbarButton.AT],
				bottomLeft: [ToolbarButton.MODEL_SWITCH],
				bottomRight: [
					ToolbarButton.INTERNET_SEARCH,
					ToolbarButton.MCP,
					ToolbarButton.UPLOAD,
					ToolbarButton.DIVIDER,
					ToolbarButton.VOICE_INPUT,
					ToolbarButton.SEND_BUTTON,
				],
			},
			modules: {
				upload: { confirmDelete: false },
			},
			createProject: async (): Promise<CreatedProject | null> => {
				if (!workspace?.id) return null

				analyticsService.report("project_create_attempted", {
					workspaceId: String(workspace.id),
					sceneOverride: "micro_app",
				})
				const created = await SuperMagicApi.createMicroAppProject({
					workspace_id: String(workspace.id),
					dynamic_params: {
						agent_mode: "micro-app",
						message_version: "v2",
					},
				})
				appIdsByProjectIdRef.current.set(String(created.project.id), String(created.app_id))
				return {
					project: created.project,
					topic: created.topic,
				}
			},
			onSendSuccess: ({ currentProject }) => {
				const appId = currentProject?.id
					? appIdsByProjectIdRef.current.get(String(currentProject.id))
					: undefined
				if (appId) onCreated(appId)
			},
		}),
		[mobile, modelTopicMode, onCreated, onFocusChange, promptCarousel, t, workspace],
	)

	return (
		<SceneStateProvider store={sceneStateStore} variant={ScenePanelVariant.HomePage}>
			<div
				className={`${cableStyles.promptShell} w-full`}
				data-testid="micro-apps-create-prompt"
				onFocus={mobile ? undefined : () => onFocusChange?.(true)}
				onBlur={(event) => {
					if (mobile) return
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
						onFocusChange?.(false)
					}
				}}
			>
				{!mobile && keyboardConnectorVisible ? (
					<div
						className={cableStyles.keyboardPort}
						data-ready={keyboardConnectorReady}
						data-testid="micro-apps-keyboard-port"
						aria-hidden="true"
					>
						<span ref={keyboardPortRef} className={cableStyles.keyboardCableEnd} />
						<span className={cableStyles.keyboardPortSlot} />
						<span className={cableStyles.keyboardPortLight} />
					</div>
				) : null}
				{mobile ? (
					<MobileInputContainer editorContext={editorContext} />
				) : (
					<DefaultMessageEditorContainer editorContext={editorContext} />
				)}
			</div>
		</SceneStateProvider>
	)
}

export default observer(MicroAppCreatePrompt)

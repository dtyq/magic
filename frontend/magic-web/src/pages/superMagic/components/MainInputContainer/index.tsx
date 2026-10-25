import { useEffect, useRef, useState, type ComponentType } from "react"
import { ArrowUp } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Button } from "@/components/shadcn-ui/button"
import MainInputHeaderSlot from "@/pages/superMagic/components/MainInputContainer/components/MainInputHeaderSlot/index"
import SloganContainer from "./components/SloganContainer"
// import HomeModeTabs from "./components/HomeModeTabs"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import { createPortal } from "react-dom"
import { AGENT_INPUT_CONTAINER_HEADER_ID, SCENE_INPUT_IDS } from "./constants"
import usePortalTarget from "@/hooks/usePortalTarget"
import RoleSwitcher from "./components/RoleSwitcher"
import EditorLayout, { type EditorLayoutProps } from "./scenes/EditorLayout"
import { roleStore } from "../../stores"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { createSceneStateStore } from "./stores"
import { useMemoizedFn } from "ahooks"
import useAgentCodeModeFromSearch from "../../hooks/useAgentCodeModeFromSearch"
import type { SceneEditorContext } from "./components/editors/types"

const Container = observer(function Container({
	editorContext,
	EditorComponent = EditorLayout,
	editorSessionKey,
	showRoleSwitcher = true,
	homeVariant = "task",
}: {
	editorContext?: Partial<SceneEditorContext>
	EditorComponent?: ComponentType<EditorLayoutProps>
	editorSessionKey?: string
	showRoleSwitcher?: boolean
	homeVariant?: "chat" | "task"
}) {
	const { t } = useTranslation()
	const { currentRole, setCurrentRole } = roleStore
	const [sceneStateStore] = useState(() => createSceneStateStore())
	const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false)
	const [showBackToTop, setShowBackToTop] = useState(false)
	const workspaceViewportRef = useRef<HTMLDivElement>(null)

	const headerPortalTarget = usePortalTarget({
		portalId: AGENT_INPUT_CONTAINER_HEADER_ID,
		enabled: currentRole !== TopicMode.General,
	})

	const handleResolveMode = useMemoizedFn((mode: TopicMode) => {
		setShouldAutoFocusEditor(true)
		setCurrentRole(mode)
	})

	useAgentCodeModeFromSearch({
		onModeResolved: handleResolveMode,
		onAgentCodeCleared: () => setShouldAutoFocusEditor(false),
	})

	useEffect(() => {
		const viewport = workspaceViewportRef.current
		if (!viewport) return

		const updateBackToTopVisibility = () => {
			setShowBackToTop(currentRole === TopicMode.PPT && viewport.scrollTop > 320)
		}

		updateBackToTopVisibility()
		viewport.addEventListener("scroll", updateBackToTopVisibility, { passive: true })
		return () => viewport.removeEventListener("scroll", updateBackToTopVisibility)
	}, [currentRole])

	function handleBackToTop() {
		workspaceViewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
	}

	return (
		<div className="relative h-[calc(100%-48px)] w-full min-w-0">
			<ScrollArea
				data-testid="main-workspace-container"
				viewportRef={workspaceViewportRef}
				className={cn(
					"size-full max-w-full px-4",
					"[&_[data-slot='scroll-area-viewport']>div]:!flex [&_[data-slot='scroll-area-viewport']>div]:!w-full [&_[data-slot='scroll-area-viewport']>div]:!justify-center",
					"[&_[data-slot='scroll-area-viewport']]:!flex",
				)}
			>
				<div className="flex min-h-full w-full flex-col items-center">
					<div className="my-auto flex w-full flex-col items-center gap-8 pb-10 pt-10">
						<div className="flex w-full max-w-4xl flex-col items-center gap-8">
							<MainInputHeaderSlot />
							{/* Temporarily hidden on Web; switch between chat and task from the global sidebar. */}
							{/* <HomeModeTabs /> */}

							{/* Welcome Message */}
							<SloganContainer variant={homeVariant} />

							{/* Task home exposes employee selection; chat home uses the platform default employee. */}
							{showRoleSwitcher && (
								<RoleSwitcher role={currentRole} onActionClick={setCurrentRole} />
							)}

							{headerPortalTarget &&
								createPortal(
									<div
										id={AGENT_INPUT_CONTAINER_HEADER_ID}
										className="flex items-center justify-between"
									/>,
									headerPortalTarget,
								)}
						</div>

						{/* Reset the editor session without remounting the home navigation and layout. */}
						<EditorComponent
							key={editorSessionKey}
							editorContext={editorContext}
							inputContainerId={
								editorContext?.sceneInputContainerId ??
								SCENE_INPUT_IDS.INPUT_CONTAINER
							}
							mode={currentRole}
							sceneStateStore={sceneStateStore}
							autoFocus={shouldAutoFocusEditor}
							onAutoFocusHandled={() => setShouldAutoFocusEditor(false)}
						/>
					</div>
				</div>
			</ScrollArea>
			{showBackToTop ? (
				<Button
					type="button"
					size="icon"
					className="absolute bottom-6 right-6 z-[60] size-11 rounded-full shadow-lg"
					aria-label={t("backToTop")}
					data-testid="ppt-back-to-top"
					onClick={handleBackToTop}
				>
					<ArrowUp className="size-5" />
				</Button>
			) : null}
		</div>
	)
})

export default Container

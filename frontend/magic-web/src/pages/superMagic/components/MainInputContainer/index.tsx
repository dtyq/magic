import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MainInputHeaderSlot from "@/pages/superMagic/components/MainInputContainer/components/MainInputHeaderSlot/index"
import SloganContainer from "./components/SloganContainer"
import { TopicMode } from "../../pages/Workspace/types"
import { createPortal } from "react-dom"
import { AGENT_INPUT_CONTAINER_HEADER_ID } from "./constants"
import usePortalTarget from "@/hooks/usePortalTarget"
import RoleSwitcher from "./components/RoleSwitcher"
import EditorLayout from "./scenes/EditorLayout"
import { roleStore } from "../../stores"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import { createSceneStateStore } from "./stores"
import { useLocation } from "react-router"
import { useModeList } from "../MessagePanel/hooks/usePatternTabs"

const Container = observer(function Container() {
	const { currentRole, setCurrentRole } = roleStore
	const [sceneStateStore] = useState(() => createSceneStateStore())
	const [shouldAutoFocusEditor, setShouldAutoFocusEditor] = useState(false)
	const location = useLocation()
	const { modeList } = useModeList({ includeGeneral: true, includeChat: true })
	const consumedAgentCodeRef = useRef<string | null>(null)

	const headerPortalTarget = usePortalTarget({
		portalId: AGENT_INPUT_CONTAINER_HEADER_ID,
		enabled: currentRole !== TopicMode.General,
	})

	useEffect(() => {
		const agentCode = new URLSearchParams(location.search).get("agentCode")?.trim() || null
		if (!agentCode) {
			consumedAgentCodeRef.current = null
			setShouldAutoFocusEditor(false)
			return
		}
		if (consumedAgentCodeRef.current === agentCode) return

		const targetMode = modeList.find((item) => item.mode.identifier === agentCode)?.mode
			.identifier
		if (!targetMode) return

		consumedAgentCodeRef.current = agentCode
		setShouldAutoFocusEditor(true)
		setCurrentRole(targetMode as TopicMode)
	}, [location.search, modeList, setCurrentRole])

	return (
		<ScrollArea
			data-testid="main-workspace-container"
			className={cn(
				"h-[calc(100%-48px)] w-full max-w-full px-4",
				"[&_[data-slot='scroll-area-viewport']>div]:!flex [&_[data-slot='scroll-area-viewport']>div]:!w-full [&_[data-slot='scroll-area-viewport']>div]:!justify-center",
				"[&_[data-slot='scroll-area-viewport']]:!flex",
			)}
		>
			<div className="flex min-h-full w-full max-w-4xl flex-col items-center">
				<div className="my-auto flex w-full flex-col items-center gap-8 pb-10 pt-10">
					<MainInputHeaderSlot />

					{/* Welcome Message */}
					<SloganContainer />

					{/* Quick Action Buttons */}
					<RoleSwitcher role={currentRole} onActionClick={setCurrentRole} />

					{headerPortalTarget &&
						createPortal(
							<div
								id={AGENT_INPUT_CONTAINER_HEADER_ID}
								className="flex items-center justify-between"
							/>,
							headerPortalTarget,
						)}

					<EditorLayout
						mode={currentRole}
						sceneStateStore={sceneStateStore}
						autoFocus={shouldAutoFocusEditor}
						onAutoFocusHandled={() => setShouldAutoFocusEditor(false)}
					/>
				</div>
			</div>
		</ScrollArea>
	)
})

export default Container

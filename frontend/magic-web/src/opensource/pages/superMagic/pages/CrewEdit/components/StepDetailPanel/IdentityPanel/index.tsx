import { useState, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import { useCrewEditStore } from "../../../context"
import {
	ScannerHeader,
	IdentityCardContent,
	IdentityGeneratingCard,
	IdentityGeneratingCopy,
	IdentityPromptPanel,
} from "./components"
import { CREW_PANEL_IDS } from "./constants"

const CREWDO_LOGO_SIZE = 50

/**
 * Badge drop physics: falls fast (gravity), cord snaps taut,
 * momentum carries badge forward like a pendulum, then decays.
 * Pivot is at the TOP of the element (lanyard attachment point).
 */
const SWING_TIMES = [0, 0.32, 0.52, 0.7, 0.84, 1]

function IdentityPanel() {
	const store = useCrewEditStore()
	const { identity, skills, conversation } = store
	const member = {
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
		scenes: [],
	}
	const globalConfig = globalConfigStore.globalConfig
	const isConversationLocked = conversation.isConversationLocked
	const crewdoLogoUrl = globalConfig?.minimal_logo
		? getAvatarUrl(globalConfig.minimal_logo, CREWDO_LOGO_SIZE)
		: ""

	const [promptOpen, setPromptOpen] = useState(false)
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

	useEffect(() => {
		setPortalContainer(document.getElementById(CREW_PANEL_IDS.promptPanelContainer))
	}, [])

	useEffect(() => {
		if (isConversationLocked) setPromptOpen(false)
	}, [isConversationLocked])

	const openPrompt = useCallback(() => {
		if (isConversationLocked) return
		setPromptOpen(true)
	}, [isConversationLocked])

	const savePrompt = useCallback(
		(value: string) => {
			void identity.savePrompt(value)
			setPromptOpen(false)
		},
		[identity],
	)

	const closePrompt = useCallback(() => {
		setPromptOpen(false)
	}, [])

	return (
		<div
			className="relative z-10 flex w-full flex-1 flex-col items-center"
			style={{ perspective: 900, perspectiveOrigin: "50% -10%" }}
		>
			<motion.div
				className="flex flex-col items-center"
				initial={{ y: -280, opacity: 0, rotateX: -10, rotateY: -5, rotateZ: -3 }}
				animate={{
					y: 0,
					opacity: 1,
					rotateX: [-10, 0, 12, -5, 2, 0],
					rotateY: [-5, 0, 3, -1, 0, 0],
					rotateZ: [-3, 0, 2, -1, 0, 0],
				}}
				transition={{
					duration: 0.65,
					times: SWING_TIMES,
					ease: "easeOut",
					y: { duration: 0.22, ease: [0.7, 0, 0.95, 0.6] },
					opacity: { duration: 0.16 },
				}}
				style={{ transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
				data-testid={
					isConversationLocked ? "crew-identity-generating-card" : "crew-identity-card"
				}
			>
				{isConversationLocked ? (
					<div className="flex flex-col items-center gap-8">
						<div className="relative h-[760px] w-[700px] overflow-hidden">
							<div className="absolute left-1/2 top-0 -translate-x-1/2">
								<ScannerHeader logoUrl={crewdoLogoUrl} />
							</div>
							<IdentityGeneratingCard member={member} />
						</div>
						<IdentityGeneratingCopy />
					</div>
				) : (
					<>
						<ScannerHeader logoUrl={crewdoLogoUrl} />

						<div className="relative z-[-1] flex w-[400px] flex-col gap-2 overflow-hidden rounded-3xl border border-border bg-white/30 px-4 pb-4 pt-12">
							<div className="absolute left-1/2 top-[19px] h-[10px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
							<IdentityCardContent
								onOpenPrompt={openPrompt}
								disabled={isConversationLocked}
							/>
						</div>
					</>
				)}
			</motion.div>

			{portalContainer &&
				createPortal(
					<IdentityPromptPanel
						open={promptOpen}
						onClose={closePrompt}
						initialValue={member.prompt ?? ""}
						onSave={savePrompt}
						disabled={isConversationLocked}
					/>,
					portalContainer,
				)}
		</div>
	)
}

export default observer(IdentityPanel)

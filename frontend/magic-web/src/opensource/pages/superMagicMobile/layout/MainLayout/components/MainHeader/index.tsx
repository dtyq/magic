import { observer } from "mobx-react-lite"
import { useRef } from "react"
import type { WorkspaceSelectRef } from "../../../../components/WorkspaceSelect"
import WorkspaceSelect from "../../../../components/WorkspaceSelect"
import FlexBox from "@/opensource/components/base/FlexBox"
import { ChevronLeft } from "lucide-react"
import { PORTAL_IDS } from "@/opensource/constants"
import { useParams } from "react-router"

interface MainHeaderProps {
	/**
	 * Whether to show the back button
	 */
	showBackButton?: boolean
	/**
	 * Custom back button click handler
	 */
	onBackClick?: () => void
}

function MainHeader({ showBackButton, onBackClick }: MainHeaderProps) {
	const { projectId } = useParams()

	const workspaceSelectRef = useRef<WorkspaceSelectRef>(null)

	const onProjectPage = showBackButton ?? !!projectId

	return (
		<div className="flex h-[calc(50px+var(--safe-area-inset-top))] items-center gap-2 rounded-b-xl border-b bg-background p-2.5 pt-[calc(0.65rem+var(--safe-area-inset-top))]">
			{onProjectPage ? (
				<ChevronLeft
					size={32}
					onClick={onBackClick}
					className="cursor-pointer"
					strokeWidth={1.5}
				/>
			) : null}
			<div className="flex-1 overflow-hidden">
				<WorkspaceSelect ref={workspaceSelectRef} />
			</div>
			{onProjectPage && (
				<FlexBox className="w-fit flex-[0_0_auto] items-center justify-center text-muted-foreground">
					<div
						className="flex flex-[0_0_auto] items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_COLLABORATION_BUTTON}
					/>
					<div
						className="flex flex-[0_0_auto] items-center justify-center"
						id={PORTAL_IDS.SUPER_MAGIC_MOBILE_HEADER_RIGHT_CREATE_BUTTON}
					/>
				</FlexBox>
			)}
		</div>
	)
}

export default observer(MainHeader)

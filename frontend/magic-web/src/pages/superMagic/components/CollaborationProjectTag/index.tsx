import { memo } from "react"
import { useTranslation } from "react-i18next"
import { CollaborationProjectListItem, ProjectListItem } from "../../pages/Workspace/types"
import { isWorkspaceShortcutProject } from "../../constants"
import CollaborationShortCut from "../CollaborationShortCut"
import { cn } from "@/lib/utils"
import { Users } from "lucide-react"

export interface CollaborationProjectTagProps {
	/**
	 * Custom class name for the component
	 */
	className?: string
	/**
	 * Custom style for the component
	 */
	style?: React.CSSProperties
	/**
	 * Whether to show the tag (optional, defaults to true for backward compatibility)
	 */
	visible?: boolean
	/**
	 * Custom text to display instead of default localized text
	 */
	text?: string
	/**
	 * Whether to show the text
	 */
	showText?: boolean
	/**
	 * The project to display
	 */
	project?: ProjectListItem | CollaborationProjectListItem
}

function CollaborationProjectTag({
	className,
	style,
	visible = true,
	text,
	showText = true,
	project,
}: CollaborationProjectTagProps) {
	const { t } = useTranslation("super")

	if (!visible) {
		return null
	}

	if (isWorkspaceShortcutProject(project)) {
		return <CollaborationShortCut className={className} />
	}

	return (
		<div
			className={cn(
				"relative inline-flex h-[18px] flex-shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-blue-200 bg-blue-50 text-primary",
				showText ? "w-fit gap-0.5 p-0.5" : "w-[18px] p-0.5",
				className,
			)}
			style={style}
			data-testid="super-collaboration-project-tag"
			data-project-id={project?.id}
		>
			<div className="flex shrink-0 items-center justify-center text-blue-500">
				<Users size={12} className="!h-[12px] !w-[12px]" />
			</div>
			{showText && (
				<span className="text-[10px] font-normal leading-[13px] text-blue-500">
					{text || t("project.collaboration")}
				</span>
			)}
		</div>
	)
}

export default memo(CollaborationProjectTag)

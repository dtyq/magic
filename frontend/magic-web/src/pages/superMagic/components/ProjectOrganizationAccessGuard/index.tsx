import MagicSpin from "@/components/base/MagicSpin"
import { useTranslation } from "react-i18next"
import OrganizationSwitchState from "@/components/business/OrganizationSwitchState"
import FolderIcon from "@/pages/share/assets/icon/folder_empty.svg"
import { useProjectOrganizationAccessContext } from "../../contexts/ProjectOrganizationAccessContext"
import type { ReactNode } from "react"

interface ProjectOrganizationAccessGuardProps {
	children: ReactNode
}

export default function ProjectOrganizationAccessGuard({
	children,
}: ProjectOrganizationAccessGuardProps) {
	const { t } = useTranslation("super")
	const organizationAccess = useProjectOrganizationAccessContext()

	if (organizationAccess.status === "ready") return <>{children}</>

	if (organizationAccess.status === "loading") {
		return (
			<div className="h-full w-full bg-background">
				<MagicSpin className="h-full" />
			</div>
		)
	}

	const isSwitching = organizationAccess.status === "switching"
	const targetOrganizationName = organizationAccess.targetOrganization?.organization_name || ""

	return (
		<div
			className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#F9F9F9]"
			data-testid="project-organization-switch"
		>
			<OrganizationSwitchState
				icon={FolderIcon}
				title={t("collaborators.organizationSwitch.title")}
				description={t("collaborators.organizationSwitch.description", {
					organizationName: targetOrganizationName,
				})}
				userInfo={organizationAccess.targetUserInfo}
				actionLabel={t("collaborators.organizationSwitch.action")}
				switchingLabel={t("collaborators.organizationSwitch.switching")}
				isSwitching={isSwitching}
				onSwitch={organizationAccess.handleSwitchOrganization}
				testIdPrefix="project-organization-switch"
			/>
		</div>
	)
}

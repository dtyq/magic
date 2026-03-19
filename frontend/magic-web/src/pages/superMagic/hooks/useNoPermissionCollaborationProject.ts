import { useMemoizedFn } from "ahooks"
import routeManageService from "../services/routeManageService"
import MagicModal from "@/components/base/MagicModal"
import { useTranslation } from "react-i18next"

export function useNoPermissionCollaborationProject() {
	const { t } = useTranslation("super")

	const handleNoPermissionCollaborationProject = useMemoizedFn((error: any) => {
		if (error?.code === 51202) {
			const modal = MagicModal.info({
				title: t("collaborators.noPermissionCollaborationProject"),
				content: t("collaborators.noPermissionCollaborationProjectContent"),
				centered: true,
				onOk: () => modal.destroy(),
				okText: t("common.confirm", { ns: "interface" }),
			})

			routeManageService.navigateToState({
				workspaceId: null,
				projectId: null,
				topicId: null,
			})
		}
	})

	return {
		handleNoPermissionCollaborationProject,
	}
}

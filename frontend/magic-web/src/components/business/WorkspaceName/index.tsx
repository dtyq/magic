import { memo } from "react"
import { useTranslation } from "react-i18next"

function WorkspaceName({ name }: { name: string }) {
	const { t } = useTranslation("super")

	return name || t("workspace.unnamedWorkspace")
}

export default memo(WorkspaceName)

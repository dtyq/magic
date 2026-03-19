import { memo } from "react"
import { useTranslation } from "react-i18next"

function ProjectName({ name }: { name: string }) {
	const { t } = useTranslation("super")

	return name || t("project.unnamedProject")
}

export default memo(ProjectName)

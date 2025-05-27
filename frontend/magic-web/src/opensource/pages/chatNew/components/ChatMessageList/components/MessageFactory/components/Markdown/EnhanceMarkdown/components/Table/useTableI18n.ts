import { useTranslation } from "react-i18next"

export function useTableI18n() {
	const { t } = useTranslation("interface")

	return {
		showMore: t("markdownTable.showMore"),
		rowDetails: t("markdownTable.rowDetails"),
		clickToExpand: t("markdownTable.clickToExpand"),
		showAllColumns: t("markdownTable.showAllColumns"),
		hideAllColumns: t("markdownTable.hideAllColumns"),
		defaultColumn: t("markdownTable.defaultColumn"),
	}
}

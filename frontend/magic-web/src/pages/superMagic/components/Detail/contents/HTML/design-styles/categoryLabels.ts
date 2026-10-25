import { useTranslation } from "react-i18next"

export default function DesignStyleCategoryLabel({ category }: { category: string }) {
	const { t } = useTranslation("super")

	switch (category) {
		case "all":
			return t("htmlEditor.designStyle.categories.all")
		case "featured":
			return t("htmlEditor.designStyle.categories.featured")
		case "ai":
			return t("htmlEditor.designStyle.categories.ai")
		case "developer":
			return t("htmlEditor.designStyle.categories.developer")
		case "productivity":
			return t("htmlEditor.designStyle.categories.productivity")
		case "finance":
			return t("htmlEditor.designStyle.categories.finance")
		case "commerce":
			return t("htmlEditor.designStyle.categories.commerce")
		case "media":
			return t("htmlEditor.designStyle.categories.media")
		case "design":
			return t("htmlEditor.designStyle.categories.design")
		case "automotive":
			return t("htmlEditor.designStyle.categories.automotive")
		case "retro":
			return t("htmlEditor.designStyle.categories.retro")
		case "scenario":
			return t("htmlEditor.designStyle.categories.scenario")
		default:
			return t("htmlEditor.designStyle.categories.other")
	}
}

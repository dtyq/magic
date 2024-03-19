import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/opensource/pages/flow/utils/helpers"
import { MessageType } from "../constants"

export default function useMessageMemory() {
	const { t } = useTranslation()
	const getLinkText = useMemoizedFn((type) => {
		switch (type) {
			case MessageType.File:
				return {
					text: {
						label: t("common.fileUrl", { ns: "flow" }),
						placeholder: getExpressionPlaceholder(
							t("common.fileUrlPlaceholder", { ns: "flow" }),
						),
					},
					desc: {
						label: t("common.fileName", { ns: "flow" }),
						placeholder: getExpressionPlaceholder(
							t("common.fileNamePlaceholder", { ns: "flow" }),
						),
					},
				}
			default:
				return {
					text: {
						label: t("common.imageUrl", { ns: "flow" }),
						placeholder: getExpressionPlaceholder(
							t("common.imageUrlPlaceholder", { ns: "flow" }),
						),
					},
					desc: {
						label: t("common.imageDesc", { ns: "flow" }),
						placeholder: getExpressionPlaceholder(
							t("common.imageDescPlaceholder", { ns: "flow" }),
						),
					},
				}
		}
	})

	return {
		getLinkText,
	}
}

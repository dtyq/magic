import { useTranslation } from "react-i18next"

export function useWechatChatTitle(names: string[]): string {
	const { t } = useTranslation("super")
	if (names.length === 2) return t("wechatChat.titlePair", { first: names[0], second: names[1] })
	if (names.length > 2)
		return t("wechatChat.titleGroup", { first: names[0], count: names.length })
	if (names.length) return t("wechatChat.titleSingle", { name: names[0] })
	return t("wechatChat.title")
}

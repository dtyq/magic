import { ThirdPartyPlatformType } from "@/types/bot"
import { IconDingTalkFilled, IconFeiShu, IconWecom } from "@/enhance/tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"

export default function usePlatforms() {
	const { t } = useTranslation()

	const thirdPartyAppMap = useMemo(() => {
		return {
			[ThirdPartyPlatformType.DingTalk]: {
				image: IconDingTalkFilled,
				title: t("common.dingTalk", { ns: "flow" }),
				desc: t("common.dingTalkInnerApp", { ns: "flow" }),
				type: ThirdPartyPlatformType.DingTalk,
				disabled: false,
			},

			[ThirdPartyPlatformType.EnterpriseWeChat]: {
				image: IconWecom,
				title: t("common.enterpriseWeChat", { ns: "flow" }),
				desc: t("common.enterpriseWeChatInnerApp", { ns: "flow" }),
				type: ThirdPartyPlatformType.EnterpriseWeChat,
				disabled: false,
			},

			[ThirdPartyPlatformType.FeiShu]: {
				image: IconFeiShu,
				title: t("common.feiShu", { ns: "flow" }),
				desc: t("common.feiShuInnerApp", { ns: "flow" }),
				type: ThirdPartyPlatformType.FeiShu,
				disabled: false,
			},
		}
	}, [t])

	const thirdPartyPlatformList = useMemo(() => {
		return [
			thirdPartyAppMap[ThirdPartyPlatformType.DingTalk],
			thirdPartyAppMap[ThirdPartyPlatformType.EnterpriseWeChat],
			thirdPartyAppMap[ThirdPartyPlatformType.FeiShu],
		]
	}, [thirdPartyAppMap])

	return {
		thirdPartyAppMap,
		thirdPartyPlatformList,
	}
}

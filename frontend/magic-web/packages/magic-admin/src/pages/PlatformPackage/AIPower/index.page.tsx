import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { Flex, message } from "antd"
import { MagicButton, MagicSwitch } from "@admin-components"
import { useMemoizedFn, useMount, useRequest } from "ahooks"
import { useAdmin } from "@admin/provider/AdminProvider"
import { RouteName } from "@admin/const/routes"
import { useApis } from "@admin/apis"
import { PlatformPackage } from "@admin/types/platformPackage"
import useRights from "@admin/hooks/useRights"
import { PERMISSION_KEY_MAP } from "@admin/const/common"
import ocr from "@admin/assets/logos/ocr.svg"
import webSearch from "@admin/assets/logos/web-search.svg"
import speechRecognition from "@admin/assets/logos/speech-recognition.svg"
import audioFileRecognition from "@admin/assets/logos/audio-file-recognition.svg"
import autoCompletion from "@admin/assets/logos/auto-completion.svg"
import contentSummary from "@admin/assets/logos/content-summary.svg"
import visualUnderstanding from "@admin/assets/logos/visual-understanding.svg"
import smartRename from "@admin/assets/logos/smart-rename.svg"
import aiOptimization from "@admin/assets/logos/ai-optimization.svg"
import PageLoading from "../components/PageLoading"
import { useStyles } from "../components/ServiceProviderList/styles"
import CommonList from "../components/CommonList"

export const AiPowerLogoMap = {
	[PlatformPackage.PowerCode.OCR]: ocr,
	[PlatformPackage.PowerCode.WEB_SEARCH]: webSearch,
	[PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION]: speechRecognition,
	[PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION]: audioFileRecognition,
	[PlatformPackage.PowerCode.AUTO_COMPLETION]: autoCompletion,
	[PlatformPackage.PowerCode.CONTENT_SUMMARY]: contentSummary,
	[PlatformPackage.PowerCode.VISUAL_UNDERSTANDING]: visualUnderstanding,
	[PlatformPackage.PowerCode.SMART_RENAME]: smartRename,
	[PlatformPackage.PowerCode.AI_OPTIMIZATION]: aiOptimization,
}

export const hasLogoMap = Object.keys(AiPowerLogoMap)

function AIPowerPage() {
	const { t } = useTranslation("admin/ai/power")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()

	const { PlatformPackageApi } = useApis()
	const { navigate } = useAdmin()

	const hasEditRight = useRights(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)

	const [data, setData] = useState<PlatformPackage.AiPower[]>([])

	const { run, loading } = useRequest(() => PlatformPackageApi.getAiPowerList(), {
		manual: true,
		onSuccess: (res) => {
			setData(
				res.map((item) => ({
					...item,
					icon: hasLogoMap.includes(item.code as keyof typeof AiPowerLogoMap)
						? AiPowerLogoMap[item.code as keyof typeof AiPowerLogoMap]
						: "",
				})),
			)
		},
	})

	useMount(() => {
		run()
	})

	const onChange = async (checked: boolean, item: PlatformPackage.AiPower) => {
		PlatformPackageApi.updateAiPower({
			code: item.code,
			status: checked ? 1 : 0,
		}).then(() => {
			message.success(tCommon("message.updateSuccess"))
			setData((prev) =>
				prev.map((it) => (it.code === item.code ? { ...it, status: checked ? 1 : 0 } : it)),
			)
		})
	}

	const openDetail = (code: string) => {
		navigate({
			name: RouteName.AdminSystemCapabilityDetail,
			params: { code },
		})
	}

	const leftAction = useMemoizedFn((item: PlatformPackage.AiPower) => {
		return (
			<Flex gap={8} align="center">
				<div className={styles.status}>{tCommon("status")}</div>
				<MagicSwitch
					checked={item.status === 1}
					disabled={!hasEditRight}
					onChange={(checked: boolean) => onChange?.(checked, item)}
				/>
			</Flex>
		)
	})

	const rightAction = useMemoizedFn((item: PlatformPackage.AiPower) => {
		return (
			<MagicButton
				type="link"
				onClick={() => openDetail(item.code)}
				disabled={!hasEditRight}
				className={styles.button}
			>
				{t("powerConfig")}
			</MagicButton>
		)
	})

	const content = useMemo(() => {
		return [
			{
				id: "power",
				title: t("aiPower"),
				data: data ?? [],
			},
		]
	}, [t, data])

	if (loading) return <PageLoading />

	return (
		<CommonList<PlatformPackage.AiPower>
			content={content}
			leftAction={leftAction}
			rightAction={rightAction}
		/>
	)
}

export default AIPowerPage

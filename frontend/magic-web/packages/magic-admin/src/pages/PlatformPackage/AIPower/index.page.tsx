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
import webScrape from "@admin/assets/logos/web-scrape.svg"
import imageSearch from "@admin/assets/logos/image-search.svg"
import speechRecognition from "@admin/assets/logos/speech-recognition.svg"
import audioFileRecognition from "@admin/assets/logos/audio-file-recognition.svg"
import autoCompletion from "@admin/assets/logos/auto-completion.svg"
import contentSummary from "@admin/assets/logos/content-summary.svg"
import visualUnderstanding from "@admin/assets/logos/visual-understanding.svg"
import smartRename from "@admin/assets/logos/smart-rename.svg"
import aiOptimization from "@admin/assets/logos/ai-optimization.svg"
import imageConvertHigh from "@admin/assets/logos/image-convert-high.svg"
import imageRemoveBackground from "@admin/assets/logos/image-remove-background.svg"
import imageEraser from "@admin/assets/logos/image-eraser.svg"
import imageExpand from "@admin/assets/logos/image-expand.svg"
import weatherForecast from "@admin/assets/logos/weather-forecast.svg"
import superMagicDeepWrite from "@admin/assets/logos/super-magic-deep-write.svg"
import superMagicPurify from "@admin/assets/logos/super-magic-purify.svg"
import superMagicSmartFilename from "@admin/assets/logos/super-magic-smart-filename.svg"
import superMagicCompact from "@admin/assets/logos/super-magic-compact.svg"
import superMagicAnalysisAudio from "@admin/assets/logos/super-magic-analysis-audio.svg"
import videoUnderstanding from "@admin/assets/logos/video-understanding.svg"
import followUpQuestions from "@admin/assets/logos/follow-up-questions.svg"
import knowledgeBaseEmbeddingModel from "@admin/assets/logos/knowledge-base-embedding-model.svg"
import knowledgeBaseVisualUnderstanding from "@admin/assets/logos/knowledge-base-visual-understanding.svg"
import volcengineIcon from "@admin/assets/services/Volcengine.png"
import PageLoading from "../components/PageLoading"
import { useStyles } from "../components/ServiceProviderList/styles"
import CommonList from "../components/CommonList"
import { stripSuperMagicBrand } from "./displayName"

export const AiPowerLogoMap = {
	[PlatformPackage.PowerCode.OCR]: ocr,
	[PlatformPackage.PowerCode.WEB_SEARCH]: webSearch,
	[PlatformPackage.PowerCode.AI_SEARCH_MODEL]: webSearch,
	[PlatformPackage.PowerCode.WEB_SCRAPE]: webScrape,
	[PlatformPackage.PowerCode.IMAGE_SEARCH]: imageSearch,
	[PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION]: speechRecognition,
	[PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION]: audioFileRecognition,
	[PlatformPackage.PowerCode.AUTO_COMPLETION]: autoCompletion,
	[PlatformPackage.PowerCode.CONTENT_SUMMARY]: contentSummary,
	[PlatformPackage.PowerCode.VISUAL_UNDERSTANDING]: visualUnderstanding,
	[PlatformPackage.PowerCode.SMART_RENAME]: smartRename,
	[PlatformPackage.PowerCode.AI_OPTIMIZATION]: aiOptimization,
	[PlatformPackage.PowerCode.IMAGE_CONVERT_HIGH]: imageConvertHigh,
	[PlatformPackage.PowerCode.VOLCENGINE_ARK_ASSETS]: volcengineIcon,
	[PlatformPackage.PowerCode.IMAGE_REMOVE_BACKGROUND]: imageRemoveBackground,
	[PlatformPackage.PowerCode.IMAGE_ERASER]: imageEraser,
	[PlatformPackage.PowerCode.IMAGE_EXPAND]: imageExpand,
	[PlatformPackage.PowerCode.WEATHER_FORECAST]: weatherForecast,
	[PlatformPackage.PowerCode.KNOWLEDGE_BASE_EMBEDDING_MODEL]: knowledgeBaseEmbeddingModel,
	[PlatformPackage.PowerCode.KNOWLEDGE_BASE_VISUAL_UNDERSTANDING]:
		knowledgeBaseVisualUnderstanding,
	[PlatformPackage.PowerCode.FOLLOW_UP_QUESTIONS]: followUpQuestions,
	[PlatformPackage.PowerCode.VIDEO_UNDERSTANDING]: videoUnderstanding,
	[PlatformPackage.PowerCode.SUPER_MAGIC_DEEP_WRITE]: superMagicDeepWrite,
	[PlatformPackage.PowerCode.SUPER_MAGIC_PURIFY]: superMagicPurify,
	[PlatformPackage.PowerCode.SUPER_MAGIC_SMART_FILENAME]: superMagicSmartFilename,
	[PlatformPackage.PowerCode.SUPER_MAGIC_COMPACT]: superMagicCompact,
	[PlatformPackage.PowerCode.SUPER_MAGIC_ANALYSIS_AUDIO]: superMagicAnalysisAudio,
	[PlatformPackage.PowerCode.IMAGE_PROMPT_COMPLETION]: autoCompletion,
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
					name: stripSuperMagicBrand(item.name),
					description: stripSuperMagicBrand(item.description),
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

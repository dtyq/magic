import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { shuffle } from "lodash-es"
import { SupportLocales } from "@/opensource/constants/locale"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { observer } from "mobx-react-lite"
import RotatingText from "./RotatingText"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import { isPrivateDeployment } from "@/opensource/utils/env"
import MagicRoleAnimation from "./components/MagicRoleAnimation"

const DEFAULT_LOGO_HEIGHT = 100

function Slogan() {
	const { t, i18n } = useTranslation("super")

	const globalConfig = globalConfigStore.globalConfig

	const [rotatingTextTexts, setRotatingTextTexts] = useState<string[]>([])

	useEffect(() => {
		const texts = t("ui.slogan.rotatingText.texts", { returnObjects: true }) as string[]
		setRotatingTextTexts(shuffle(texts))
	}, [t])

	return (
		<div className="flex w-full flex-col items-center gap-4 pb-8 pt-6">
			{isPrivateDeployment() ? (
				globalConfig?.minimal_logo && (
					<div className="flex w-full items-center justify-center">
						<img
							fetchPriority="high"
							className="h-[100px] w-auto"
							src={getAvatarUrl(globalConfig.minimal_logo, DEFAULT_LOGO_HEIGHT)}
							alt={globalConfig.name_i18n?.[i18n.language as SupportLocales]}
							draggable={false}
						/>
					</div>
				)
			) : (
				<MagicRoleAnimation />
			)}
			<div className="flex justify-center">
				<RotatingText
					prefix={t("ui.slogan.rotatingText.prefix")}
					texts={rotatingTextTexts}
					interval={3000}
					staggerDelay={0.03}
					autoPlay
				/>
			</div>
		</div>
	)
}

export default observer(Slogan)

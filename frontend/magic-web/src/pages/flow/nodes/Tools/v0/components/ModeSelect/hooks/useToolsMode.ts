/**
 * 模式相关的数据
 */

import { useMemo } from "react"
import LLMCallImage from "@/assets/logos/llm-call.png"
import ArgsCallImage from "@/assets/logos/agrs-call.png"
import { useTranslation } from "react-i18next"
import { ToolsMode } from "../ModeSelect"

export default function useToolsMode() {
	const { t } = useTranslation()
	const modeOptions = useMemo(() => {
		return [
			{
				title: t("tools.bigModelMode", { ns: "flow" }),
				desc: t("tools.bigModelModeDesc", { ns: "flow" }),
				img: LLMCallImage,
				key: ToolsMode.LLM,
			},
			{
				title: t("tools.argsMode", { ns: "flow" }),
				desc: t("tools.argsModeDesc", { ns: "flow" }),
				img: ArgsCallImage,
				key: ToolsMode.Parameter,
			},
		]
	}, [t])

	return {
		modeOptions,
	}
}

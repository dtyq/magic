import { observer } from "mobx-react-lite"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import type { StrategyConfig } from "../../store"

export interface StrategyConfigSectionProps {
	config: StrategyConfig
	onConfigChange: (config: Partial<StrategyConfig>) => void
}

/**
 * 策略配置区域组件
 * 可被Local Documents、Project、Wiki复用
 * 完整实现参考StrategyConfigStep
 */
export const StrategyConfigSection = observer(function StrategyConfigSection({
	config,
	onConfigChange,
}: StrategyConfigSectionProps) {
	const { t } = useTranslation("crew/create")

	// 导入StrategyConfigStep的完整实现
	// 这里暂时只提供接口,具体实现需要将StrategyConfigStep的内容提取到这里

	return (
		<div className="flex flex-col gap-4">
			{/* TODO: 将StrategyConfigStep的策略配置表单内容移到这里 */}
			<div className="text-sm text-muted-foreground">
				{t("documentCreate.strategy.title")}
			</div>
		</div>
	)
})

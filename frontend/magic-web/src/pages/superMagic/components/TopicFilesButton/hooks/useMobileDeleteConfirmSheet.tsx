import MagicPopup from "@/components/base-mobile/MagicPopup"
import { useMemoizedFn } from "ahooks"
import { Check, X } from "lucide-react"
import { ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

interface MobileDeleteConfirmConfig {
	title: string
	emphasisText: ReactNode
	descriptionText: ReactNode
	onConfirm: () => void | Promise<void>
	confirmAriaLabel?: string
	cancelAriaLabel?: string
	testIdPrefix?: string
}

/**
 * 统一承载移动端危险删除确认层，避免文件/项目等场景继续各自维护一套删除样式。
 */
export function useMobileDeleteConfirmSheet() {
	const { t } = useTranslation("super")
	const [config, setConfig] = useState<MobileDeleteConfirmConfig | null>(null)

	/**
	 * 打开删除确认层，并把当前删除对象的文案与回调收敛到同一份状态里。
	 */
	const openDeleteConfirm = useMemoizedFn((nextConfig: MobileDeleteConfirmConfig) => {
		setConfig(nextConfig)
	})

	/**
	 * 关闭删除确认层时同步清理上下文，避免下一次误复用上一次的文案。
	 */
	const closeDeleteConfirm = useMemoizedFn(() => {
		setConfig(null)
	})

	/**
	 * 仅在用户明确确认后才执行真正删除，执行完再收起确认层。
	 */
	const handleConfirmDelete = useMemoizedFn(async () => {
		if (!config) return
		await config.onConfirm()
		closeDeleteConfirm()
	})

	const deleteConfirmNode = (
		<MagicPopup
			visible={Boolean(config)}
			onClose={closeDeleteConfirm}
			position="bottom"
			title={config?.title || t("topicFiles.contextMenu.deleteTip")}
			headerVariant="actionHeader"
			headerTitle={config?.title}
			headerLeadingAction={{
				icon: <X className="size-[22px] text-foreground" />,
				ariaLabel: config?.cancelAriaLabel || t("common.cancel"),
				onClick: closeDeleteConfirm,
				testId: config?.testIdPrefix ? `${config.testIdPrefix}-cancel` : undefined,
			}}
			headerTrailingAction={{
				icon: <Check className="size-[22px] text-white" strokeWidth={2.5} />,
				ariaLabel: config?.confirmAriaLabel || t("topicFiles.contextMenu.delete"),
				onClick: () => {
					void handleConfirmDelete()
				},
				tone: "destructive",
				testId: config?.testIdPrefix ? `${config.testIdPrefix}-confirm` : undefined,
			}}
			bodyClassName="max-h-[80vh] p-0"
		>
			<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
				{/* 删除态正文统一采用“主体强调 + 后果说明弱化”的排版，和项目删除保持一致。 */}
				<p className="mx-auto max-w-[680px] text-left text-[16px] leading-6">
					<span className="font-semibold text-foreground">{config?.emphasisText}</span>
					<span className="text-muted-foreground"> {config?.descriptionText}</span>
				</p>
			</div>
		</MagicPopup>
	)

	return {
		openDeleteConfirm,
		closeDeleteConfirm,
		deleteConfirmNode,
	}
}

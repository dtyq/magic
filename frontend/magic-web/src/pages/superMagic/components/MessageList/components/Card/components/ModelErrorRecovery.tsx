import { type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { ArrowLeftRight, CircleAlert, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useMessageListContext } from "../../../context"
import ModelSwitch from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch"
import ModelIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/ModelIcon"
import { AddModelStoreProvider } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/components/AddModel/context"
import { ModelHelp } from "@/pages/superMagic/components/ModelHelp"
import type { ModelRecoveryMessage } from "@/pages/superMagic/utils/model-error-recovery"
import type { ErrorRecoveryAction } from "@/types/chat/conversation_message"

export const ModelErrorRecovery = observer(function ModelErrorRecovery({
	message,
	children,
}: {
	message: ModelRecoveryMessage
	children: ReactNode
}) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const { modelErrorRecovery: recovery } = useMessageListContext()
	const available = recovery?.canRecover(message) ?? false
	const failedModel = recovery?.getModel(message.error.subject.model_id)
	// 名称属于失败消息；只用列表查图标和可选状态，不能把后来改名的模型当作当时身份。
	const failedModelName = message.error.subject.model_name || message.error.subject.model_id
	const modelIdentity = {
		model_id: message.error.subject.model_id,
		model_name: failedModelName,
		model_icon: failedModel?.model_icon ?? "",
	}
	const actionViews: Record<ErrorRecoveryAction["type"], ReactNode> = {
		switch_model_and_retry: recovery && (
			<AddModelStoreProvider value={recovery.addModelStore}>
				<ModelSwitch
					size={isMobile ? "mobile" : "default"}
					modelList={recovery.modelList}
					selectedModel={failedModel}
					isLoading={recovery.topicModelStore.isLoading}
					editable={false}
					allowedTabs={["language"]}
					trigger={
						<Button
							variant="default"
							size="sm"
							className="gap-1.5 px-3 text-xs font-medium [@media(pointer:coarse)]:min-h-11"
							disabled={recovery.submitting}
						>
							<ArrowLeftRight size={16} aria-hidden />
							{t("modelRecovery.switch")}
						</Button>
					}
					selection={{
						mode: "confirm",
						getModelState: (model) =>
							model.model_id === message.error.subject.model_id
								? {
										disabled: true,
										label: t("modelRecovery.failedModelLabel"),
										reason: t("modelRecovery.chooseAnotherModel"),
									}
								: undefined,
						confirmText: t("modelRecovery.confirm"),
						canConfirm: (model) =>
							!recovery.submitting &&
							recovery.canRecover(message) &&
							recovery.canUseModel(message, "switch_model_and_retry", model.model_id),
						onConfirm: (model) =>
							recovery.submit(message, "switch_model_and_retry", model.model_id),
						description: (
							<>
								<p>{t("modelRecovery.failedModel", { model: failedModelName })}</p>
								<p>{t("modelRecovery.preference")}</p>
								{recovery.addModelStore.hasLoadedMyModels &&
									!recovery.hasAlternative(message) && (
										<p>{t("modelRecovery.noAlternative")}</p>
									)}
							</>
						),
					}}
				/>
			</AddModelStoreProvider>
		),
		retry: failedModel &&
			recovery &&
			recovery.canUseModel(message, "retry", failedModel.model_id) && (
				<Button
					variant="ghost"
					size="sm"
					className="gap-1.5 px-2.5 text-xs font-normal [@media(pointer:coarse)]:min-h-11"
					disabled={recovery.submitting}
					onClick={() => void recovery.submit(message, "retry", failedModel.model_id)}
				>
					<RotateCw size={16} aria-hidden />
					{t("modelRecovery.retry")}
				</Button>
			),
	}
	const visibleActions = message.error.actions.filter((action) =>
		Boolean(actionViews[action.type]),
	)
	return (
		<div className="inline-flex max-w-full flex-col gap-2 py-1 text-xs leading-5">
			<div className="space-y-1.5">
				<div className="flex min-w-0 items-start gap-2 font-medium">
					<CircleAlert
						size={16}
						className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
						aria-hidden
					/>
					<div className="min-w-0 flex-1">{children}</div>
				</div>
				<div className="flex min-w-0 items-start gap-2 font-normal">
					<span className="shrink-0 text-muted-foreground">
						{t("modelRecovery.modelLabel")}
					</span>
					<span className="flex min-w-0 items-start gap-1.5 text-foreground">
						<ModelIcon
							model={modelIdentity}
							size={16}
							className="mt-0.5 shrink-0 rounded-full object-cover"
						/>
						<span className="min-w-0 break-words">{failedModelName}</span>
					</span>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				{available &&
					visibleActions.map((action) => (
						<div key={action.type}>{actionViews[action.type]}</div>
					))}
				<div className="flex min-h-8 items-center px-2.5">
					<ModelHelp code={message.error.code} />
				</div>
				{recovery?.submitting && (
					<span role="status" className="text-xs text-muted-foreground">
						{t("modelRecovery.submitting")}
					</span>
				)}
			</div>
		</div>
	)
})

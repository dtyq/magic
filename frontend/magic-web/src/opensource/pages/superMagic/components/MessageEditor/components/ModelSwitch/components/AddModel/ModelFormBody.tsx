import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Input } from "@/opensource/components/shadcn-ui/input"
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { MessageSquareText, Image } from "lucide-react"
import { useAddModelStore } from "./context"
import ProviderSelectField from "./ProviderSelectField"
import ModelDeploymentField from "./ModelDeploymentField"
import type { AddModelType } from "./store"

const MODEL_TYPE_ICONS: Record<AddModelType, React.ReactNode> = {
	text: <MessageSquareText size={16} />,
	image: <Image size={16} />,
}

export interface ModelFormBodyProps {
	submitted: boolean
	onModelTypeChange?: (type: AddModelType) => void
}

function FormLabel({ required, children }: { required?: boolean; children: React.ReactNode }) {
	return (
		<div className="mr-[148px] flex h-9 items-center gap-1 text-base font-medium leading-6 text-foreground">
			<span className="whitespace-nowrap">{children}</span>
			{required && <span className="text-destructive">*</span>}
		</div>
	)
}

function ModelFormBody({ submitted, onModelTypeChange }: ModelFormBodyProps) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [providerTouched, setProviderTouched] = useState(false)

	const showProviderError = (submitted || providerTouched) && !store.selectedProviderId

	const handleModelTypeChange = (v: AddModelType) => {
		store.setAddModelType(v)
		onModelTypeChange?.(v)
	}

	return (
		<div
			className="grid grid-cols-[1fr_320px] items-start gap-x-2 gap-y-2.5 p-4"
			data-testid="model-form-body"
		>
			<FormLabel required>{t("messageEditor.addModel.modelType")}</FormLabel>
			<Select
				value={store.addModelType}
				onValueChange={(v) => handleModelTypeChange(v as AddModelType)}
			>
				<SelectTrigger className="h-9 w-full" data-testid="add-model-type-select">
					<SelectValue>
						<div className="flex items-center gap-2">
							{MODEL_TYPE_ICONS[store.addModelType]}
							<span>
								{t(
									`messageEditor.addModel.type${
										store.addModelType.charAt(0).toUpperCase() +
										store.addModelType.slice(1)
									}`,
								)}
							</span>
						</div>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="text" data-testid="add-model-type-text">
						<div className="flex items-center gap-2">
							<MessageSquareText size={16} />
							<span>{t("messageEditor.addModel.typeText")}</span>
						</div>
					</SelectItem>
					<SelectItem value="image" data-testid="add-model-type-image">
						<div className="flex items-center gap-2">
							<Image size={16} />
							<span>{t("messageEditor.addModel.typeImage")}</span>
						</div>
					</SelectItem>
				</SelectContent>
			</Select>

			<FormLabel required>{t("messageEditor.addModel.provider")}</FormLabel>
			<ProviderSelectField
				showError={showProviderError}
				onProviderTouchedChange={() => setProviderTouched(true)}
			/>

			<FormLabel required>{t("messageEditor.addModel.modelDeploymentName")}</FormLabel>
			<div className="flex flex-col gap-2">
				<ModelDeploymentField submitted={submitted} />
				<p className="text-sm leading-5 text-muted-foreground">
					{t("messageEditor.addModel.deploymentNameHint")}
				</p>
			</div>

			<FormLabel>{t("messageEditor.addModel.modelNameLabel")}</FormLabel>
			<div className="flex flex-col gap-2">
				<Input
					className="h-9 text-sm"
					placeholder="e.g., Qwen 3.5"
					value={store.modelName}
					onChange={(e) => store.setModelName(e.target.value)}
					data-testid="add-model-name-input"
				/>
				<p className="text-sm leading-5 text-muted-foreground">
					{t("messageEditor.addModel.modelNameHint")}
				</p>
			</div>
		</div>
	)
}

export default observer(ModelFormBody)

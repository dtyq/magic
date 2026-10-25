import { useTranslation } from "react-i18next"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import type { CapabilityModel } from "@magic-admin-v2/features/platform-system-capabilities/types"

function ModelOption({ model }: { model: CapabilityModel }) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<EntityAvatarRender
				className="size-6"
				fallbackText={model.name || model.model_id}
				name={model.name || model.model_id}
				src={model.icon}
			/>
			<span className="flex min-w-0 flex-col items-start text-left leading-none">
				<span className="block max-w-full truncate leading-5">
					{model.name || model.model_id}
				</span>
				<span className="block max-w-full truncate text-xs leading-4 text-muted-foreground">
					{model.model_id}
				</span>
			</span>
		</span>
	)
}

export function CapabilityModelSelect({
	disabled,
	id,
	loading,
	models,
	onChange,
	value,
}: {
	disabled?: boolean
	id?: string
	loading?: boolean
	models: CapabilityModel[]
	onChange: (value: string) => void
	value: string
}) {
	const { t } = useTranslation()
	const selectedModel = models.find((model) => model.model_id === value)

	return (
		<Select disabled={disabled} onValueChange={onChange} value={value}>
			<SelectTrigger
				className="h-12 w-full items-center py-2 [&>span]:min-w-0 [&>span]:line-clamp-none"
				id={id}
			 data-testid="platform-system-capabilities-select-trigger">
				<SelectValue placeholder={t("systemCapabilities.placeholder.aiModel")} />
			</SelectTrigger>
			<SelectContent className="max-w-[min(520px,calc(100vw-2rem))]" data-testid="platform-system-capabilities-select-content">
				{loading ? (
					<SelectItem disabled value="__loading" data-testid="platform-system-capabilities-option">
						{t("systemCapabilities.model.loading")}
					</SelectItem>
				) : (
					<>
						{value && !selectedModel ? (
							<SelectItem textValue={value} value={value} data-testid="platform-system-capabilities-option">
								{value}
							</SelectItem>
						) : null}
						{models.length ? (
							models.map((model) => (
								<SelectItem
									key={model.id}
									textValue={model.name || model.model_id}
									value={model.model_id}
								 data-testid="platform-system-capabilities-option">
									<ModelOption model={model} />
								</SelectItem>
							))
						) : (
							<SelectItem disabled value="__empty" data-testid="platform-system-capabilities-option">
								{t("systemCapabilities.model.noResults")}
							</SelectItem>
						)}
					</>
				)}
			</SelectContent>
		</Select>
	)
}

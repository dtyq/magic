import type { ReactNode } from "react"
import { Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/shadcn-ui/native-select"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { cn } from "@/utils/cn"
import type { PersonaFormField, PersonaFormValues } from "../../services/personaRules"
import type { QualitativeLevel } from "../../types"
import type { PersonaFormSectionKey } from "./usePersonaForm"

interface SectionProps {
	values: PersonaFormValues
	missing: PersonaFormField[]
	setField: <K extends PersonaFormField>(field: K, value: PersonaFormValues[K]) => void
}

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"]
const MAX_PAINS = 5
const MAX_FACTORS = 5

/** Body of one collapsible form section. */
export default function PersonaFormSection({
	section,
	...props
}: SectionProps & { section: PersonaFormSectionKey }) {
	if (section === "basic") return <BasicSection {...props} />
	if (section === "needs") return <NeedsSection {...props} />
	if (section === "mind") return <MindSection {...props} />
	return <VoiceSection {...props} />
}

function BasicSection({ values, missing, setField }: SectionProps) {
	const { t } = useTranslation("personaResearch")
	const isMissing = (field: PersonaFormField) => missing.includes(field)
	// An AI persona may carry an exact age such as "52"; keep it selectable when editing.
	const ageOptions =
		values.age && !AGE_RANGES.includes(values.age) ? [values.age, ...AGE_RANGES] : AGE_RANGES
	const cityTiers = [
		t("form.cityTierOption.tier1"),
		t("form.cityTierOption.newTier1"),
		t("form.cityTierOption.tier2"),
		t("form.cityTierOption.tier3"),
		t("form.cityTierOption.tier4"),
	]
	const incomes = [
		t("form.incomeOption.low"),
		t("form.incomeOption.middle"),
		t("form.incomeOption.upperMiddle"),
		t("form.incomeOption.high"),
	]
	return (
		<div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
			<FormField
				label={t("form.name")}
				required
				error={isMissing("name") ? t("form.required") : undefined}
				hint={t("form.nameHint")}
			>
				<Input
					data-field="name"
					value={values.name}
					maxLength={40}
					placeholder={t("form.namePlaceholder")}
					aria-invalid={isMissing("name")}
					onChange={(event) => setField("name", event.target.value)}
				/>
			</FormField>
			<FormField
				label={t("form.age")}
				required
				error={isMissing("age") ? t("form.requiredSelect") : undefined}
			>
				<SelectField
					field="age"
					value={values.age}
					placeholder={t("form.agePlaceholder")}
					invalid={isMissing("age")}
					options={ageOptions.map((value) => ({
						value,
						label: value === "55+" ? t("form.ageOver55") : value,
					}))}
					onChange={(value) => setField("age", value)}
				/>
			</FormField>
			<FormField
				className="sm:col-span-2"
				label={t("form.tagline")}
				required
				error={isMissing("tagline") ? t("form.required") : undefined}
			>
				<Input
					data-field="tagline"
					value={values.tagline}
					maxLength={80}
					placeholder={t("form.taglinePlaceholder")}
					aria-invalid={isMissing("tagline")}
					onChange={(event) => setField("tagline", event.target.value)}
				/>
			</FormField>
			<FormField
				label={t("form.occupation")}
				required
				error={isMissing("occupation") ? t("form.required") : undefined}
			>
				<Input
					data-field="occupation"
					value={values.occupation}
					placeholder={t("form.occupationPlaceholder")}
					aria-invalid={isMissing("occupation")}
					onChange={(event) => setField("occupation", event.target.value)}
				/>
			</FormField>
			<FormField label={t("form.gender")}>
				<Segmented
					value={values.gender}
					options={[
						{ value: "female", label: t("form.female") },
						{ value: "male", label: t("form.male") },
					]}
					onChange={(value) => setField("gender", value)}
				/>
			</FormField>
			<FormField label={t("form.cityTier")}>
				<SelectField
					field="cityTier"
					value={values.cityTier}
					placeholder={t("form.select")}
					options={withCurrent(values.cityTier, cityTiers)}
					onChange={(value) => setField("cityTier", value)}
				/>
			</FormField>
			<FormField label={t("form.region")}>
				<Input
					value={values.region}
					placeholder={t("form.regionPlaceholder")}
					onChange={(event) => setField("region", event.target.value)}
				/>
			</FormField>
			<FormField label={t("form.income")}>
				<SelectField
					field="income"
					value={values.income}
					placeholder={t("form.select")}
					options={withCurrent(values.income, incomes)}
					onChange={(value) => setField("income", value)}
				/>
			</FormField>
			<FormField label={t("form.tags")}>
				<Input
					value={values.tags}
					placeholder={t("form.tagsPlaceholder")}
					onChange={(event) => setField("tags", event.target.value)}
				/>
			</FormField>
		</div>
	)
}

function NeedsSection({ values, missing, setField }: SectionProps) {
	const { t } = useTranslation("personaResearch")
	const painsMissing = missing.includes("pains")
	const techOptions = [
		t("form.techOption.innovator"),
		t("form.techOption.early"),
		t("form.techOption.majority"),
		t("form.techOption.laggard"),
	]
	const updatePain = (index: number, text: string) =>
		setField(
			"pains",
			values.pains.map((item, current) => (current === index ? text : item)),
		)
	return (
		<div className="flex flex-col gap-3.5">
			<FormField
				label={t("form.pains")}
				required
				error={painsMissing ? t("form.requiredPain") : undefined}
			>
				<div className="flex flex-col gap-1.5">
					{values.pains.map((pain, index) => (
						<div key={index} className="flex items-center gap-1.5">
							<Input
								data-field={index === 0 ? "pains" : undefined}
								value={pain}
								placeholder={
									index === 0 ? t("form.painPlaceholder") : t("form.painMore")
								}
								aria-invalid={painsMissing && index === 0}
								onChange={(event) => updatePain(index, event.target.value)}
							/>
							{values.pains.length > 1 ? (
								<RemoveButton
									label={t("form.removeItem")}
									onClick={() =>
										setField(
											"pains",
											values.pains.filter((_, current) => current !== index),
										)
									}
								/>
							) : null}
						</div>
					))}
				</div>
				{values.pains.length < MAX_PAINS ? (
					<AddButton
						label={t("form.addPain")}
						onClick={() => setField("pains", [...values.pains, ""])}
					/>
				) : null}
			</FormField>
			<FormField
				label={t("form.story")}
				required
				error={missing.includes("story") ? t("form.required") : undefined}
			>
				<Textarea
					data-field="story"
					rows={3}
					value={values.story}
					placeholder={t("form.storyPlaceholder")}
					aria-invalid={missing.includes("story")}
					className="min-h-20 resize-none"
					onChange={(event) => setField("story", event.target.value)}
				/>
			</FormField>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<FormField label={t("form.purchaseChannel")}>
					<Input
						value={values.purchaseChannel}
						placeholder={t("form.purchaseChannelPlaceholder")}
						onChange={(event) => setField("purchaseChannel", event.target.value)}
					/>
				</FormField>
				<FormField label={t("form.device")}>
					<Input
						value={values.device}
						placeholder={t("form.devicePlaceholder")}
						onChange={(event) => setField("device", event.target.value)}
					/>
				</FormField>
			</div>
			<FormField label={t("form.techAdoption")}>
				<Segmented
					value={values.techAdoption}
					options={techOptions.map((label) => ({ value: label, label }))}
					onChange={(value) => setField("techAdoption", value)}
				/>
			</FormField>
		</div>
	)
}

function MindSection({ values, setField }: SectionProps) {
	const { t } = useTranslation("personaResearch")
	const riskOptions = [
		t("form.riskOption.cautious"),
		t("form.riskOption.moderate"),
		t("form.riskOption.bold"),
	]
	return (
		<div className="flex flex-col gap-3.5">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<FormField label={t("form.values")}>
					<Input
						value={values.values}
						placeholder={t("form.valuesPlaceholder")}
						onChange={(event) => setField("values", event.target.value)}
					/>
				</FormField>
				<FormField label={t("form.riskAttitude")}>
					<Segmented
						value={values.riskAttitude}
						options={riskOptions.map((label) => ({ value: label, label }))}
						onChange={(value) => setField("riskAttitude", value)}
					/>
				</FormField>
			</div>
			<FormField label={t("form.social")}>
				<Input
					value={values.social}
					placeholder={t("form.socialPlaceholder")}
					onChange={(event) => setField("social", event.target.value)}
				/>
			</FormField>
		</div>
	)
}

function VoiceSection({ values, setField }: SectionProps) {
	const { t } = useTranslation("personaResearch")
	const levels: { value: QualitativeLevel; label: string }[] = [
		{ value: "high", label: t("level.high") },
		{ value: "medium", label: t("level.medium") },
		{ value: "low", label: t("level.low") },
	]
	const weights = values.decisionWeights
	const updateWeight = (index: number, patch: Partial<(typeof weights)[number]>) =>
		setField(
			"decisionWeights",
			weights.map((item, current) => (current === index ? { ...item, ...patch } : item)),
		)
	return (
		<div className="flex flex-col gap-3.5">
			<FormField label={t("form.expression")}>
				<Textarea
					rows={2}
					value={values.expression}
					placeholder={t("form.expressionPlaceholder")}
					className="min-h-16 resize-none"
					onChange={(event) => setField("expression", event.target.value)}
				/>
			</FormField>
			<FormField label={t("form.decisionWeights")} hint={t("form.weightsHint")}>
				<div className="flex flex-col gap-1.5">
					{weights.map((weight, index) => (
						<div key={index} className="flex items-center gap-2">
							<Input
								value={weight.factor}
								placeholder={t("form.factorPlaceholder")}
								onChange={(event) =>
									updateWeight(index, { factor: event.target.value })
								}
							/>
							{/* One row at any width: the level control never wraps or shrinks. */}
							<Segmented
								value={weight.level}
								options={levels}
								onChange={(value) =>
									updateWeight(index, { level: value as QualitativeLevel })
								}
								allowClear={false}
								className="h-9 shrink-0 flex-nowrap items-center"
							/>
							{weights.length > 1 ? (
								<RemoveButton
									label={t("form.removeItem")}
									onClick={() =>
										setField(
											"decisionWeights",
											weights.filter((_, current) => current !== index),
										)
									}
								/>
							) : null}
						</div>
					))}
				</div>
				{weights.length < MAX_FACTORS ? (
					<AddButton
						label={t("form.addFactor")}
						onClick={() =>
							setField("decisionWeights", [
								...weights,
								{ factor: "", level: "medium" },
							])
						}
					/>
				) : null}
			</FormField>
			<FormField label={t("form.actions")}>
				<Textarea
					rows={2}
					value={values.actions}
					placeholder={t("form.actionsPlaceholder")}
					className="min-h-16 resize-none"
					onChange={(event) => setField("actions", event.target.value)}
				/>
			</FormField>
			<FormField label={t("form.consistency")}>
				<Textarea
					rows={2}
					value={values.consistencyNotes}
					placeholder={t("form.consistencyPlaceholder")}
					className="min-h-16 resize-none"
					onChange={(event) => setField("consistencyNotes", event.target.value)}
				/>
			</FormField>
		</div>
	)
}

function FormField({
	label,
	required = false,
	error,
	hint,
	className,
	children,
}: {
	label: string
	required?: boolean
	error?: string
	hint?: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<span className="flex items-center gap-0.5 text-xs font-medium text-foreground/80">
				{label}
				{required ? <span className="text-destructive">*</span> : null}
			</span>
			{children}
			{error ? (
				<span className="text-[11px] leading-4 text-destructive">{error}</span>
			) : hint ? (
				<span className="text-[11px] leading-4 text-muted-foreground">{hint}</span>
			) : null}
		</div>
	)
}

function SelectField({
	field,
	value,
	placeholder,
	options,
	invalid = false,
	onChange,
}: {
	field: string
	value: string
	placeholder: string
	options: { value: string; label: string }[]
	invalid?: boolean
	onChange: (value: string) => void
}) {
	return (
		<NativeSelect
			data-field={field}
			value={value}
			aria-invalid={invalid}
			className={cn("w-full", !value && "text-muted-foreground")}
			onChange={(event) => onChange(event.target.value)}
		>
			<NativeSelectOption value="">{placeholder}</NativeSelectOption>
			{options.map((option) => (
				<NativeSelectOption key={option.value} value={option.value}>
					{option.label}
				</NativeSelectOption>
			))}
		</NativeSelect>
	)
}

/** Keeps a value written elsewhere (e.g. by the agent) selectable next to the preset options. */
function withCurrent(current: string, presets: string[]) {
	const list = current && !presets.includes(current) ? [current, ...presets] : presets
	return list.map((value) => ({ value, label: value }))
}

/** Single choice as a compact segmented control; clicking the active option clears it. */
function Segmented({
	value,
	options,
	onChange,
	allowClear = true,
	className,
}: {
	value: string
	options: { value: string; label: string }[]
	onChange: (value: string) => void
	allowClear?: boolean
	className?: string
}) {
	return (
		<div
			className={cn(
				"inline-flex w-fit max-w-full flex-wrap rounded-lg bg-muted p-[3px] text-xs",
				className,
			)}
		>
			{options.map((option) => {
				const active = value === option.value
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(active && allowClear ? "" : option.value)}
						className={cn(
							"whitespace-nowrap rounded-md px-2.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
							active
								? "bg-background font-medium text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex w-fit items-center gap-1 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
		>
			<Plus className="size-3.5" />
			{label}
		</button>
	)
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
		>
			<X className="size-3.5" />
		</button>
	)
}

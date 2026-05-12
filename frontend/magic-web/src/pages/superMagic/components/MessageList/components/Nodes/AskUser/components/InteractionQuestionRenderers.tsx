import type { ReactNode } from "react"
import type { TFunction } from "i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { cn } from "@/lib/utils"
import {
	ASK_USER_CONFIRM_VALUE,
	ASK_USER_INTERACTION_TYPE,
	type AskUserConfirmValue,
} from "@/pages/superMagic/components/MessageList/utils/askUserConstants"
import {
	type AskUserPendingAction,
	type AskUserQuestionData,
	isAskUserOtherOption,
} from "@/pages/superMagic/components/MessageList/utils/askUser"

const askUserOptionControlBase =
	"size-4 shrink-0 border border-input bg-background shadow-xs focus-visible:ring-1 focus-visible:ring-ring/50"

const askUserPillInputClass =
	"h-6 min-w-0 flex-1 rounded-full !border-0 bg-background px-2.5 text-left text-[13px] font-normal leading-4 text-foreground !shadow-none placeholder:text-[13px] placeholder:text-muted-foreground focus-visible:!border-transparent focus-visible:!ring-0 md:h-6 md:text-[13px]"

const askUserBreakTextClass = "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"

interface AskUserQuestionRendererProps {
	getInputValue: (subId: string) => string
	getOtherText: (subId: string) => string
	getSelectedOptions: (subId: string) => string[]
	getSelectedValue: (subId: string) => string
	handleConfirmSelect: (subId: string, value: AskUserConfirmValue) => void
	handleToggleOption: (params: {
		question: AskUserQuestionData
		option: string
		checked: boolean
	}) => void
	pendingAction: AskUserPendingAction
	question: AskUserQuestionData
	renderQuestionDefaultHint: (question: AskUserQuestionData) => ReactNode
	setInputValue: (subId: string, value: string) => void
	setOtherText: (subId: string, value: string) => void
	setSelectedValue: (subId: string, value: string) => void
	shouldDisableInteraction: boolean
	t: TFunction<"super", undefined>
}

function ConfirmQuestionRenderer(props: AskUserQuestionRendererProps) {
	const {
		pendingAction,
		question,
		shouldDisableInteraction,
		t,
		getSelectedValue,
		handleConfirmSelect,
	} = props
	const selectedValue = getSelectedValue(question.subId)

	return (
		<div className="space-y-2">
			<div className="flex w-full justify-start">
				<div className="flex flex-wrap gap-3">
					<Button
						type="button"
						variant={
							selectedValue === ASK_USER_CONFIRM_VALUE.yes ? "default" : "outline"
						}
						size="sm"
						disabled={shouldDisableInteraction || pendingAction !== null}
						onClick={() =>
							handleConfirmSelect(question.subId, ASK_USER_CONFIRM_VALUE.yes)
						}
						data-testid={`ask-user-card-confirm-yes-button-${question.subId}`}
						className={cn(
							"h-6 rounded-full border border-border px-3 text-xs font-normal text-foreground shadow-none transition-colors hover:bg-accent hover:text-accent-foreground",
							selectedValue === ASK_USER_CONFIRM_VALUE.yes &&
								"border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:border-primary disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100",
						)}
					>
						{t("askUser.actions.confirm")}
					</Button>
					<Button
						type="button"
						variant={
							selectedValue === ASK_USER_CONFIRM_VALUE.no ? "default" : "outline"
						}
						size="sm"
						disabled={shouldDisableInteraction || pendingAction !== null}
						onClick={() =>
							handleConfirmSelect(question.subId, ASK_USER_CONFIRM_VALUE.no)
						}
						data-testid={`ask-user-card-confirm-no-button-${question.subId}`}
						className={cn(
							"h-6 rounded-full border border-border px-3 text-xs font-normal text-foreground shadow-none transition-colors hover:bg-accent hover:text-accent-foreground",
							selectedValue === ASK_USER_CONFIRM_VALUE.no &&
								"border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:border-primary disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100",
						)}
					>
						{t("askUser.actions.reject")}
					</Button>
				</div>
			</div>
			{props.renderQuestionDefaultHint(question)}
		</div>
	)
}

function InputQuestionRenderer(props: AskUserQuestionRendererProps) {
	const { question, shouldDisableInteraction, t, getInputValue, setInputValue } = props

	return (
		<div className="space-y-2">
			<Textarea
				value={getInputValue(question.subId)}
				onChange={(event) => setInputValue(question.subId, event.target.value)}
				placeholder={question.placeholder || t("askUser.placeholder")}
				disabled={shouldDisableInteraction}
				data-testid={`ask-user-card-input-${question.subId}`}
				className="min-h-16 w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-left text-[13px] font-normal leading-4 text-foreground shadow-none placeholder:text-[13px] placeholder:text-muted-foreground focus-visible:border-border focus-visible:!ring-0 md:text-[13px]"
			/>
			{props.renderQuestionDefaultHint(question)}
		</div>
	)
}

function SelectQuestionRenderer(props: AskUserQuestionRendererProps) {
	const {
		question,
		shouldDisableInteraction,
		t,
		getOtherText,
		getSelectedValue,
		setOtherText,
		setSelectedValue,
	} = props
	const selectedValue = getSelectedValue(question.subId)

	return (
		<div className="space-y-2">
			<RadioGroup
				value={selectedValue}
				onValueChange={(value) => setSelectedValue(question.subId, value)}
				className="gap-0.5"
				data-testid={`ask-user-card-select-group-${question.subId}`}
			>
				{question.options.map((option) => {
					const isOther = isAskUserOtherOption(option)
					return (
						<label
							key={option}
							className="flex h-6 cursor-pointer items-center gap-2"
							data-testid={`ask-user-card-select-option-${question.subId}`}
						>
							<RadioGroupItem
								value={option}
								disabled={shouldDisableInteraction}
								className={cn(
									askUserOptionControlBase,
									"rounded-full text-foreground [&_svg]:fill-primary",
								)}
							/>
							{!isOther && (
								<span
									className={cn(
										"text-xs font-normal leading-4 text-foreground",
										askUserBreakTextClass,
									)}
								>
									{option}
								</span>
							)}
							{isOther && (
								<Input
									type="text"
									value={getOtherText(question.subId)}
									onChange={(event) =>
										setOtherText(question.subId, event.target.value)
									}
									onFocus={() => setSelectedValue(question.subId, option)}
									placeholder={t("askUser.otherPlaceholder")}
									disabled={shouldDisableInteraction}
									data-testid={`ask-user-card-select-other-input-${question.subId}`}
									className={askUserPillInputClass}
								/>
							)}
						</label>
					)
				})}
			</RadioGroup>
			{props.renderQuestionDefaultHint(question)}
		</div>
	)
}

function MultiSelectQuestionRenderer(props: AskUserQuestionRendererProps) {
	const {
		question,
		shouldDisableInteraction,
		t,
		getOtherText,
		getSelectedOptions,
		handleToggleOption,
		setOtherText,
	} = props
	const selectedOptions = getSelectedOptions(question.subId)
	const maxSelectionReached =
		typeof question.maxSelect === "number" && selectedOptions.length >= question.maxSelect

	return (
		<div className="space-y-2">
			<div
				className="space-y-0.5"
				data-testid={`ask-user-card-multi-select-group-${question.subId}`}
			>
				{question.options.map((option) => {
					const isChecked = selectedOptions.includes(option)
					const isOther = isAskUserOtherOption(option)
					return (
						<label
							key={option}
							className="flex h-6 cursor-pointer items-center gap-2"
							data-testid={`ask-user-card-multi-select-option-${question.subId}`}
						>
							<Checkbox
								checked={isChecked}
								onCheckedChange={(checked) =>
									handleToggleOption({
										question,
										option,
										checked: Boolean(checked),
									})
								}
								disabled={
									shouldDisableInteraction || (!isChecked && maxSelectionReached)
								}
								className={cn(
									askUserOptionControlBase,
									"rounded-[4px] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
								)}
							/>
							{!isOther && (
								<span
									className={cn(
										"text-xs font-normal leading-4 text-foreground",
										askUserBreakTextClass,
									)}
								>
									{option}
								</span>
							)}
							{isOther && (
								<Input
									type="text"
									value={getOtherText(question.subId)}
									onChange={(event) =>
										setOtherText(question.subId, event.target.value)
									}
									onFocus={() => {
										if (!isChecked && !maxSelectionReached)
											handleToggleOption({
												question,
												option,
												checked: true,
											})
									}}
									placeholder={t("askUser.otherPlaceholder")}
									disabled={
										shouldDisableInteraction ||
										(!isChecked && maxSelectionReached)
									}
									data-testid={`ask-user-card-multi-select-other-input-${question.subId}`}
									className={askUserPillInputClass}
								/>
							)}
						</label>
					)
				})}
			</div>
			<p
				className="text-xs leading-4 text-muted-foreground"
				data-testid={`ask-user-card-multi-select-hint-${question.subId}`}
			>
				{t("askUser.validation.multiSelectRange", {
					min: question.minSelect,
					max:
						typeof question.maxSelect === "number"
							? question.maxSelect
							: t("askUser.validation.unlimited"),
				})}
			</p>
			{props.renderQuestionDefaultHint(question)}
		</div>
	)
}

const askUserQuestionRendererMap: Record<
	string,
	(props: AskUserQuestionRendererProps) => ReactNode
> = {
	[ASK_USER_INTERACTION_TYPE.confirm]: ConfirmQuestionRenderer,
	[ASK_USER_INTERACTION_TYPE.input]: InputQuestionRenderer,
	[ASK_USER_INTERACTION_TYPE.select]: SelectQuestionRenderer,
	[ASK_USER_INTERACTION_TYPE.multiSelect]: MultiSelectQuestionRenderer,
}

export function renderAskUserPendingQuestion(props: AskUserQuestionRendererProps) {
	const renderer = askUserQuestionRendererMap[props.question.interactionType]
	if (renderer) return renderer(props)
	return MultiSelectQuestionRenderer(props)
}

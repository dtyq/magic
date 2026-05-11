import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "../ui/select"
import { ChevronsUpDown } from "lucide-react"
import styles from "./EditorModelSelect.module.css"

export interface EditorModelSelectOption {
	label: string
	value: string
	model: { model_icon?: string }
}

export interface EditorModelSelectGroup {
	id: string
	label: string
	icon?: string
	options: EditorModelSelectOption[]
}

export interface EditorModelSelectProps {
	selectedModelId: string
	modelOptions: EditorModelSelectOption[]
	modelOptionGroups: EditorModelSelectGroup[]
	selectedModelOption: EditorModelSelectOption | undefined
	onModelChange: (modelId: string) => void
}

export default function EditorModelSelect(props: EditorModelSelectProps) {
	const { selectedModelId, modelOptions, modelOptionGroups, selectedModelOption, onModelChange } =
		props

	const shouldShowModelGroups = modelOptionGroups.length > 1

	if (modelOptions.length === 0 || !selectedModelOption) {
		return null
	}

	return (
		<Select value={selectedModelId} onValueChange={onModelChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<div className={styles.modelOptionItemContent} style={{ maxWidth: 160 }}>
					{selectedModelOption.model.model_icon && (
						<div className={styles.icon}>
							<img
								src={selectedModelOption.model.model_icon}
								alt={selectedModelOption.label}
							/>
						</div>
					)}
					<div className={styles.label}>{selectedModelOption.label}</div>
				</div>
				<ChevronsUpDown size={16} />
			</SelectTrigger>
			<SelectContent className={styles.selectContent}>
				{shouldShowModelGroups
					? modelOptionGroups.map((group) => (
							<SelectGroup key={group.id}>
								<SelectLabel className={styles.selectGroupLabel}>
									<div className={styles.selectGroupLabelContent}>
										{group.icon && (
											<img
												src={group.icon}
												alt={group.label}
												className={styles.selectGroupLabelIcon}
											/>
										)}
										<span>{group.label}</span>
									</div>
								</SelectLabel>
								{group.options.map((option) => (
									<SelectItem
										key={option.value}
										value={option.value}
										className={`${styles.selectOptionItem} ${styles.selectOptionItemIndented}`}
									>
										<div className={styles.modelOptionItemContent}>
											<div className={styles.label}>{option.label}</div>
										</div>
									</SelectItem>
								))}
							</SelectGroup>
						))
					: modelOptions.map((option) => (
							<SelectItem
								key={option.value}
								value={option.value}
								className={styles.selectOptionItem}
							>
								<div className={styles.modelOptionItemContent}>
									{option.model.model_icon && (
										<div className={styles.icon}>
											<img src={option.model.model_icon} alt={option.label} />
										</div>
									)}
									<div className={styles.label}>{option.label}</div>
								</div>
							</SelectItem>
						))}
			</SelectContent>
		</Select>
	)
}

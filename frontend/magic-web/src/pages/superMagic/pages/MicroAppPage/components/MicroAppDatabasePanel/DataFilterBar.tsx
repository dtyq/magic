import { ListFilter, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
	MagicBaseColumn,
	MagicBaseFilterGroup,
	MagicBaseFilterLogic,
	MagicBaseFilterOperator,
} from "@/apis/modules/magicBase"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { cn } from "@/utils/cn"

import {
	type DraftFilterCondition,
	getDefaultFilterOperator,
	getFilterableColumns,
	getFilterConditionLimit,
	getFilterOperators,
	getRootFilterConditions,
	isSystemFilterColumn,
	isValidDraftFilterCondition,
	MAX_OR_FILTER_CONDITIONS,
	toDraftFilterValue,
	toFilterCondition,
} from "./dataFilterRules"
import { createEmptyMagicBaseFilter, getMagicBaseFilterConditionCount } from "./utils"
import useFilterOperatorLabel from "./useFilterOperatorLabel"
import useMagicBaseColumnLabel from "./useMagicBaseColumnLabel"

interface DataFilterProps {
	columns: MagicBaseColumn[]
	value: MagicBaseFilterGroup
	onChange: (filter: MagicBaseFilterGroup) => void
}

function FilterValueInput({
	column,
	condition,
	onChange,
	onEnter,
}: {
	column?: MagicBaseColumn
	condition: DraftFilterCondition
	onChange: (value: string) => void
	onEnter: () => void
}) {
	const { t } = useTranslation("super")
	if (column?.data_type === "boolean" && condition.operator !== "in") {
		return (
			<Select value={condition.value || undefined} onValueChange={onChange}>
				<SelectTrigger
					size="sm"
					className="h-8 w-full min-w-0 bg-background"
					aria-label={t("microAppPage.databasePanel.filterValue")}
				>
					<SelectValue placeholder={t("microAppPage.databasePanel.filterValue")} />
				</SelectTrigger>
				<SelectContent align="start">
					<SelectItem value="true">{t("microAppPage.databasePanel.yes")}</SelectItem>
					<SelectItem value="false">{t("microAppPage.databasePanel.no")}</SelectItem>
				</SelectContent>
			</Select>
		)
	}

	const isList = condition.operator === "in"
	return (
		<Input
			type={
				isList
					? "text"
					: column?.data_type === "number"
						? "number"
						: column?.data_type === "datetime"
							? "datetime-local"
							: "text"
			}
			value={condition.value}
			step={column?.data_type === "datetime" ? 1 : undefined}
			className="h-8 min-w-0"
			placeholder={
				isList
					? t("microAppPage.databasePanel.filterListValuePlaceholder")
					: t("microAppPage.databasePanel.filterValuePlaceholder")
			}
			aria-label={t("microAppPage.databasePanel.filterValue")}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === "Enter") onEnter()
			}}
		/>
	)
}

export default function DataFilterBar({ columns, value, onChange }: DataFilterProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [draftLogic, setDraftLogic] = useState<MagicBaseFilterLogic>("and")
	const [draftConditions, setDraftConditions] = useState<DraftFilterCondition[]>([])
	const filterableColumns = useMemo(() => getFilterableColumns(columns), [columns])
	const dynamicFilterColumns = filterableColumns.filter((column) => !isSystemFilterColumn(column))
	const systemFilterColumns = filterableColumns.filter(isSystemFilterColumn)
	const conditionCount = getMagicBaseFilterConditionCount(value)
	const getOperatorLabel = useFilterOperatorLabel()
	const getColumnLabel = useMagicBaseColumnLabel()

	const createDraftConditions = () => {
		const conditions = getRootFilterConditions(value).flatMap((condition) => {
			const column = filterableColumns.find((item) => item.column_key === condition.field)
			return column
				? [
						{
							field: condition.field,
							operator: condition.operator,
							value: toDraftFilterValue(column, condition),
						},
					]
				: []
		})
		if (conditions.length > 0 || filterableColumns.length === 0) return conditions
		const column = filterableColumns[0]
		return [{ field: column.column_key, operator: getDefaultFilterOperator(column), value: "" }]
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			// Draft state prevents incomplete conditions from changing the active row query.
			setDraftLogic(value.logic)
			setDraftConditions(createDraftConditions())
		}
		setOpen(nextOpen)
	}

	const updateDraftCondition = (index: number, patch: Partial<DraftFilterCondition>) => {
		setDraftConditions((current) =>
			current.map((condition, currentIndex) =>
				currentIndex === index ? { ...condition, ...patch } : condition,
			),
		)
	}

	const handleAddCondition = () => {
		const column = filterableColumns[0]
		if (!column || draftConditions.length >= getFilterConditionLimit(draftLogic)) return
		setDraftConditions((current) => [
			...current,
			{ field: column.column_key, operator: getDefaultFilterOperator(column), value: "" },
		])
	}

	const allConditionsValid =
		draftConditions.length > 0 &&
		draftConditions.length <= getFilterConditionLimit(draftLogic) &&
		draftConditions.every((condition) =>
			isValidDraftFilterCondition(condition, filterableColumns),
		)

	const handleApply = () => {
		if (!allConditionsValid) return
		const items = draftConditions.flatMap((condition) => {
			const column = filterableColumns.find((item) => item.column_key === condition.field)
			if (!column) return []
			return [toFilterCondition(column, condition)]
		})
		if (items.length !== draftConditions.length) return
		onChange({ logic: draftLogic, items })
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant={conditionCount > 0 ? "secondary" : "outline"}
					size="sm"
					className="h-8 gap-1.5 bg-background shadow-xs"
					disabled={filterableColumns.length === 0}
					data-testid="magicbase-filter-trigger"
				>
					<ListFilter className="size-4" />
					{conditionCount > 0
						? t("microAppPage.databasePanel.filterCount", { total: conditionCount })
						: t("microAppPage.databasePanel.filterData")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[520px] p-0" sideOffset={8}>
				<div className="border-b border-border/60 px-4 py-3">
					<h4 className="text-sm font-semibold text-foreground">
						{t("microAppPage.databasePanel.filterTitle")}
					</h4>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{t("microAppPage.databasePanel.filterHint")}
					</p>
				</div>

				<div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
					<span className="text-xs text-muted-foreground">
						{t("microAppPage.databasePanel.filterMatchMode")}
					</span>
					<Select
						value={draftLogic}
						onValueChange={(nextValue) =>
							setDraftLogic(nextValue as MagicBaseFilterLogic)
						}
					>
						<SelectTrigger
							size="sm"
							className="h-8 min-w-[220px] bg-background"
							aria-label={t("microAppPage.databasePanel.filterMatchMode")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value="and">
								{t("microAppPage.databasePanel.filterMatchAll")}
							</SelectItem>
							<SelectItem
								value="or"
								disabled={draftConditions.length > MAX_OR_FILTER_CONDITIONS}
							>
								{t("microAppPage.databasePanel.filterMatchAny")}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
					{draftConditions.map((condition, index) => {
						const column = filterableColumns.find(
							(item) => item.column_key === condition.field,
						)
						const operators = getFilterOperators(column)
						return (
							<div
								key={index}
								className="grid grid-cols-[minmax(0,1fr)_112px_minmax(0,1.2fr)_32px] items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2"
							>
								<Select
									value={condition.field}
									onValueChange={(nextValue) => {
										const nextColumn = filterableColumns.find(
											(item) => item.column_key === nextValue,
										)
										updateDraftCondition(index, {
											field: nextValue,
											operator: getDefaultFilterOperator(nextColumn),
											value: "",
										})
									}}
								>
									<SelectTrigger
										size="sm"
										className="h-8 w-full min-w-0 bg-background"
										aria-label={t("microAppPage.databasePanel.filterField")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="start" className="max-h-72">
										{dynamicFilterColumns.length > 0 ? (
											<SelectGroup>
												<SelectLabel>
													{t("microAppPage.databasePanel.schemaField")}
												</SelectLabel>
												{dynamicFilterColumns.map((item) => (
													<SelectItem
														key={item.column_key}
														value={item.column_key}
													>
														{getColumnLabel(item)}
													</SelectItem>
												))}
											</SelectGroup>
										) : null}
										{dynamicFilterColumns.length > 0 &&
										systemFilterColumns.length > 0 ? (
											<SelectSeparator />
										) : null}
										{systemFilterColumns.length > 0 ? (
											<SelectGroup>
												<SelectLabel>
													{t("microAppPage.databasePanel.systemField")}
												</SelectLabel>
												{systemFilterColumns.map((item) => (
													<SelectItem
														key={item.column_key}
														value={item.column_key}
													>
														{getColumnLabel(item)}
													</SelectItem>
												))}
											</SelectGroup>
										) : null}
									</SelectContent>
								</Select>
								<Select
									value={condition.operator}
									onValueChange={(nextValue) =>
										updateDraftCondition(index, {
											operator: nextValue as MagicBaseFilterOperator,
											value: "",
										})
									}
								>
									<SelectTrigger
										size="sm"
										className="h-8 w-full min-w-0 bg-background"
										aria-label={t("microAppPage.databasePanel.filterOperator")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="start">
										{operators.map((operator) => (
											<SelectItem key={operator} value={operator}>
												{getOperatorLabel(operator)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FilterValueInput
									column={column}
									condition={condition}
									onChange={(nextValue) =>
										updateDraftCondition(index, { value: nextValue })
									}
									onEnter={handleApply}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-destructive"
									aria-label={t(
										"microAppPage.databasePanel.removeFilterCondition",
									)}
									onClick={() =>
										setDraftConditions((current) =>
											current.filter(
												(_, currentIndex) => currentIndex !== index,
											),
										)
									}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						)
					})}

					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"h-8 gap-1.5",
							draftConditions.length >= getFilterConditionLimit(draftLogic) &&
								"hidden",
						)}
						onClick={handleAddCondition}
					>
						<Plus className="size-4" />
						{t("microAppPage.databasePanel.addFilterCondition")}
					</Button>
				</div>

				<div className="flex items-center justify-between border-t border-border/60 px-3 py-2.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={conditionCount === 0}
						data-testid="magicbase-clear-filters"
						onClick={() => {
							onChange(createEmptyMagicBaseFilter())
							setOpen(false)
						}}
					>
						{t("microAppPage.databasePanel.clearFilters")}
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={!allConditionsValid}
						onClick={handleApply}
					>
						{t("microAppPage.databasePanel.applyFilters")}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslation } from "react-i18next"
import { Check, Info, UserCircle, BarChart3, Palette, Presentation, FileText } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/opensource/components/shadcn-ui/form"
import type { StepComponentProps, Step3FormData } from "../types"
import { cn } from "@/opensource/lib/utils"

const formSchema = z.object({
	select_official_agents_codes: z.array(z.string()).min(1, "请至少选择一个数字员工"),
})

type FormValues = z.infer<typeof formSchema>

interface Worker {
	id: string
	icon: React.ReactNode
}

const WORKER_CONFIGS: Worker[] = [
	{
		id: "general",
		icon: <UserCircle className="h-6 w-6" />,
	},
	{
		id: "data_analysis",
		icon: <BarChart3 className="h-6 w-6" />,
	},
	{
		id: "design",
		icon: <Palette className="h-6 w-6" />,
	},
	{
		id: "ppt",
		icon: <Presentation className="h-6 w-6" />,
	},
	{
		id: "summary",
		icon: <FileText className="h-6 w-6" />,
	},
]

interface Step3WorkersProps extends StepComponentProps<Step3FormData> {
	submitting?: boolean
}

export default function Step3Workers({
	initialData,
	onComplete,
	onBack,
	submitting = false,
}: Step3WorkersProps) {
	const { t } = useTranslation("initialization")

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			select_official_agents_codes:
				initialData?.select_official_agents_codes ||
				WORKER_CONFIGS.map((worker) => worker.id),
		},
	})

	const selectedWorkers = form.watch("select_official_agents_codes")

	const toggleWorker = (workerId: string) => {
		const current = form.getValues("select_official_agents_codes")
		const newSelection = current.includes(workerId)
			? current.filter((id) => id !== workerId)
			: [...current, workerId]
		form.setValue("select_official_agents_codes", newSelection)
	}

	const onSubmit = (values: FormValues) => {
		onComplete(values as Step3FormData)
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="mb-2 text-2xl font-bold text-foreground">{t("step3.title")}</h2>
				<p className="text-muted-foreground">{t("step3.subtitle")}</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<FormField
						control={form.control}
						name="select_official_agents_codes"
						render={() => (
							<FormItem>
								<FormLabel className="sr-only">
									{t("step3.selectWorkers")}
								</FormLabel>
								<FormControl>
									<div className="space-y-4">
										{WORKER_CONFIGS.map((worker) => {
											const isSelected = selectedWorkers.includes(worker.id)
											const name = t(`step3.workers.${worker.id}.name`)
											const description = t(
												`step3.workers.${worker.id}.description`,
											)
											const tags = t(`step3.workers.${worker.id}.tags`, {
												returnObjects: true,
											}) as string[]

											return (
												<div
													key={worker.id}
													onClick={() => toggleWorker(worker.id)}
													className={cn(
														"cursor-pointer rounded-xl border-2 p-6 transition-all hover:border-foreground hover:shadow-md",
														isSelected
															? "border-foreground bg-accent"
															: "border-border bg-background",
													)}
												>
													<div className="flex items-start gap-4">
														{/* Icon */}
														<div
															className={cn(
																"flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
																isSelected
																	? "bg-foreground text-background"
																	: "bg-muted text-muted-foreground",
															)}
														>
															{worker.icon}
														</div>

														{/* Content */}
														<div className="flex-1">
															<div className="mb-2 flex items-center justify-between">
																<h3 className="text-lg font-bold text-foreground">
																	{name}
																</h3>
																<div
																	className={cn(
																		"flex h-6 w-6 items-center justify-center rounded border-2 transition-all",
																		isSelected
																			? "border-foreground bg-foreground"
																			: "border-border bg-background",
																	)}
																>
																	{isSelected && (
																		<Check className="h-4 w-4 text-background" />
																	)}
																</div>
															</div>
															<p className="mb-3 text-sm text-muted-foreground">
																{description}
															</p>
															<div className="flex flex-wrap gap-2">
																{tags.map((tag) => (
																	<span
																		key={tag}
																		className="rounded-full bg-muted px-3 py-1 text-xs text-foreground"
																	>
																		{tag}
																	</span>
																))}
															</div>
														</div>
													</div>
												</div>
											)
										})}
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Info Box */}
					<div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
						<div className="flex items-start gap-3">
							<Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
							<div className="text-sm text-blue-900 dark:text-blue-100">
								<p className="mb-1 font-semibold">{t("step3.infoTitle")}</p>
								<p>{t("step3.infoDescription")}</p>
							</div>
						</div>
					</div>

					{/* Navigation Buttons */}
					<div className="flex justify-end gap-2 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={onBack}
							disabled={submitting}
						>
							{t("actions.previous")}
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? t("actions.submitting") : t("actions.finish")}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}

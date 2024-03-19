import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/opensource/components/shadcn-ui/form"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Textarea } from "@/opensource/components/shadcn-ui/textarea"
import type { StepComponentProps, Step1FormData } from "../types"

const formSchema = z
	.object({
		name: z.string().min(1, "请输入Agent名称"),
		description: z.string().optional(),
		phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号"),
		password: z
			.string()
			.min(8, "密码至少需要8位")
			.regex(/(?=.*[A-Za-z])(?=.*\d)/, "密码必须包含字母和数字"),
		confirm_password: z.string(),
	})
	.refine((data) => data.password === data.confirm_password, {
		message: "两次输入的密码不一致",
		path: ["confirm_password"],
	})

type FormValues = z.infer<typeof formSchema>

export default function Step1Account({
	initialData,
	onComplete,
}: StepComponentProps<Step1FormData>) {
	const { t } = useTranslation("initialization")
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			phone: initialData?.phone || "",
			password: initialData?.password || "",
			confirm_password: initialData?.password || "",
		},
	})

	const onSubmit = (values: FormValues) => {
		const { confirm_password, ...data } = values
		onComplete(data as Step1FormData)
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="mb-2 text-2xl font-bold text-foreground">{t("step1.title")}</h2>
				<p className="text-muted-foreground">{t("step1.subtitle")}</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					{/* Agent Name */}
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("step1.agentName")}{" "}
									<span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<Input
										placeholder={t("step1.agentNamePlaceholder")}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Agent Description */}
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("step1.agentDescription")}</FormLabel>
								<FormControl>
									<Textarea
										placeholder={t("step1.agentDescriptionPlaceholder")}
										rows={4}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="my-6 h-px bg-border" />

					{/* Admin Phone */}
					<FormField
						control={form.control}
						name="phone"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("step1.adminPhone")}{" "}
									<span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<Input
										placeholder={t("step1.adminPhonePlaceholder")}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Admin Password */}
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("step1.adminPassword")}{" "}
									<span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showPassword ? "text" : "password"}
											placeholder={t("step1.adminPasswordPlaceholder")}
											{...field}
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Confirm Password */}
					<FormField
						control={form.control}
						name="confirm_password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("step1.confirmPassword")}{" "}
									<span className="text-destructive">*</span>
								</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showConfirmPassword ? "text" : "password"}
											placeholder={t("step1.confirmPasswordPlaceholder")}
											{...field}
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() =>
												setShowConfirmPassword(!showConfirmPassword)
											}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{showConfirmPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Submit Button */}
					<div className="flex justify-end pt-4">
						<Button type="submit" size="lg">
							{t("actions.next")}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslation } from "react-i18next"
import { useState, useMemo } from "react"
import {
	Eye,
	EyeOff,
	Loader2,
	Cloud,
	Sparkles,
	Boxes,
	Route,
	CloudCog,
	Flame,
	Search,
	Settings,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shadcn-ui/form"
import { Input } from "@/components/shadcn-ui/input"
import { InitializationApi } from "@/apis"
import type { StepComponentProps, Step2FormData } from "../types"
import { cn } from "@/lib/utils"

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

function createFormSchema(t: (key: string) => string) {
	return z.object({
		provider_code: z.string().optional(),
		model_version: z.string().min(1, t("step2.deploymentNameRequired")),
		service_provider_config: z
			.object({
				url: z.string().optional(),
				api_key: z.string().optional(),
			})
			.catchall(z.string().optional())
			.optional(),
	})
}

interface Provider {
	value: string
	icon: React.ReactNode
}

// Provider 配置
interface ProviderConfig {
	defaultUrl: string
	showApiUrl: boolean
	showApiKey: boolean
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
	OfficialOpenAI: {
		defaultUrl: "https://api.openai.com/v1",
		showApiUrl: false,
		showApiKey: true,
	},
	OpenAI: {
		defaultUrl: "https://api.openai.com/v1",
		showApiUrl: true,
		showApiKey: true,
	},
	MicrosoftAzure: {
		defaultUrl: "https://<your-resource>.openai.azure.com",
		showApiUrl: true,
		showApiKey: true,
	},
	Gemini: {
		defaultUrl: "https://aiplatform.googleapis.com/v1",
		showApiUrl: true,
		showApiKey: true,
	},
	AWSBedrock: {
		defaultUrl: "",
		showApiUrl: false,
		showApiKey: false,
	},
	OpenRouter: {
		defaultUrl: "https://openrouter.ai/api/v1",
		showApiUrl: true,
		showApiKey: true,
	},
	DashScope: {
		defaultUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		showApiUrl: true,
		showApiKey: true,
	},
	Volcengine: {
		defaultUrl: "https://ark.cn-beijing.volces.com/api/v3",
		showApiUrl: true,
		showApiKey: true,
	},
	DeepSeek: {
		defaultUrl: "https://api.deepseek.com",
		showApiUrl: true,
		showApiKey: true,
	},
}

const PROVIDERS: Provider[] = [
	{ value: "OfficialOpenAI", icon: <Settings className="h-5 w-5" /> },
	{ value: "OpenAI", icon: <Settings className="h-5 w-5" /> },
	{ value: "MicrosoftAzure", icon: <Cloud className="h-5 w-5" /> },
	{ value: "Gemini", icon: <Sparkles className="h-5 w-5" /> },
	{ value: "AWSBedrock", icon: <Boxes className="h-5 w-5" /> },
	{ value: "OpenRouter", icon: <Route className="h-5 w-5" /> },
	{ value: "DashScope", icon: <CloudCog className="h-5 w-5" /> },
	{ value: "Volcengine", icon: <Flame className="h-5 w-5" /> },
	{ value: "DeepSeek", icon: <Search className="h-5 w-5" /> },
]

const DEFAULT_PROVIDER = "OfficialOpenAI"

export default function Step2Provider({
	initialData,
	onComplete,
	onBack,
}: StepComponentProps<Step2FormData>) {
	const { t } = useTranslation("initialization")
	const [showApiKey, setShowApiKey] = useState(false)
	const [showAwsAk, setShowAwsAk] = useState(false)
	const [showAwsSk, setShowAwsSk] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

	const formSchema = useMemo(() => createFormSchema(t), [t])

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			provider_code: initialData?.provider_code || DEFAULT_PROVIDER,
			model_version: initialData?.model_version || "",
			service_provider_config: {
				url:
					initialData?.service_provider_config?.url ||
					PROVIDER_CONFIGS[DEFAULT_PROVIDER].defaultUrl,
				api_key: initialData?.service_provider_config?.api_key || "",
				...initialData?.service_provider_config,
			},
		},
	})

	const selectedProvider = form.watch("provider_code")
	const currentConfig = PROVIDER_CONFIGS[selectedProvider || DEFAULT_PROVIDER]

	// 当切换 provider 时，始终重置为对应服务商的默认 URL
	const handleProviderChange = (providerValue: string) => {
		form.setValue("provider_code", providerValue)
		const config = PROVIDER_CONFIGS[providerValue]

		// 切换服务商时，强制重置为对应的默认 URL
		form.setValue("service_provider_config.url", config.defaultUrl)
	}

	const handleTestConnection = async () => {
		const values = form.getValues()

		setTesting(true)
		setTestResult(null)

		try {
			const response = await InitializationApi.testLLMConnectivity({
				service_provider_config: values.service_provider_config,
				model_version: values.model_version || "",
				provider_code: values.provider_code,
			})

			setTestResult({
				success: !!response?.status,
				message:
					response?.message ||
					(response?.status ? t("step2.testSuccess") : t("step2.testFailed")),
			})
		} catch (error) {
			console.error("LLM connectivity test failed:", error)
			setTestResult({
				success: false,
				message: (error as Error)?.message || t("step2.testError"),
			})
		} finally {
			setTesting(false)
		}
	}

	const onSubmit = (values: FormValues) => {
		onComplete(values as Step2FormData)
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="mb-2 text-2xl font-bold text-foreground">{t("step2.title")}</h2>
				<p className="text-muted-foreground">{t("step2.subtitle")}</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					{/* Provider Selection */}
					<FormField
						control={form.control}
						name="provider_code"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("step2.provider")}</FormLabel>
								<FormControl>
									<div className="grid grid-cols-3 gap-3">
										{PROVIDERS.map((provider) => (
											<button
												key={provider.value}
												type="button"
												onClick={() => handleProviderChange(provider.value)}
												className={cn(
													"flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-all hover:border-foreground",
													field.value === provider.value
														? "border-foreground bg-accent"
														: "border-border bg-background",
												)}
											>
												<div className="mb-1 text-foreground">
													{provider.icon}
												</div>
												<span className="text-center text-xs font-medium leading-tight">
													{t(`step2.providers.${provider.value}`)}
												</span>
											</button>
										))}
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="space-y-6 rounded-lg bg-muted/50 p-6">
						{/* API URL - 根据 provider 配置显示 */}
						{currentConfig.showApiUrl && (
							<FormField
								control={form.control}
								name="service_provider_config.url"
								render={({ field }) => (
									<FormItem>
										<FormLabel>API URL</FormLabel>
										<FormControl>
											<Input
												placeholder="https://api.example.com/v1"
												{...field}
											/>
										</FormControl>
										<FormDescription>{t("step2.apiUrlHint")}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{/* API Key - 根据 provider 配置显示 */}
						{currentConfig.showApiKey && (
							<FormField
								control={form.control}
								name="service_provider_config.api_key"
								render={({ field }) => (
									<FormItem>
										<FormLabel>API Key</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													type={showApiKey ? "text" : "password"}
													placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
													className="pr-10 font-mono text-sm"
													{...field}
												/>
												<button
													type="button"
													onClick={() => setShowApiKey(!showApiKey)}
													className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
												>
													{showApiKey ? (
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
						)}

						{/* Deployment Name - 所有服务商都显示，必填字段 */}
						<FormField
							control={form.control}
							name="model_version"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										<div className="flex items-center gap-1.5">
											<span>{t("step2.deploymentName")}</span>
											<span className="text-destructive">*</span>
										</div>
									</FormLabel>
									<FormControl>
										<Input
											placeholder={t("step2.deploymentNamePlaceholder")}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										{t("step2.deploymentNameHint")}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Azure API Version (仅 MicrosoftAzure 显示) */}
						{selectedProvider === "MicrosoftAzure" && (
							<FormField
								control={form.control}
								name="service_provider_config.api_version"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("step2.azureApiVersion")}</FormLabel>
										<FormControl>
											<Input
												placeholder={t("step2.azureApiVersionPlaceholder")}
												{...field}
											/>
										</FormControl>
										<FormDescription>
											{t("step2.azureApiVersionHint")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{/* AWS Bedrock 特殊字段 */}
						{selectedProvider === "AWSBedrock" && (
							<>
								<FormField
									control={form.control}
									name="service_provider_config.ak"
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t("step2.awsAccessKey")}</FormLabel>
											<FormControl>
												<div className="relative">
													<Input
														type={showAwsAk ? "text" : "password"}
														placeholder="AKIA..."
														className="pr-10 font-mono text-sm"
														{...field}
													/>
													<button
														type="button"
														onClick={() => setShowAwsAk(!showAwsAk)}
														className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
													>
														{showAwsAk ? (
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

								<FormField
									control={form.control}
									name="service_provider_config.sk"
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t("step2.awsSecretKey")}</FormLabel>
											<FormControl>
												<div className="relative">
													<Input
														type={showAwsSk ? "text" : "password"}
														placeholder="Secret Key"
														className="pr-10 font-mono text-sm"
														{...field}
													/>
													<button
														type="button"
														onClick={() => setShowAwsSk(!showAwsSk)}
														className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
													>
														{showAwsSk ? (
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

								<FormField
									control={form.control}
									name="service_provider_config.region"
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t("step2.awsRegion")}</FormLabel>
											<FormControl>
												<Input
													placeholder={t("step2.awsRegionPlaceholder")}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</>
						)}

						{/* Test Connection Button */}
						<div className="flex items-center gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={handleTestConnection}
								disabled={testing}
							>
								{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{t("step2.testConnection")}
							</Button>
							{testResult && (
								<span
									className={cn(
										"text-sm font-medium",
										testResult.success ? "text-green-600" : "text-destructive",
									)}
								>
									{testResult.message}
								</span>
							)}
						</div>
					</div>

					{/* Navigation Buttons */}
					<div className="flex justify-end gap-2 pt-4">
						<Button type="button" variant="outline" onClick={onBack}>
							{t("actions.previous")}
						</Button>
						<Button type="submit">{t("actions.next")}</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
	useTestSystemCapabilityConnectionMutation,
	useUpdateSystemCapabilityMutation,
} from "@magic-admin-v2/features/platform-system-capabilities/mutations"
import {
	useCapabilityModelsQuery,
	useSystemCapabilityDetailQuery,
} from "@magic-admin-v2/features/platform-system-capabilities/queries"
import {
	capabilityFormSchema,
	type CapabilityFormValues,
} from "@magic-admin-v2/features/platform-system-capabilities/schemas"
import {
	getProviderFields,
	getRequiredProviderFields,
} from "@magic-admin-v2/features/platform-system-capabilities/provider-fields"
import type {
	AiPower,
	AiPowerConfig,
	ProviderConfig,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import {
	createCapabilityFormValues,
	emptyProvider,
	getAvailableProviderList,
	getApiErrorMessage,
	hasProvidersConfig,
	normalizeProviderCode,
} from "@magic-admin-v2/features/platform-system-capabilities/utils"
import {
	CONNECTIVITY_TEST_CODES,
	DEFAULT_PROVIDER_LIST_MAP,
	IMAGE_TOOL_CODES,
} from "@magic-admin-v2/features/platform-system-capabilities/consts"

export type ConnectivityTestState =
	| { status: "idle" }
	| { status: "testing" }
	| { status: "success"; durationMs?: number; message?: string }
	| { status: "error"; durationMs?: number; message: string }

export function useCapabilityConfig({
	canEdit,
	onOpenChange,
	open,
	target,
}: {
	canEdit: boolean
	onOpenChange: (open: boolean) => void
	open: boolean
	target: AiPower | null
}) {
	const { t } = useTranslation()
	const targetCode = target?.code ?? null
	const detailQuery = useSystemCapabilityDetailQuery(open ? targetCode : null)
	const detail = detailQuery.data
	const providerMode = Boolean(
		targetCode &&
		(hasProvidersConfig(detail) || Boolean(DEFAULT_PROVIDER_LIST_MAP[targetCode]?.length)),
	)
	const modelsQuery = useCapabilityModelsQuery(
		targetCode,
		open && Boolean(detail) && !providerMode,
	)
	const updateMutation = useUpdateSystemCapabilityMutation()
	const testMutation = useTestSystemCapabilityConnectionMutation()
	const [providerList, setProviderList] = useState<ProviderConfig[]>([])
	const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderConfig>>({})
	const [connectivityResult, setConnectivityResult] = useState<ConnectivityTestState>({
		status: "idle",
	})
	const [initializedTargetCode, setInitializedTargetCode] = useState<string | null>(null)

	const form = useForm<CapabilityFormValues>({
		resolver: zodResolver(capabilityFormSchema),
		defaultValues: createCapabilityFormValues(null, []),
	})

	const selectedProvider = form.watch("selectedProvider")
	const selectedProviderConfig = useWatch({ control: form.control, name: "provider" })
	const providerFields = useMemo(
		() =>
			targetCode && providerMode
				? getProviderFields(
						targetCode,
						selectedProvider,
						selectedProviderConfig as ProviderConfig,
					)
				: [],
		[providerMode, selectedProvider, selectedProviderConfig, targetCode],
	)

	useLayoutEffect(() => {
		if (!open || !targetCode || !detail) {
			setInitializedTargetCode(null)
			return
		}

		const availableProviders = getAvailableProviderList(targetCode, detail.config?.providers)
		if (providerMode) {
			setProviderList(availableProviders)
			setProviderDrafts(
				Object.fromEntries(
					availableProviders.map((provider) => [
						normalizeProviderCode(provider.provider).toLowerCase(),
						provider,
					]),
				),
			)
		} else {
			setProviderList([])
			setProviderDrafts({})
		}

		form.reset(createCapabilityFormValues(detail, availableProviders))
		setConnectivityResult({ status: "idle" })
		setInitializedTargetCode(targetCode)
	}, [detail, form, open, providerMode, targetCode])

	useEffect(() => {
		if (!providerMode || !selectedProviderConfig?.provider) return

		const key = normalizeProviderCode(selectedProviderConfig.provider).toLowerCase()
		setProviderDrafts((previous) => ({
			...previous,
			[key]: selectedProviderConfig as ProviderConfig,
		}))
	}, [providerMode, selectedProviderConfig])

	const handleProviderChange = useCallback(
		(provider: string) => {
			if (!canEdit) return

			const currentProvider = form.getValues("provider") as ProviderConfig
			const currentKey = normalizeProviderCode(currentProvider.provider).toLowerCase()
			const nextKey = normalizeProviderCode(provider).toLowerCase()
			const nextProvider = providerDrafts[nextKey] ??
				providerList.find(
					(item) => normalizeProviderCode(item.provider).toLowerCase() === nextKey,
				) ?? { ...emptyProvider, provider, name: provider }

			setProviderDrafts((previous) => ({
				...previous,
				...(currentKey ? { [currentKey]: currentProvider } : {}),
			}))
			form.setValue("selectedProvider", provider, { shouldDirty: true })
			form.setValue("provider", nextProvider, { shouldDirty: true })
			setConnectivityResult({ status: "idle" })
		},
		[canEdit, form, providerDrafts, providerList],
	)

	const validateProviderConfig = useCallback(() => {
		if (!providerMode) return true

		form.clearErrors()
		const values = form.getValues("provider") as ProviderConfig
		const providerMissing = !normalizeProviderCode(values.provider)
		const errors = getRequiredProviderFields(providerFields).filter((field) => {
			const value = values[field.name]
			return (
				value === undefined ||
				value === null ||
				(typeof value === "string" && !value.trim())
			)
		})

		errors.forEach((field) => {
			form.setError(`provider.${field.name}` as never, {
				type: "required",
				message: t("systemCapabilities.validation.required"),
			})
		})

		if (providerMissing) {
			form.setError("selectedProvider", {
				type: "required",
				message: t("systemCapabilities.validation.required"),
			})
		}

		return !providerMissing && errors.length === 0
	}, [form, providerFields, providerMode, t])

	const handleSubmit = useCallback(
		(values: CapabilityFormValues) => {
			if (!canEdit || !target) return
			if (!validateProviderConfig()) return

			const currentProvider = values.provider as ProviderConfig
			const currentKey = normalizeProviderCode(currentProvider.provider).toLowerCase()
			const draftMap = { ...providerDrafts, [currentKey]: currentProvider }
			const config: AiPowerConfig = providerMode
				? {
						...(detail?.config ?? {}),
						providers: providerList.map((provider) => {
							const draft =
								draftMap[normalizeProviderCode(provider.provider).toLowerCase()]
							return {
								...provider,
								...(draft ?? {}),
								enable:
									normalizeProviderCode(provider.provider).toLowerCase() ===
									normalizeProviderCode(values.selectedProvider).toLowerCase(),
							}
						}),
					}
				: {
						...(detail?.config ?? {}),
						model_id: values.model_id ?? "",
						prompt: values.prompt ?? "",
					}

			updateMutation.mutate(
				{
					code: target.code,
					status: values.status ? 1 : 0,
					config,
				},
				{
					onSuccess: () => {
						toast.success(t("systemCapabilities.message.updateSuccess"))
						onOpenChange(false)
					},
					onError: (error) =>
						toast.error(getApiErrorMessage(error, t("common.requestFailed"))),
				},
			)
		},
		[
			canEdit,
			detail,
			onOpenChange,
			providerDrafts,
			providerList,
			providerMode,
			t,
			target,
			updateMutation,
			validateProviderConfig,
		],
	)

	const handleTestConnection = useCallback(() => {
		if (!canEdit || !target || !selectedProvider) return

		setConnectivityResult({ status: "testing" })
		testMutation.mutate(
			{ ai_ability: target.code, provider: selectedProvider },
			{
				onSuccess: (result) => {
					const nextResult = result.success
						? {
								status: "success" as const,
								durationMs: result.duration_ms,
								message: result.message,
							}
						: {
								status: "error" as const,
								durationMs: result.duration_ms,
								message: result.message,
							}
					setConnectivityResult(nextResult)
				},
				onError: (error) => {
					const message = getApiErrorMessage(
						error,
						t("systemCapabilities.test.failureDescription"),
					)
					setConnectivityResult({ status: "error", message })
				},
			},
		)
	}, [canEdit, selectedProvider, t, target, testMutation])

	return {
		canEdit,
		detail,
		detailQuery,
		isInitialized: initializedTargetCode === targetCode && Boolean(detail),
		form,
		handleProviderChange,
		handleSubmit,
		handleTestConnection,
		isProviderConfig: providerMode,
		isModelLoading: modelsQuery.isLoading,
		models: modelsQuery.data ?? [],
		providerFields,
		providerList,
		selectedProvider,
		connectivityResult,
		testPending: testMutation.isPending,
		updatePending: updateMutation.isPending,
		imagePrompt: Boolean(
			targetCode && IMAGE_TOOL_CODES.some((item) => item === targetCode) && !providerMode,
		),
		supportsConnectivityTest: Boolean(
			targetCode && CONNECTIVITY_TEST_CODES.some((item) => item === targetCode),
		),
	}
}

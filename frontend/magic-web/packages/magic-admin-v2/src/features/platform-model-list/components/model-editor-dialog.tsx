import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  BrainCircuit,
  Loader2,
  ServerCog,
  SlidersHorizontal,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ConfirmDialog } from "@magic-admin-v2/components/confirm-dialog";
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs";
import { ModelEditorCommonTab } from "@magic-admin-v2/features/platform-model-list/components/model-editor-common-tab";
import {
  ModelEditorProgressDialog,
  type ModelEditorProgress,
} from "@magic-admin-v2/features/platform-model-list/components/model-editor-progress-dialog";
import { ModelEditorProvidersTab } from "@magic-admin-v2/features/platform-model-list/components/model-editor-providers-tab";
import { ModelEditorRuntimeFields } from "@magic-admin-v2/features/platform-model-list/components/model-editor-runtime-fields";
import {
  hasCommonRuntimeFields,
  isEmbeddingModelType,
} from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config";
import {
  useDeleteProviderModelBindingsMutation,
  useLoadProviderModelDetailsMutation,
  useSaveProviderModelBindingsMutation,
} from "@magic-admin-v2/features/platform-model-list/mutations";
import {
  providerModelCategory,
  providerModelType,
  type ProviderModelBillingTier,
  type ProviderModelCategory,
  type ProviderModelConfig,
  type ProviderModelGroup,
  type ProviderModelPricingTemplate,
  type ProviderModelRecord,
  type ProviderModelSaveInput,
  type ProviderModelSaveResult,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source";
import {
  createBindingValues,
  createEditorValues,
  createImportedEditorValues,
  createEmptyValues,
  getModelTypeOptions,
  getProviderCategory,
  getUnpairedLanguageChanges,
  toSaveInputs,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor";
import {
  createModelEditorSchema,
  type ModelEditorValues,
  type ProviderBindingErrors,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema";
import type {
  EditorTabValue,
  ModelEditorFocusRequest,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-types";
import {
  hasLegacyPricing,
  normalizeLegacyBillingType,
  resolveCanonicalBillingTiers,
  validatePricingEntries,
} from "@magic-admin-v2/features/platform-model-list/utils/pricing";
import { providerType } from "@magic-admin-v2/features/platform-provider-list/types";
import { useProviderListQuery } from "@magic-admin-v2/features/platform-provider-list/queries";
import {
  Language,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources";
import { useApis, useRuntime } from "@magic-admin-v2/runtime/context";

export function ModelEditorDialog({
  allowedCategories,
  initialCategory,
  initialModelType,
  model,
  open,
  onOpenChange,
}: {
  allowedCategories: readonly ProviderModelCategory[];
  initialCategory?: ProviderModelCategory;
  initialModelType?: ProviderModelType;
  model?: ProviderModelGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const dataSource = useProviderModelDataSource();
  const { access } = useRuntime();
  const { platformModel } = useApis();
  const isOfficialOrganization = access?.isOfficialOrganization === true;
  const selectableCategories = useMemo(
    () => Array.from(new Set(allowedCategories.map(getProviderCategory))),
    [allowedCategories],
  );
  const resolvedInitialCategory = initialCategory
    && selectableCategories.includes(getProviderCategory(initialCategory))
    ? getProviderCategory(initialCategory)
    : selectableCategories[0] ?? providerModelCategory.llm;
  const resolvedInitialModelType = initialCategory
    && getProviderCategory(initialCategory) === resolvedInitialCategory
    && initialModelType !== undefined
    ? initialModelType
    : getModelTypeOptions(resolvedInitialCategory, t)[0]?.value
      ?? providerModelType.largeLanguageModel;
  const form = useForm<ModelEditorValues>({
    defaultValues: createEmptyValues(),
    resolver: zodResolver(createModelEditorSchema(isOfficialOrganization)),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "providers",
  });
  const category = useWatch({ control: form.control, name: "category" });
  const modelType = useWatch({ control: form.control, name: "model_type" });
  const providerQuery = useProviderListQuery(getProviderCategory(category), {
    endpoint: dataSource.endpoints.providerList,
    key: dataSource.key,
  });
  const saveMutation = useSaveProviderModelBindingsMutation();
  const deleteBindingsMutation = useDeleteProviderModelBindingsMutation();
  const loadDetailsMutation = useLoadProviderModelDetailsMutation();
  const loadDetails = loadDetailsMutation.mutateAsync;
  const [saveResults, setSaveResults] = useState<Record<string, ProviderModelSaveResult>>({});
  const [activeTab, setActiveTab] = useState<EditorTabValue>("common");
  const [contentLocale, setContentLocale] = useState<LanguageCode>(Language.ZhCN);
  const [focusRequest, setFocusRequest] = useState<ModelEditorFocusRequest | null>(null);
  const [removedRecordIds, setRemovedRecordIds] = useState<string[]>([]);
  const [pendingRemoveProviderIndex, setPendingRemoveProviderIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<ModelEditorProgress | null>(null);
  const [failedLoadRecordIds, setFailedLoadRecordIds] = useState<string[]>([]);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isIconUploading, setIsIconUploading] = useState(false);
  const [languageSyncWarningOpen, setLanguageSyncWarningOpen] = useState(false);
  const [languageSyncWarnings, setLanguageSyncWarnings] = useState<{ name: boolean; description: boolean } | null>(null);
  const [pendingLanguageSyncValues, setPendingLanguageSyncValues] = useState<ModelEditorValues | null>(null);
  const loadedRecordsRef = useRef<Record<string, ProviderModelRecord>>({});
  const initialLanguageValuesRef = useRef<Pick<ModelEditorValues, "name" | "name_en" | "description" | "description_en"> | null>(null);
  const loadSessionRef = useRef("");
  const focusRequestIdRef = useRef(0);
  const isEditMode = Boolean(model);
  const recordIds = useMemo(
    () => model?.providers.map((provider) => provider.model_record_id) ?? [],
    [model],
  );
  const recordIdsKey = recordIds.join(",");
  const isSaving = saveMutation.isPending || deleteBindingsMutation.isPending;
  const isOperationRunning = progress?.phase === "running";
  // Keep the large record map out of form state. isEditorReady and failed-load updates
  // re-render after the ref is written, so this derivation sees the loaded records.
  const officialSyncedRecords =
    isOfficialOrganization && isEditorReady
      ? Object.fromEntries(
          Object.entries(loadedRecordsRef.current).filter(([, record]) =>
            (providerQuery.data ?? [])
              .filter((provider) => provider.provider_type === providerType.official)
              .some((provider) => provider.id === record.service_provider_config_id),
          ),
        )
      : ({} as Record<string, ProviderModelRecord>);
  const officialSyncedRecordIds = new Set(Object.keys(officialSyncedRecords));
  const hasOfficialSyncedBinding = officialSyncedRecordIds.size > 0;

  const modelTypeOptions = useMemo(() => getModelTypeOptions(category, t), [category, t]);
  const failedInputs = useMemo(
    () =>
      Object.values(saveResults)
        .filter((result) => result.status === "failed" && result.retryInput)
        .map((result) => result.retryInput as ProviderModelSaveInput),
    [saveResults],
  );
  const canRetrySave = Boolean(failedInputs.length || removedRecordIds.length);

  useEffect(() => {
    if (!open) {
      form.reset(createEmptyValues());
      setSaveResults({});
      setActiveTab("common");
      setContentLocale(Language.ZhCN);
      setFocusRequest(null);
      setRemovedRecordIds([]);
      setPendingRemoveProviderIndex(null);
      setProgress(null);
      setFailedLoadRecordIds([]);
      setIsEditorReady(false);
      setIsIconUploading(false);
      setLanguageSyncWarningOpen(false);
      setLanguageSyncWarnings(null);
      setPendingLanguageSyncValues(null);
      initialLanguageValuesRef.current = null;
      loadedRecordsRef.current = {};
      loadSessionRef.current = "";
    }
  }, [form, open]);

  useEffect(() => {
    if (!open || isEditMode) {
      return;
    }

    form.reset(createEmptyValues(resolvedInitialCategory, resolvedInitialModelType));
    setSaveResults({});
    setActiveTab("common");
    setContentLocale(Language.ZhCN);
    setFocusRequest(null);
    setRemovedRecordIds([]);
    setPendingRemoveProviderIndex(null);
    setFailedLoadRecordIds([]);
    setLanguageSyncWarningOpen(false);
    setPendingLanguageSyncValues(null);
    initialLanguageValuesRef.current = null;
    setIsEditorReady(true);
    loadedRecordsRef.current = {};
  }, [form, isEditMode, open, resolvedInitialCategory, resolvedInitialModelType]);

  const loadProviderModelDetails = useCallback(async (ids: string[], allRecordIds: string[]) => {
    if (!ids.length) {
      setIsEditorReady(true);
      return;
    }

    // Loading one provider is fast enough to keep inside the editor; only show the
    // progress modal when editing a model with multiple provider configurations.
    const shouldShowLoadProgress = allRecordIds.length >= 2;
    if (shouldShowLoadProgress) {
      setProgress({ completed: 0, failed: 0, kind: "load", phase: "running", total: ids.length });
    } else {
      setProgress(null);
    }
    const result = await loadDetails({
      recordIds: ids,
      onProgress: (nextProgress) => {
        if (shouldShowLoadProgress) {
          setProgress((previous) => ({
            completed: nextProgress.completed,
            failed: (previous?.kind === "load" ? previous.failed : 0) + (nextProgress.status === "failed" ? 1 : 0),
            kind: "load",
            phase: "running",
            total: nextProgress.total,
          }));
        }
      },
    });

    result.records.forEach((record) => {
      loadedRecordsRef.current[record.id] = record;
    });
    setFailedLoadRecordIds(result.failedRecordIds);

    if (result.failedRecordIds.length) {
      if (shouldShowLoadProgress) {
        setProgress({
          completed: ids.length,
          failed: result.failedRecordIds.length,
          kind: "load",
          phase: "finished",
          total: ids.length,
        });
      } else {
        setProgress(null);
      }
      return;
    }

    const records = allRecordIds
      .map((id) => loadedRecordsRef.current[id])
      .filter((record): record is ProviderModelRecord => Boolean(record));
    const editorValues = createEditorValues(records);
    form.reset(editorValues);
    initialLanguageValuesRef.current = editorValues;
    setSaveResults({});
    setActiveTab("common");
    setContentLocale(Language.ZhCN);
    setFocusRequest(null);
    setRemovedRecordIds([]);
    setPendingRemoveProviderIndex(null);
    setIsEditorReady(true);
    setProgress(null);
  }, [form, loadDetails]);

  useEffect(() => {
    if (!open || !isEditMode || !recordIdsKey || loadSessionRef.current === recordIdsKey) {
      return;
    }

    loadSessionRef.current = recordIdsKey;
    form.reset(createEmptyValues());
    setSaveResults({});
    setActiveTab("common");
    setRemovedRecordIds([]);
    setPendingRemoveProviderIndex(null);
    setFailedLoadRecordIds([]);
    setIsEditorReady(false);
    loadedRecordsRef.current = {};
    void loadProviderModelDetails(recordIds, recordIds);
  }, [form, isEditMode, loadProviderModelDetails, open, recordIds, recordIdsKey]);

  function handleCategoryChange(nextCategory: ProviderModelCategory) {
    if (!selectableCategories.includes(getProviderCategory(nextCategory))) {
      return;
    }

    const nextModelType = getModelTypeOptions(nextCategory, t)[0]?.value;
    form.setValue("category", nextCategory, { shouldDirty: true, shouldValidate: true });
    if (nextModelType !== undefined) {
      form.setValue("model_type", nextModelType, { shouldDirty: true, shouldValidate: true });
      form.clearErrors("model_type");
    }
    fields.forEach((_, index) => {
      form.setValue(`providers.${index}.service_provider_config_id`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue(`providers.${index}.provider_code`, "", { shouldDirty: true });
      form.setValue(`providers.${index}.pricing_template`, null, { shouldDirty: true });
      form.setValue(`providers.${index}.pricing_entries`, {}, { shouldDirty: true });
      form.setValue(`providers.${index}.billing_tiers`, [], { shouldDirty: true });
      form.setValue(`providers.${index}.legacy_pricing`, {}, { shouldDirty: true });
    });
  }

  async function save(inputs: ProviderModelSaveInput[]) {
    const total = inputs.length + removedRecordIds.length;
    setProgress({ completed: 0, failed: 0, kind: "save", phase: "running", total });
    const results = await saveMutation.mutateAsync({
      inputs,
      onProgress: (nextProgress) => {
        setProgress((previous) => ({
          completed: nextProgress.completed,
          failed: (previous?.kind === "save" ? previous.failed : 0) + (nextProgress.status === "failed" ? 1 : 0),
          kind: "save",
          phase: "running",
          total,
        }));
      },
    });
    setSaveResults((previous) => {
      const next = { ...previous };
      results.forEach((result) => {
        next[result.bindingKey] = result;
      });
      return next;
    });

    const failures = results.filter((result) => result.status === "failed");
    if (failures.length) {
      setProgress({ completed: inputs.length, failed: failures.length, kind: "save", phase: "finished", total });
      return;
    }

    if (removedRecordIds.length) {
      const deleteResult = await deleteBindingsMutation.mutateAsync({
        recordIds: removedRecordIds,
        onProgress: (nextProgress) => {
          setProgress((previous) => ({
            completed: inputs.length + nextProgress.completed,
            failed: (previous?.kind === "save" ? previous.failed : 0) + (nextProgress.status === "failed" ? 1 : 0),
            kind: "save",
            phase: "running",
            total,
          }));
        },
      });
      if (deleteResult.failedRecordIds.length) {
        setRemovedRecordIds(deleteResult.failedRecordIds);
        setProgress({
          completed: total,
          failed: deleteResult.failedRecordIds.length,
          kind: "save",
          phase: "finished",
          total,
        });
        return;
      }
      setRemovedRecordIds([]);
    }

    toast.success(t(isEditMode ? "modelList.editor.updateSuccess" : "modelList.editor.saveSuccess"));
    setProgress({ completed: total, failed: 0, kind: "save", phase: "finished", total });
  }

  async function resolvePricingTiersForSave(values: ModelEditorValues) {
    const legacyBindings = values.providers.filter((binding) =>
      !officialSyncedRecordIds.has(binding.record_id ?? "")
      && !binding.billing_tiers.length
      && hasLegacyPricing(binding.legacy_pricing),
    );
    if (!legacyBindings.length) {
      return {} as Record<string, ProviderModelBillingTier[] | null>;
    }

    let providers = providerQuery.data ?? [];
    if (legacyBindings.some((binding) => !binding.provider_code)) {
      providers = (await providerQuery.refetch()).data ?? providers;
    }

    const templatePromises = new Map<string, Promise<ProviderModelPricingTemplate[]>>();
    const getTemplates = (providerCode: string) => {
      const cacheKey = `${getProviderCategory(values.category)}:${providerCode}`;
      const cached = templatePromises.get(cacheKey);
      if (cached) {
        return cached;
      }

      const promise = platformModel.getProviderModelPricingTemplates(
        { category: getProviderCategory(values.category), providerCode },
        dataSource,
      );
      templatePromises.set(cacheKey, promise);
      return promise;
    };

    const converted = await Promise.all(
      legacyBindings.map(async (binding) => {
        const providerCode = binding.provider_code
          || providers.find((provider) => provider.id === binding.service_provider_config_id)?.provider_code;
        if (!providerCode) {
          throw new Error("PRICING_PROVIDER_CODE_REQUIRED");
        }

        const templates = await getTemplates(providerCode);
        const normalizedBillingType = normalizeLegacyBillingType(
          binding.billing_type,
          getProviderCategory(values.category),
        );
        const template = templates.find(
          (item) => item.billing_type === normalizedBillingType
            || item.code === binding.billing_type
            || item.code === normalizedBillingType,
        ) ?? (templates.length === 1 ? templates[0] : undefined);
        if (!template) {
          throw new Error("PRICING_TEMPLATE_REQUIRED");
        }

        const config: ProviderModelConfig = {
          billing_currency: binding.billing_currency,
          billing_type: binding.billing_type,
          billing_tiers: binding.billing_tiers,
          ...binding.legacy_pricing,
        };
        const billingTiers = resolveCanonicalBillingTiers(
          config,
          template,
          getProviderCategory(values.category),
        );
        if (!billingTiers?.length) {
          throw new Error("PRICING_CONVERSION_FAILED");
        }

        return [binding.client_key, billingTiers] as const;
      }),
    );

    return Object.fromEntries(converted) as Record<string, ProviderModelBillingTier[] | null>;
  }

  function handleApplyImportedConfig(record: ProviderModelRecord) {
    const importedValues = createImportedEditorValues(record);
    form.reset(importedValues);
    setActiveTab("common");
    setContentLocale(Language.ZhCN);
    setSaveResults({});
    setRemovedRecordIds([]);
    initialLanguageValuesRef.current = null;
    setLanguageSyncWarnings(null);
  }

  async function submitValues(values: ModelEditorValues) {
    const invalidPricing = values.providers
      .map((binding, index) => ({
        index,
        validation: officialSyncedRecordIds.has(binding.record_id ?? "")
          ? undefined
          : validatePricingEntries(binding.pricing_template, binding.pricing_entries),
      }))
      .find((item) => Boolean(item.validation));
    if (invalidPricing?.validation) {
      form.setError(`providers.${invalidPricing.index}.pricing_entries`, {
        type: "validate",
        message: t("modelList.editor.pricingInvalid", {
          label: invalidPricing.validation.label,
        }),
      });
      requestEditorFocus({
        fieldId: `providers.${invalidPricing.index}.pricing_entries.${invalidPricing.validation.billingObject}`,
        providerIndex: invalidPricing.index,
        providerSection: "pricing",
        pricingBillingObject: invalidPricing.validation.billingObject,
        tab: "providers",
      });
      toast.error(t("modelList.editor.pricingInvalidToast"));
      return;
    }
    setSaveResults({});
    try {
      const canonicalPricingTiers = await resolvePricingTiersForSave(values);
      await save(toSaveInputs(
        values,
        dataSource.supportsLoadBalancing ?? true,
        isOfficialOrganization,
        canonicalPricingTiers,
        officialSyncedRecords,
      ));
    } catch {
      toast.error(t("modelList.editor.pricingTemplateLoadFailed"));
    }
  }

  async function submit(values: ModelEditorValues) {
    if (isIconUploading) return;

    if (isEditMode && initialLanguageValuesRef.current) {
      const warnings = getUnpairedLanguageChanges(initialLanguageValuesRef.current, values);
      if (warnings.name || warnings.description) {
        setPendingLanguageSyncValues(values);
        setLanguageSyncWarnings(warnings);
        setLanguageSyncWarningOpen(true);
        return;
      }
    }

    await submitValues(values);
  }

  function requestEditorFocus(target: Omit<ModelEditorFocusRequest, "id">) {
    if (target.locale) {
      setContentLocale(target.locale);
    }
    setActiveTab(target.tab);
    setFocusRequest({ ...target, id: ++focusRequestIdRef.current });
  }

  function handleInvalidSubmit(errors: FieldErrors<ModelEditorValues>) {
    toast.error(t("modelList.editor.validationFailed"));

    if (errors.name) {
      requestEditorFocus({ fieldId: "name", locale: Language.ZhCN, tab: "common" });
      return;
    }
    if (errors.name_en) {
      requestEditorFocus({ fieldId: "name_en", locale: Language.EnUS, tab: "common" });
      return;
    }
    if (errors.model_id) {
      requestEditorFocus({ fieldId: "model_id", tab: "common" });
      return;
    }
    if (errors.category) {
      requestEditorFocus({ fieldId: "category", tab: "common" });
      return;
    }
    if (errors.model_type) {
      requestEditorFocus({ fieldId: "model_type", tab: "common" });
      return;
    }

    if (hasCommonRuntimeFields(modelType)) {
      const runtimeFields = isEmbeddingModelType(modelType)
        ? ["vector_size", "max_output_tokens", "temperature"] as const
        : ["max_tokens", "max_output_tokens", "temperature"] as const;
      const invalidRuntimeField = runtimeFields.find((field) => Boolean(errors[field]));
      if (invalidRuntimeField) {
        requestEditorFocus({ fieldId: invalidRuntimeField, tab: "runtime" });
        return;
      }
    }

    if (errors.providers?.root) {
      requestEditorFocus({ fieldId: "providers", tab: "providers" });
      return;
    }

    const providerErrors = errors.providers as Array<ProviderBindingErrors | undefined> | undefined;
    for (let index = 0; index < (providerErrors?.length ?? 0); index += 1) {
      const providerError = providerErrors?.[index];
      if (!providerError) {
        continue;
      }
      if (providerError.service_provider_config_id) {
        requestEditorFocus({
          fieldId: `providers.${index}.service_provider_config_id`,
          providerIndex: index,
          tab: "providers",
        });
        return;
      }
      if (providerError.model_version) {
        requestEditorFocus({
          fieldId: `providers.${index}.model_version`,
          providerIndex: index,
          tab: "providers",
        });
        return;
      }
      if (providerError.load_balancing_weight) {
        requestEditorFocus({
          fieldId: `providers.${index}.load_balancing_weight`,
          providerIndex: index,
          providerSection: "optional",
          tab: "providers",
        });
        return;
      }
      if (providerError.pricing_entries) {
        requestEditorFocus({
          fieldId: `providers.${index}.pricing_entries`,
          providerIndex: index,
          providerSection: "pricing",
          tab: "providers",
        });
        return;
      }
      if (
        providerError.billing_currency
        || providerError.billing_type
        || providerError.pricing_template
        || providerError.billing_tiers
        || providerError.legacy_pricing
      ) {
        requestEditorFocus({
          fieldId: `providers.${index}.pricing_entries`,
          providerIndex: index,
          providerSection: "pricing",
          tab: "providers",
        });
        return;
      }
    }
  }

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const target = Array.from(
          document.querySelectorAll<HTMLElement>("[data-model-editor-field], [data-form-field]"),
        ).find(
          (element) =>
            element.dataset.modelEditorField === focusRequest.fieldId ||
            element.dataset.formField === focusRequest.fieldId,
        );
        if (!target) {
          return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusTarget = target.matches("input, textarea, button, [role='combobox'], [tabindex]")
          ? target
          : target.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [role='combobox']:not([disabled]), [tabindex]:not([tabindex='-1'])");
        focusTarget?.focus({ preventScroll: true });
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [focusRequest]);

  async function retryFailed() {
    if (!failedInputs.length && !removedRecordIds.length) {
      return;
    }

    await save(failedInputs);
  }

  function retryFailedLoads() {
    if (!failedLoadRecordIds.length) {
      return;
    }

    void loadProviderModelDetails(failedLoadRecordIds, recordIds);
  }

  function closeProgressDialog() {
    if (!progress || progress.phase === "running") {
      return;
    }

    const shouldCloseEditor = progress.kind === "load" || !progress.failed;
    setProgress(null);
    if (shouldCloseEditor) {
      window.requestAnimationFrame(() => onOpenChange(false));
    }
  }

  function handleRemoveProvider(index: number) {
    const recordId = form.getValues(`providers.${index}.record_id`);
    if (recordId) {
      setRemovedRecordIds((previous) => previous.includes(recordId) ? previous : [...previous, recordId]);
    }
    remove(index);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving && !isOperationRunning) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent
      closeButtonTestId="model-editor-dialog-close-button"
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton={!progress}
       data-testid="platform-model-list-dialog-content">
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle>{t(isEditMode ? "modelList.editor.editTitle" : "modelList.editor.title")}</DialogTitle>
          <DialogDescription>{t(isEditMode ? "modelList.editor.editDescription" : "modelList.editor.description")}</DialogDescription>
        </DialogHeader>

        {!isEditMode || isEditorReady ? (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(submit, handleInvalidSubmit)}>
          <Tabs
            className="flex min-h-0 flex-1 flex-col sm:flex-row"
            onValueChange={(value) => setActiveTab(value as EditorTabValue)}
            value={activeTab}
          >
            <aside className="shrink-0 border-b bg-muted/10 p-3 sm:w-52 sm:border-b-0 sm:border-r sm:p-4">
              <TabsList className="flex h-auto w-full flex-row gap-1 overflow-x-auto border-0 sm:flex-col sm:items-stretch sm:overflow-visible">
                <EditorTab icon={<BrainCircuit className="size-4" aria-hidden="true" />} label={t("modelList.editor.tab.common")} value="common" />
                <EditorTab icon={<SlidersHorizontal className="size-4" aria-hidden="true" />} label={t("modelList.editor.tab.runtime")} value="runtime" />
                <EditorTab icon={<ServerCog className="size-4" aria-hidden="true" />} label={t("modelList.editor.tab.providers")} value="providers" />
              </TabsList>
            </aside>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <TabsContent className="m-0 p-6 data-[state=inactive]:hidden" value="common">
                <ModelEditorCommonTab
                  category={category}
                  contentLocale={contentLocale}
                  disabled={isSaving || hasOfficialSyncedBinding}
                  form={form}
                  modelType={modelType}
                  modelTypeOptions={modelTypeOptions}
                  onApplyImportedConfig={handleApplyImportedConfig}
                  onCategoryChange={handleCategoryChange}
                  onIconUploadingChange={setIsIconUploading}
                  onLocaleChange={setContentLocale}
                  showImportConfig={
                    isOfficialOrganization &&
                    !isEditMode &&
                    Boolean(dataSource.endpoints.modelImportList)
                  }
                  selectableCategories={selectableCategories}
                />
              </TabsContent>

              <TabsContent className="m-0 p-6 data-[state=inactive]:hidden" value="runtime">
                <section aria-labelledby="model-runtime-fields-title">
                  {category === providerModelCategory.llm || category === providerModelCategory.embedding ? (
                    <ModelEditorRuntimeFields
                      control={form.control}
                      setValue={form.setValue}
                      disabled={isSaving || hasOfficialSyncedBinding}
                      errors={form.formState.errors}
                      isOfficialOrganization={isOfficialOrganization}
                      modelType={modelType}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      {t("modelList.editor.runtimeUnavailable")}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent className="m-0 p-6 data-[state=inactive]:hidden" value="providers">
                <ModelEditorProvidersTab
                  category={category}
                  disabled={isSaving}
                  hasOfficialSyncedBinding={hasOfficialSyncedBinding}
                  fields={fields}
                  focusRequest={focusRequest}
                  form={form}
                  modelType={modelType}
                  officialSyncedRecordIds={officialSyncedRecordIds}
                  onAdd={() => append(createBindingValues())}
                  onRemove={setPendingRemoveProviderIndex}
                  saveResults={saveResults}
                />
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between">
            <div>
              {canRetrySave ? (
                <Button disabled={isSaving} onClick={retryFailed} type="button" variant="outline" data-testid="platform-model-list-edit-button">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <AlertCircle className="size-4" />}
                  {t("modelList.editor.action.retryFailed", {
                    count: failedInputs.length,
                  })}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button disabled={isSaving} onClick={() => onOpenChange(false)} type="button" variant="outline" data-testid="platform-model-list-cancel-button">
                {t("common.cancel")}
              </Button>
              <Button disabled={isSaving || isIconUploading} type="submit" data-testid="platform-model-list-save-button">
                {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isSaving ? t("common.saving") : t(isEditMode ? "modelList.editor.action.update" : "modelList.editor.action.create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
        ) : (
          <div className="min-h-80 flex-1" />
        )}
        <ConfirmDialog
          open={languageSyncWarningOpen}
          title={t("modelList.editor.languageSync.title")}
          description={
            languageSyncWarnings ? (
              <div className="space-y-1">
                {languageSyncWarnings.name ? (
                  <div>{t("modelList.editor.languageSync.name")}</div>
                ) : null}
                {languageSyncWarnings.description ? (
                  <div>{t("modelList.editor.languageSync.description")}</div>
                ) : null}
              </div>
            ) : (
              t("modelList.editor.languageSync.name")
            )
          }
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setLanguageSyncWarningOpen(false);
              setLanguageSyncWarnings(null);
              setPendingLanguageSyncValues(null);
            }
          }}
          onConfirm={async () => {
            const values = pendingLanguageSyncValues;
            setLanguageSyncWarningOpen(false);
            setLanguageSyncWarnings(null);
            setPendingLanguageSyncValues(null);
            if (values) {
              await submitValues(values);
            }
          }}
          confirmLabel={t("common.confirm")}
         contentTestId="platform-model-list-confirm-dialog-content" cancelButtonTestId="platform-model-list-confirm-dialog-cancel-button" confirmButtonTestId="platform-model-list-confirm-dialog-confirm-button"/>
		<DeleteConfirmDialog
			contentTestId="model-editor-delete-dialog-content"
			cancelButtonTestId="model-editor-delete-cancel-button"
			confirmButtonTestId="model-editor-delete-confirm-button"
			open={pendingRemoveProviderIndex !== null}
			title={t("modelList.editor.removeProviderTitle")}
			description={t("modelList.editor.removeProviderDescription")}
			confirmLabel={t("modelList.editor.action.removeProvider")}
			confirmDisabled={isSaving}
			onOpenChange={(nextOpen) => !nextOpen && setPendingRemoveProviderIndex(null)}
			onConfirm={() => {
				if (pendingRemoveProviderIndex !== null) {
					handleRemoveProvider(pendingRemoveProviderIndex)
				}
				setPendingRemoveProviderIndex(null)
			}}
		/>
        <ModelEditorProgressDialog
          onClose={closeProgressDialog}
          onRetry={progress?.kind === "load" ? retryFailedLoads : retryFailed}
          progress={progress}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditorTab({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: "common" | "runtime" | "providers";
}) {
  return (
    <TabsTrigger
      className="mb-0 h-10 shrink-0 justify-start gap-2 rounded-md border-0 px-3 data-[state=active]:bg-muted data-[state=active]:shadow-sm sm:w-full"
      value={value}
     data-testid="platform-model-list-tab-trigger">
      {icon}
      {label}
    </TabsTrigger>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, FileArchive, FolderOpen, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useApis, useRuntime } from "@magic-admin-v2/runtime/context";
import { Button } from "@magic-admin-v2/components/ui/button";
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field";
import { FieldError } from "@magic-admin-v2/components/form/field-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import { Input } from "@magic-admin-v2/components/ui/input";
import { Textarea } from "@magic-admin-v2/components/ui/textarea";
import { Switch } from "@magic-admin-v2/components/ui/switch";
import { SearchableMultiSelect } from "@magic-admin-v2/components/searchable-multi-select";
import type {
  ImportOfficialSkillResponse,
  ParseOfficialSkillResponse,
  SkillMarketCategoryItem,
} from "@magic-admin-v2/features/platform-official-marketplace/types";
import { createSkillArchiveFromFolderFiles, skillArchiveError } from "@magic-admin-v2/features/platform-official-marketplace/skill-archive";
import { resolveSkillMarketCategoryName } from "@magic-admin-v2/features/platform-official-marketplace/utils";

const maxFileSize = 100 * 1024 * 1024;
const archiveAccept = ".zip,.skill,application/zip,application/x-zip-compressed";

type OfficialSkillImportDialogProps = {
  categories: SkillMarketCategoryItem[];
  categoriesLoading?: boolean;
  onCancel: () => void;
  onSuccess?: (result: ImportOfficialSkillResponse) => void | Promise<void>;
  open: boolean;
};

type ImportForm = {
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  version: string;
  logo: string;
  logoPreview: string;
  categoryIds: string[];
  hidden: boolean;
  featured: boolean;
  sortOrder: number;
};

const emptyForm: ImportForm = {
  nameZh: "",
  nameEn: "",
  descriptionZh: "",
  descriptionEn: "",
  version: "1.0.0",
  logo: "",
  logoPreview: "",
  categoryIds: [],
  hidden: false,
  featured: false,
  sortOrder: 0,
};

export function OfficialSkillImportDialog({
  categories,
  categoriesLoading = false,
  onCancel,
  onSuccess,
  open,
}: OfficialSkillImportDialogProps) {
  const { t } = useTranslation();
  const { capabilities } = useRuntime();
  const { officialMarketplace } = useApis();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseOfficialSkillResponse | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const logoObjectUrlRef = useRef<string | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        nameZh: z.string().trim().min(1, t("officialMarketplace.skillImport.validation.nameZhRequired")),
        nameEn: z.string().trim().min(1, t("officialMarketplace.skillImport.validation.nameEnRequired")),
        descriptionZh: z
          .string()
          .trim()
          .min(1, t("officialMarketplace.skillImport.validation.descriptionZhRequired")),
        descriptionEn: z
          .string()
          .trim()
          .min(1, t("officialMarketplace.skillImport.validation.descriptionEnRequired")),
        version: z.string().trim().min(1, t("officialMarketplace.skillImport.validation.versionRequired")),
        logo: z.string(),
        logoPreview: z.string(),
        categoryIds: z.array(z.string()),
        hidden: z.boolean(),
        featured: z.boolean(),
        sortOrder: z.number(),
      }),
    [t],
  );
  const {
    control,
    formState,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ImportForm>({
    defaultValues: emptyForm,
    resolver: zodResolver(schema),
  });
  const formValues = watch();

  const categoryOptions = categories.map((category) => ({
    label: resolveSkillMarketCategoryName(category, "zh_CN"),
    value: category.id,
  }));

  const clearLogoSelection = useCallback(() => {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
    setLogoFile(null);
  }, []);

  const clearSelectedFile = useCallback(() => {
    clearLogoSelection();
    setParsed(null);
    reset(emptyForm);
    setDuplicateConfirmOpen(false);
  }, [clearLogoSelection, reset]);

  useEffect(() => {
    clearSelectedFile();
    if (open) {
      setProcessing(false);
      setSubmitting(false);
      setLogoUploading(false);
    }
  }, [clearSelectedFile, open]);

  useEffect(() => {
    return () => {
      if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);
    };
  }, []);

  async function processArchive(file: File | undefined) {
    if (!file) return;
    clearSelectedFile();
    if (!/\.(zip|skill)$/i.test(file.name)) {
      toast.error(t("officialMarketplace.skillImport.invalidFile"));
      return;
    }
    if (file.size > maxFileSize) {
      toast.error(t("officialMarketplace.skillImport.fileTooLarge"));
      return;
    }

    setProcessing(true);
    try {
      const uploaded = await capabilities.uploadFile(file, { storage: "private", directory: "skill" });
      const nextParsed = await officialMarketplace.parseOfficialSkillFile({ file_key: uploaded.path });
      const defaultName = nextParsed.name_i18n?.default || nextParsed.name_i18n?.zh_CN || nextParsed.package_name;
      const defaultDescription = nextParsed.description_i18n?.default || nextParsed.description_i18n?.zh_CN || nextParsed.package_description || "";
      setParsed(nextParsed);
      reset({
        nameZh: nextParsed.name_i18n?.zh_CN || defaultName || "",
        nameEn: nextParsed.name_i18n?.en_US || defaultName || "",
        descriptionZh: nextParsed.description_i18n?.zh_CN || defaultDescription,
        descriptionEn: nextParsed.description_i18n?.en_US || defaultDescription,
        version: nextParsed.version || "1.0.0",
        logo: nextParsed.logo || "",
        logoPreview: nextParsed.logo || "",
        categoryIds: (nextParsed.categories ?? []).map((category) => String(category.id)),
        hidden: Boolean(nextParsed.is_hidden),
        featured: Boolean(nextParsed.is_featured),
        sortOrder: nextParsed.sort_order ?? 0,
      });
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message || t("officialMarketplace.skillImport.parseFailed"));
    } finally {
      setProcessing(false);
    }
  }

  async function handleFolderChange(files: FileList | null) {
    if (!files?.length) return;
    try {
      const archive = await createSkillArchiveFromFolderFiles(files);
      await processArchive(archive);
    } catch (error) {
      const message = (error as { code?: string } | null)?.code === skillArchiveError.emptyFolder
        ? t("officialMarketplace.skillImport.emptyFolder")
        : t("officialMarketplace.skillImport.archiveFailed");
      toast.error(message);
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("officialMarketplace.skillImport.logoUploadFailed"));
      return;
    }

    if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    logoObjectUrlRef.current = previewUrl;
    setLogoFile(file);
    setValue("logo", "", { shouldDirty: true });
    setValue("logoPreview", previewUrl, { shouldDirty: true });
  }

  async function submitImport(values: ImportForm, duplicateConfirmed = false) {
    if (!parsed) return;
    if (parsed.is_update && !duplicateConfirmed) {
      setDuplicateConfirmOpen(true);
      return;
    }

    setDuplicateConfirmOpen(false);
    setSubmitting(true);
    try {
      let logo = values.logo || undefined;
      if (logoFile) {
        setLogoUploading(true);
        try {
          const uploaded = await capabilities.uploadPublicImage(logoFile);
          logo = uploaded.path;
        } catch (error) {
          toast.error(
            (error as { message?: string } | null)?.message ||
              t("officialMarketplace.skillImport.logoUploadFailed"),
          );
          return;
        } finally {
          setLogoUploading(false);
        }
      }
      const result = await officialMarketplace.importOfficialSkill({
        import_token: parsed.import_token,
        version: values.version.trim(),
        name_i18n: { default: values.nameEn.trim(), zh_CN: values.nameZh.trim(), en_US: values.nameEn.trim() },
        description_i18n: { default: values.descriptionEn.trim(), zh_CN: values.descriptionZh.trim(), en_US: values.descriptionEn.trim() },
        source_i18n: { default: t("officialMarketplace.skillImport.defaultSource"), zh_CN: t("officialMarketplace.skillImport.defaultSource"), en_US: "Official Skill" },
        logo,
        category_ids: values.categoryIds,
        publish_status: "PUBLISHED",
        is_hidden: values.hidden,
        is_featured: values.featured,
        sort_order: Math.max(0, Math.trunc(values.sortOrder || 0)),
      });
      await onSuccess?.(result);
      toast.success(t("officialMarketplace.skillImport.message.success"));
      onCancel();
    } catch (error) {
      toast.error((error as { message?: string } | null)?.message || t("officialMarketplace.skillImport.importFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog onOpenChange={(nextOpen) => !nextOpen && !submitting && onCancel()} open={open}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]" data-testid="platform-official-marketplace-dialog-content" closeButtonTestId="official-skill-import-dialog-close-button">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle>{t("officialMarketplace.skillImport.title")}</DialogTitle>
            <DialogDescription>{t("officialMarketplace.skillImport.description")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={handleSubmit((values) => submitImport(values))}
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div className="rounded-lg border border-dashed bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileArchive className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium">{t("officialMarketplace.skillImport.upload.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("officialMarketplace.skillImport.upload.hint")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input data-testid="platform-marketplace-skill-name-input"
                    accept={archiveAccept}
                    className="hidden"
                    onChange={(event) => {
                      void processArchive(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                  <input data-testid="platform-marketplace-skill-slug-input"
                    className="hidden"
                    onChange={(event) => {
                      void handleFolderChange(event.target.files);
                      event.target.value = "";
                    }}
                    ref={folderInputRef}
                    type="file"
                    {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  />
                  <Button disabled={processing || submitting} onClick={() => fileInputRef.current?.click()} type="button" data-testid="platform-official-marketplace-save-button">
                    {processing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                    {t("officialMarketplace.skillImport.upload.chooseFile")}
                  </Button>
                  <Button disabled={processing || submitting} onClick={() => folderInputRef.current?.click()} type="button" variant="outline" data-testid="platform-official-marketplace-save-button">
                    <FolderOpen className="size-4" aria-hidden="true" />
                    {t("officialMarketplace.skillImport.upload.chooseFolder")}
                  </Button>
                </div>
              </div>
            </div>

            {parsed ? (
              <div className="grid gap-4">
                {parsed.is_update ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{t("officialMarketplace.skillImport.duplicateDescription")}</span>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <DialogFormField fieldId="official-skill-name-zh" label={t("officialMarketplace.skillImport.field.nameZh")} required>
                    <Input
                      aria-invalid={Boolean(formState.errors.nameZh)}
                      data-testid="platform-official-marketplace-official-skill-name-zh-input"
                      id="official-skill-name-zh"
                      {...register("nameZh")} />
                    <FieldError message={formState.errors.nameZh?.message} />
                  </DialogFormField>
                  <DialogFormField fieldId="official-skill-name-en" label={t("officialMarketplace.skillImport.field.nameEn")} required>
                    <Input
                      aria-invalid={Boolean(formState.errors.nameEn)}
                      data-testid="platform-official-marketplace-official-skill-name-en-input"
                      id="official-skill-name-en"
                      {...register("nameEn")} />
                    <FieldError message={formState.errors.nameEn?.message} />
                  </DialogFormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DialogFormField fieldId="official-skill-description-zh" label={t("officialMarketplace.skillImport.field.descriptionZh")} required>
                    <Textarea
                      aria-invalid={Boolean(formState.errors.descriptionZh)}
                      data-testid="platform-official-marketplace-official-skill-description-zh-input"
                      id="official-skill-description-zh"
                      {...register("descriptionZh")} />
                    <FieldError message={formState.errors.descriptionZh?.message} />
                  </DialogFormField>
                  <DialogFormField fieldId="official-skill-description-en" label={t("officialMarketplace.skillImport.field.descriptionEn")} required>
                    <Textarea
                      aria-invalid={Boolean(formState.errors.descriptionEn)}
                      data-testid="platform-official-marketplace-official-skill-description-en-input"
                      id="official-skill-description-en"
                      {...register("descriptionEn")} />
                    <FieldError message={formState.errors.descriptionEn?.message} />
                  </DialogFormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DialogFormField fieldId="official-skill-version" label={t("officialMarketplace.skillImport.field.version")} required>
                    <Input
                      aria-invalid={Boolean(formState.errors.version)}
                      data-testid="platform-official-marketplace-official-skill-version-input"
                      id="official-skill-version"
                      {...register("version")} />
                    <FieldError message={formState.errors.version?.message} />
                  </DialogFormField>
                  <DialogFormField fieldId="official-skill-category" label={t("officialMarketplace.skillImport.field.category")}>
                    <Controller
                      control={control}
                      name="categoryIds"
                      render={({ field }) => (
                        <SearchableMultiSelect
                          ariaLabel={t("officialMarketplace.skillImport.field.category")}
                          clearLabel={t("common.clear")}
                          disabled={submitting}
                          emptyLabel={t("officialMarketplace.filter.uncategorized")}
                          isLoading={categoriesLoading}
                          maxVisibleItems={2}
                          noMatchingLabel={t("officialMarketplace.filter.noMatchingCategories")}
                          onChange={field.onChange}
                          options={categoryOptions}
                          searchPlaceholder={t("officialMarketplace.filter.searchCategories")}
                          clearButtonTestId="platform-official-marketplace-dialog-select-clear-button"
                          selectedCountLabel={(count) =>
			t("officialMarketplace.filter.selectedCategoryCount", { count })}
                          value={field.value}
                         triggerTestId="platform-official-marketplace-multi-select-trigger" contentTestId="platform-official-marketplace-multi-select-content" searchInputTestId="platform-official-marketplace-multi-select-search-input" searchClearButtonTestId="platform-official-marketplace-multi-select-search-clear-button" optionTestId="platform-official-marketplace-multi-select-option" loadingTestId="platform-official-marketplace-multi-select-loading" emptyTestId="platform-official-marketplace-multi-select-empty"/>
                      )}
                    />
                  </DialogFormField>
                </div>
                <DialogFormField fieldId="official-skill-logo" label={t("officialMarketplace.skillImport.field.logo")}>
                  <div className="flex items-center gap-3">
                    <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                      {formValues.logoPreview ? <img alt="" className="size-full object-cover" src={formValues.logoPreview} /> : <Upload className="size-5 text-muted-foreground" aria-hidden="true" />}
                    </div>
                    <input data-testid="platform-marketplace-skill-description-input"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        void handleLogoChange(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      id="official-skill-logo"
                      type="file"
                    />
                    <Button disabled={logoUploading || submitting} onClick={() => document.getElementById("official-skill-logo")?.click()} type="button" variant="outline" data-testid="platform-official-marketplace-save-button">
                      {logoUploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                      {t("officialMarketplace.skillImport.field.uploadLogo")}
                    </Button>
                  </div>
                </DialogFormField>
                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex items-center gap-2 text-sm">
                    <Controller
                      control={control}
                      name="featured"
                      render={({ field }) => <Switch checked={field.value} data-testid="platform-official-marketplace-switch" disabled={submitting} onCheckedChange={field.onChange} />}
                    />
                    {t("officialMarketplace.skillImport.field.featured")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Controller
                      control={control}
                      name="hidden"
                      render={({ field }) => <Switch checked={field.value} data-testid="platform-official-marketplace-switch" disabled={submitting} onCheckedChange={field.onChange} />}
                    />
                    {t("officialMarketplace.skillImport.field.hidden")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    {t("officialMarketplace.skillImport.field.sortOrder")}
                    <Input
                      className="h-8 w-24"
                      data-testid="platform-official-marketplace-input"
                      min={0}
                      type="number"
                      {...register("sortOrder", {
                        setValueAs: (value) => (value === "" ? 0 : Number(value)),
                      })} />
                  </label>
                </div>
              </div>
            ) : null}
            </div>
            <DialogFooter className="border-t px-5 py-4">
              <Button data-testid="platform-official-marketplace-cancel-button" disabled={submitting} onClick={onCancel} type="button" variant="outline">{t("officialMarketplace.skillImport.cancel")}</Button>
              <Button disabled={!parsed || processing || submitting || logoUploading} type="submit" data-testid="platform-official-marketplace-save-button">
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {t("officialMarketplace.skillImport.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDuplicateConfirmOpen} open={duplicateConfirmOpen}>
        <DialogContent className="sm:max-w-md" data-testid="platform-official-marketplace-dialog-content" closeButtonTestId="official-skill-import-dialog-close-button">
          <DialogHeader>
            <DialogTitle>{t("officialMarketplace.skillImport.duplicateTitle")}</DialogTitle>
            <DialogDescription>{t("officialMarketplace.skillImport.duplicateDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button data-testid="platform-official-marketplace-cancel-button" onClick={clearSelectedFile} type="button" variant="outline">{t("officialMarketplace.skillImport.duplicateCancel")}</Button>
            <Button
              data-testid="platform-official-marketplace-save-button"
              onClick={() => void handleSubmit((values) => submitImport(values, true))()}
              type="button">
              {t("officialMarketplace.skillImport.duplicateContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

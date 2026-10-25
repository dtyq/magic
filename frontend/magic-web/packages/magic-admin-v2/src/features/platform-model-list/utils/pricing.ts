import type {
  ProviderModelBillingTier,
  ProviderModelConfig,
  ProviderModelLegacyPricingConfig,
  ProviderModelPricingEntry,
  ProviderModelPricingMode,
  ProviderModelPricingTemplate,
} from "@magic-admin-v2/features/platform-model-list/types";

export const textTokenBillingObjects = [
  "input_token",
  "output_token",
  "cache_write_token",
  "cache_hit_token",
] as const;

const textTokenCostToPriceObject: Record<string, TextTokenBillingObject> = {
  input_cost: "input_token",
  output_cost: "output_token",
  cache_write_cost: "cache_write_token",
  cache_hit_cost: "cache_hit_token",
};

type TextTokenBillingObject = (typeof textTokenBillingObjects)[number];

const legacyTextPricingFields: Record<
  TextTokenBillingObject,
  { price: keyof ProviderModelLegacyPricingConfig; cost: keyof ProviderModelLegacyPricingConfig }
> = {
  input_token: { price: "input_pricing", cost: "input_cost" },
  output_token: { price: "output_pricing", cost: "output_cost" },
  cache_write_token: { price: "cache_write_pricing", cost: "cache_write_cost" },
  cache_hit_token: { price: "cache_hit_pricing", cost: "cache_hit_cost" },
};

export type PricingTemplateRow = {
  key: string;
  label: string;
  price?: {
    billingObject: string;
    label: string;
  };
  cost?: {
    billingObject: string;
    label: string;
  };
};

function isCostBillingObject(value: string) {
  return value.endsWith("_cost") || value.endsWith(".cost");
}

function hasPricingValue(value: number | null | undefined) {
  return value !== null && value !== undefined;
}

function normalizeLegacyPricingValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return value === null ? null : undefined;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

export function extractLegacyPricingConfig(
  config: ProviderModelConfig,
): ProviderModelLegacyPricingConfig {
  return {
    input_pricing: normalizeLegacyPricingValue(config.input_pricing),
    output_pricing: normalizeLegacyPricingValue(config.output_pricing),
    cache_write_pricing: normalizeLegacyPricingValue(config.cache_write_pricing),
    cache_hit_pricing: normalizeLegacyPricingValue(config.cache_hit_pricing),
    input_cost: normalizeLegacyPricingValue(config.input_cost),
    output_cost: normalizeLegacyPricingValue(config.output_cost),
    cache_write_cost: normalizeLegacyPricingValue(config.cache_write_cost),
    cache_hit_cost: normalizeLegacyPricingValue(config.cache_hit_cost),
    time_pricing: normalizeLegacyPricingValue(config.time_pricing),
    time_cost: normalizeLegacyPricingValue(config.time_cost),
    second_pricing: normalizeLegacyPricingValue(config.second_pricing),
    second_cost: normalizeLegacyPricingValue(config.second_cost),
  };
}

export function hasLegacyPricing(
  config?: ProviderModelLegacyPricingConfig | null,
) {
  return Object.values(config ?? {}).some((value) => hasPricingValue(value));
}

function getPricingRowKey(value: string) {
  if (textTokenCostToPriceObject[value]) {
    return textTokenCostToPriceObject[value];
  }

  return value.replace(/(_cost|\.cost)$/, "");
}

function toTextTokenBillingObject(value: string): TextTokenBillingObject | undefined {
  return textTokenBillingObjects.includes(value as TextTokenBillingObject)
    ? (value as TextTokenBillingObject)
    : undefined;
}

function getTextTokenBase(value: string) {
  return toTextTokenBillingObject(getPricingRowKey(value));
}

function isPricingMode(value: string): value is ProviderModelPricingMode {
  return value === "fixed" || value === "ladder" || Boolean(toTextTokenBillingObject(value));
}

function getCostBillingObject(template: ProviderModelPricingTemplate, base: TextTokenBillingObject) {
  return template.items.find((item) => getPricingRowKey(item.billing_object) === base && isCostBillingObject(item.billing_object))
    ?.billing_object;
}

function getBillingObjectForDimension(
  template: ProviderModelPricingTemplate,
  currentBillingObject: string,
  sourceBase: TextTokenBillingObject,
) {
  return isCostBillingObject(currentBillingObject)
    ? getCostBillingObject(template, sourceBase)
    : sourceBase;
}

export function isTextTokenPricingTemplate(template?: ProviderModelPricingTemplate) {
  if (!template) {
    return false;
  }

  return textTokenBillingObjects.every((base) =>
    template.items.some((item) => item.billing_object === base) &&
    Boolean(getCostBillingObject(template, base)),
  );
}

export function getPricingTemplateRows(template?: ProviderModelPricingTemplate) {
  if (!template) {
    return [];
  }

  const rows = new Map<string, PricingTemplateRow>();

  for (const item of template.items) {
    const key = getPricingRowKey(item.billing_object);
    const row = rows.get(key) ?? {
      key,
      label: item.label,
    };

    if (isCostBillingObject(item.billing_object)) {
      row.cost = {
        billingObject: item.billing_object,
        label: item.label,
      };
    } else {
      row.label = item.label;
      row.price = {
        billingObject: item.billing_object,
        label: item.label,
      };
    }

    rows.set(key, row);
  }

  return Array.from(rows.values());
}

export function createPricingEntries(template?: ProviderModelPricingTemplate): Record<string, ProviderModelPricingEntry> {
  if (!template) {
    return {};
  }

  return Object.fromEntries(
    template.items.map((item) => [
      item.billing_object,
      {
        enabled: true,
        mode: "fixed",
        value: "",
        steps: [],
      },
    ]),
  );
}

export function createEmptyPricingEntry(): ProviderModelPricingEntry {
  return {
    enabled: true,
    mode: "fixed",
    value: "",
    steps: [],
  };
}

export function isCostPricingObject(billingObject: string) {
  return billingObject.endsWith("_cost") || billingObject.endsWith(".cost");
}

export function getDefaultLadderSteps() {
  return [
    { max: "32", price: "1" },
    { max: "128", price: "1" },
    { max: "", price: "1" },
  ];
}

export function buildIndependentPricingSteps(
  currentSteps: ProviderModelPricingEntry["steps"],
  sourceSteps: ProviderModelPricingEntry["steps"] = [],
) {
  if (currentSteps.some((step) => step.max.trim())) {
    return currentSteps;
  }

  if (sourceSteps.length) {
    return sourceSteps.map((step, index) => ({
      max: step.max,
      price: currentSteps[index]?.price ?? "",
    }));
  }

  return getDefaultLadderSteps();
}

export function createPricingEntriesFromBillingTiers(
  template: ProviderModelPricingTemplate,
  billingTiers: ProviderModelBillingTier[] | null | undefined,
): Record<string, ProviderModelPricingEntry> {
  const tiersByBillingObject = new Map(
    (billingTiers ?? []).map((tier) => [tier.billing_object, tier]),
  );

  return Object.fromEntries(
    template.items.map((item) => {
      const tier = tiersByBillingObject.get(item.billing_object);
      if (!tier) {
        return [item.billing_object, { enabled: false, mode: "fixed", value: "", steps: [] }];
      }

      if (tier.pricing_mode === "fixed") {
        return [
          item.billing_object,
          {
            enabled: true,
            mode: "fixed",
            value: tier.pricing_rules[0] ? String(tier.pricing_rules[0].price) : "",
            steps: [],
          },
        ];
      }

      const isFollowingAnotherObject = tier.follow_object && tier.follow_object !== item.billing_object;
      const followBase = isFollowingAnotherObject
        ? getTextTokenBase(tier.follow_object)
        : undefined;

      return [
        item.billing_object,
        {
          enabled: true,
          mode: followBase ?? "ladder",
          value: "",
          steps: tier.pricing_rules.map((rule) => ({
            max: followBase ? "" : rule.max === null ? "" : String(rule.max),
            price: String(rule.price),
          })),
        },
      ];
    }),
  );
}

export function normalizeLegacyBillingType(billingType: string | null | undefined, category?: string) {
  if (billingType === "Tokens") {
    return category === "vlm" ? "ImageTokens" : "TextTokens";
  }
  if (billingType === "Times") {
    return "ImageCount";
  }
  if (billingType === "Per_Second") {
    return "VideoResolutionDuration";
  }
  return billingType;
}

function getLegacyGenericPricingValue(
  config: ProviderModelLegacyPricingConfig,
  dimension: "price" | "cost",
  billingType?: string | null,
  category?: string,
) {
  const normalizedType = normalizeLegacyBillingType(billingType, category);

  if (normalizedType === "ImageCount") {
    return dimension === "price" ? config.time_pricing : config.time_cost;
  }

  if (normalizedType === "ImageTokens" || normalizedType === "ImageTokensWithThought") {
    return dimension === "price" ? config.output_pricing : config.output_cost;
  }

  if (
    normalizedType === "VideoResolutionDuration" ||
    normalizedType === "KelingVideoResolutionMediaConditionDurationPricing"
  ) {
    return dimension === "price" ? config.second_pricing : config.second_cost;
  }

  return undefined;
}

function getLegacyTextPricingValue(
  config: ProviderModelLegacyPricingConfig,
  billingObject: string,
) {
  const base = getTextTokenBase(billingObject);
  if (!base) {
    return undefined;
  }

  const field = legacyTextPricingFields[base];
  return config[field[isCostBillingObject(billingObject) ? "cost" : "price"]];
}

/** 将历史扁平定价字段回填为新版定价表单项。 */
export function createPricingEntriesFromLegacyPricing(
  template: ProviderModelPricingTemplate,
  config: ProviderModelLegacyPricingConfig,
  billingType?: string | null,
  category?: string,
): Record<string, ProviderModelPricingEntry> {
  const supportsTextTokenModes = isTextTokenPricingTemplate(template);

  return Object.fromEntries(
    template.items.map((item) => {
      const value = supportsTextTokenModes
        ? getLegacyTextPricingValue(config, item.billing_object)
        : getLegacyGenericPricingValue(config, isCostBillingObject(item.billing_object) ? "cost" : "price", billingType, category);
      const enabled = hasPricingValue(value);

      return [
        item.billing_object,
        {
          enabled,
          mode: "fixed",
          value: enabled ? String(value) : "",
          steps: [],
        },
      ];
    }),
  );
}

export function getFollowSourceBillingObject(
  template: ProviderModelPricingTemplate,
  billingObject: string,
  mode: ProviderModelPricingMode,
) {
  const sourceBase = toTextTokenBillingObject(mode);
  return sourceBase ? getBillingObjectForDimension(template, billingObject, sourceBase) : undefined;
}

export function normalizeDependentPricingEntries(
  template: ProviderModelPricingTemplate,
  entries: Record<string, ProviderModelPricingEntry>,
) {
  return Object.fromEntries(
    Object.entries(entries).map(([billingObject, entry]) => {
      const followsAnotherObject = entry.mode !== "fixed" && entry.mode !== "ladder";
      const isTextTokenEntry = textTokenBillingObjects.some((base) =>
        Boolean(getFollowSourceBillingObject(template, billingObject, base)),
      );
      if (!followsAnotherObject || !isTextTokenEntry) {
        return [billingObject, entry];
      }

      const finalSource = resolveFinalFollowSource(template, billingObject, entries);
      if (finalSource) {
        const sourceSteps = entries[finalSource]?.steps ?? [];
        const needsStepSync = entry.steps.length !== sourceSteps.length;
        return [
          billingObject,
          needsStepSync
            ? {
                ...entry,
                steps: sourceSteps.map((_, index) => ({
                  max: "",
                  price: entry.steps[index]?.price ?? "",
                })),
              }
            : entry,
        ];
      }

      const directSource = getFollowSourceBillingObject(template, billingObject, entry.mode);
      return [
        billingObject,
        {
          ...entry,
          mode: "ladder" as const,
          steps: buildIndependentPricingSteps(entry.steps, directSource ? entries[directSource]?.steps : []),
        },
      ];
    }),
  ) as Record<string, ProviderModelPricingEntry>;
}

export function resolveFinalFollowSource(
  template: ProviderModelPricingTemplate,
  billingObject: string,
  entries: Record<string, ProviderModelPricingEntry>,
  visited = new Set<string>(),
): string | undefined {
  if (visited.has(billingObject)) {
    return undefined;
  }
  visited.add(billingObject);

  const entry = entries[billingObject];
  if (!entry?.enabled || entry.mode === "fixed") {
    return undefined;
  }
  if (entry.mode === "ladder") {
    return billingObject;
  }

  const source = getFollowSourceBillingObject(template, billingObject, entry.mode);
  return source ? resolveFinalFollowSource(template, source, entries, visited) : undefined;
}

function buildFixedRules(value: string) {
  if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) {
    return [];
  }

  return [{ min: null, max: null, price: Number(value) }];
}

function buildLadderRules(steps: ProviderModelPricingEntry["steps"]) {
  if (!steps.length) {
    return [];
  }

  return steps.flatMap((step, index) => {
    if (!step.price.trim() || !Number.isFinite(Number(step.price)) || Number(step.price) < 0) {
      return [];
    }

    const previousMax = index === 0 ? 0 : Number(steps[index - 1]?.max);
    const isLast = index === steps.length - 1;
    const max = step.max.trim();
    if (!isLast && (!max || !Number.isFinite(Number(max)) || Number(max) <= previousMax)) {
      return [];
    }

    return [{
      min: index === 0 ? 0 : previousMax,
      max: isLast ? null : Number(max),
      price: Number(step.price),
    }];
  });
}

function buildFollowRules(
  sourceEntry: ProviderModelPricingEntry | undefined,
  currentEntry: ProviderModelPricingEntry,
) {
  if (!sourceEntry || sourceEntry.mode !== "ladder" || sourceEntry.steps.length !== currentEntry.steps.length) {
    return [];
  }

  return currentEntry.steps.flatMap((step, index) => {
    const sourceStep = sourceEntry.steps[index];
    if (!step.price.trim() || !Number.isFinite(Number(step.price)) || Number(step.price) < 0) {
      return [];
    }

    return [{
      min: index === 0 ? 0 : Number(sourceEntry.steps[index - 1]?.max),
      max: index === sourceEntry.steps.length - 1 ? null : Number(sourceStep?.max),
      price: Number(step.price),
    }];
  });
}

function hasValidPrice(value: string) {
  return Boolean(value.trim()) && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function validatePricingEntries(
  template: ProviderModelPricingTemplate | null,
  entries: Record<string, ProviderModelPricingEntry>,
): { billingObject: string; label: string } | undefined {
  if (!template) {
    return undefined;
  }

  for (const item of template.items) {
    const entry = entries[item.billing_object];
    if (!entry?.enabled) {
      continue;
    }

    const supportsTokenModes = isTextTokenPricingTemplate(template) && Boolean(getTextTokenBase(item.billing_object));
    if (!supportsTokenModes || entry.mode === "fixed") {
      if (!hasValidPrice(entry.value)) {
        return { billingObject: item.billing_object, label: item.label };
      }
      continue;
    }

    if (entry.mode === "ladder") {
      if (!entry.steps.length) {
        return { billingObject: item.billing_object, label: item.label };
      }

      let previousMax = 0;
      for (const [stepIndex, step] of entry.steps.entries()) {
        if (!hasValidPrice(step.price)) {
          return { billingObject: item.billing_object, label: item.label };
        }

        if (stepIndex < entry.steps.length - 1) {
          if (!step.max.trim() || !Number.isFinite(Number(step.max)) || Number(step.max) <= previousMax) {
            return { billingObject: item.billing_object, label: item.label };
          }
          previousMax = Number(step.max);
        }
      }
      continue;
    }

    const sourceBillingObject = resolveFinalFollowSource(template, item.billing_object, entries);
    const sourceSteps = sourceBillingObject ? entries[sourceBillingObject]?.steps : undefined;
    if (!sourceBillingObject || !sourceSteps?.length || sourceSteps.length !== entry.steps.length) {
      return { billingObject: item.billing_object, label: item.label };
    }
    if (entry.steps.some((step) => !hasValidPrice(step.price))) {
      return { billingObject: item.billing_object, label: item.label };
    }
  }

  return undefined;
}

export function buildPricingBillingTiers(
  template: ProviderModelPricingTemplate | undefined,
  entries: Record<string, ProviderModelPricingEntry>,
): ProviderModelBillingTier[] {
  if (!template) {
    return [];
  }

  return template.items.reduce<ProviderModelBillingTier[]>((tiers, item) => {
    const entry = entries[item.billing_object];
    if (!entry?.enabled) {
      return tiers;
    }

    if (!isTextTokenPricingTemplate(template) || !getTextTokenBase(item.billing_object)) {
      const fixedRules = buildFixedRules(entry.value);
      if (fixedRules.length) {
        tiers.push({
            billing_object: item.billing_object,
            follow_object: item.billing_object,
            pricing_mode: "fixed",
            pricing_rules: fixedRules,
        });
      }
      return tiers;
    }

    if (entry.mode === "fixed") {
      const fixedRules = buildFixedRules(entry.value);
      if (fixedRules.length) {
        tiers.push({
            billing_object: item.billing_object,
            follow_object: item.billing_object,
            pricing_mode: "fixed",
            pricing_rules: fixedRules,
        });
      }
      return tiers;
    }

    if (entry.mode === "ladder") {
      const ladderRules = buildLadderRules(entry.steps);
      if (ladderRules.length === entry.steps.length) {
        tiers.push({
            billing_object: item.billing_object,
            follow_object: item.billing_object,
            pricing_mode: "tiered",
            pricing_rules: ladderRules,
        });
      }
      return tiers;
    }

    if (!isPricingMode(entry.mode)) {
      return tiers;
    }

    const sourceBillingObject = resolveFinalFollowSource(template, item.billing_object, entries);
    const sourceEntry = sourceBillingObject ? entries[sourceBillingObject] : undefined;
    const followRules = buildFollowRules(sourceEntry, entry);
    if (followRules.length === entry.steps.length && sourceBillingObject) {
      tiers.push({
          billing_object: item.billing_object,
          follow_object: sourceBillingObject,
          pricing_mode: "tiered",
          pricing_rules: followRules,
      });
    }
    return tiers;
  }, []);
}

/**
 * Resolve one provider's pricing to the canonical billing_tiers payload.
 * A non-empty billing_tiers array is authoritative; legacy fields are only
 * used when the record has no new-format pricing at all.
 */
export function resolveCanonicalBillingTiers(
  config: ProviderModelConfig,
  template: ProviderModelPricingTemplate | null | undefined,
  category?: string,
): ProviderModelBillingTier[] | null | undefined {
  if (config.billing_tiers?.length) {
    return config.billing_tiers;
  }

  const legacyPricing = extractLegacyPricingConfig(config);
  if (!hasLegacyPricing(legacyPricing)) {
    return null;
  }

  if (!template) {
    return undefined;
  }

  const entries = createPricingEntriesFromLegacyPricing(
    template,
    legacyPricing,
    config.billing_type,
    category,
  );
  const billingTiers = buildPricingBillingTiers(template, entries);
  return billingTiers.length ? billingTiers : undefined;
}

export type PricingUnit = "perImage" | "perSecond" | "millionTokens";

/**
 * Resolve the display unit for one pricing item.
 *
 * A template can contain mixed billing objects (notably video token + duration
 * matrices), so billing_type alone is not sufficient here. Keep the legacy
 * item name/category first, then use the billing type as the fallback for
 * templates whose billing objects do not encode their dimension.
 */
export function getPricingUnit(
  billingType: string,
  category?: string,
  billingObject?: string,
): PricingUnit {
  const normalizedType = billingType.toLowerCase();
  const normalizedObject = billingObject?.toLowerCase() ?? "";

  if (
    normalizedObject.includes("duration") ||
    normalizedObject.includes("second") ||
    normalizedType.includes("duration") ||
    normalizedType.includes("per_second")
  ) {
    return "perSecond";
  }

  if (
    normalizedObject.includes("count") ||
    normalizedObject.includes("image") && !normalizedObject.includes("token") ||
    normalizedType.includes("imagecount") ||
    normalizedType.includes("seedream") ||
    category === "vlm" && !normalizedObject.includes("token") && !normalizedObject.includes("thought")
  ) {
    return "perImage";
  }

  return "millionTokens";
}

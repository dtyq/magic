<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

class ProviderModelPricingTemplateAppService
{
    private const CONFIG_KEY = 'provider_model_pricing_templates';

    private const OFFICIAL_PRICING_CONFIG_KEY = 'provider_model_official_pricing';

    public function __construct(
        private readonly ?array $templatesConfig = null,
        private readonly ?array $officialPricingConfig = null,
    ) {
    }

    public function queries(
        Category $category,
        ProviderCode $providerCode,
        ?string $modelId = null,
        bool $includeOfficialPricing = false
    ): array {
        $config = $this->getTemplatesConfig();
        $templateCodes = $this->resolveTemplateCodes($config, $category, $providerCode);
        if ($templateCodes === []) {
            return [];
        }

        $templates = $this->indexTemplatesByCode($config['templates'] ?? []);
        $result = [];
        foreach ($templateCodes as $templateCode) {
            $template = $templates[$templateCode] ?? null;
            if (($template['category'] ?? null) !== $category->value) {
                continue;
            }
            $result[] = $template;
        }

        if (! $includeOfficialPricing || $modelId === null || trim($modelId) === '') {
            return $result;
        }

        return $this->appendOfficialPricing($result, $category, $providerCode, trim($modelId));
    }

    private function getTemplatesConfig(): array
    {
        return $this->templatesConfig ?? config(self::CONFIG_KEY, []);
    }

    private function getOfficialPricingConfig(): array
    {
        return $this->officialPricingConfig ?? config(self::OFFICIAL_PRICING_CONFIG_KEY, []);
    }

    private function resolveTemplateCodes(array $config, Category $category, ProviderCode $providerCode): array
    {
        foreach ($config['provider_templates'] ?? [] as $providerTemplate) {
            if (($providerTemplate['provider_code'] ?? null) !== $providerCode->value) {
                continue;
            }
            if (($providerTemplate['category'] ?? null) !== $category->value) {
                continue;
            }

            return $providerTemplate['template_codes'] ?? [];
        }

        return $config['defaults'][$category->value] ?? [];
    }

    private function indexTemplatesByCode(array $templates): array
    {
        $indexedTemplates = [];
        foreach ($templates as $template) {
            $code = $template['code'] ?? null;
            if (! is_string($code) || $code === '') {
                continue;
            }
            $indexedTemplates[$code] = $template;
        }

        return $indexedTemplates;
    }

    private function appendOfficialPricing(
        array $templates,
        Category $category,
        ProviderCode $providerCode,
        string $modelId
    ): array {
        $officialPricing = $this->resolveOfficialPricing($category, $providerCode, $modelId);
        if ($officialPricing === null) {
            return $templates;
        }

        foreach ($templates as $templateIndex => $template) {
            $hasOfficialPrice = false;
            foreach ($template['items'] ?? [] as $itemIndex => $item) {
                $billingObject = $item['billing_object'] ?? null;
                if (! is_string($billingObject) || ! isset($officialPricing['items'][$billingObject])) {
                    continue;
                }

                $templates[$templateIndex]['items'][$itemIndex]['official_price'] = $officialPricing['items'][$billingObject];
                $templates[$templateIndex]['items'][$itemIndex]['official_currency'] = $officialPricing['currency'];
                $hasOfficialPrice = true;
            }

            if ($hasOfficialPrice) {
                $templates[$templateIndex]['official_currency'] = $officialPricing['currency'];
            }
        }

        return $templates;
    }

    /**
     * @return null|array{currency: string, items: array<string, string>}
     */
    private function resolveOfficialPricing(Category $category, ProviderCode $providerCode, string $modelId): ?array
    {
        $config = $this->getOfficialPricingConfig();
        $result = null;

        foreach ($config['prices'] ?? [] as $pricingGroup) {
            if (! is_array($pricingGroup)) {
                continue;
            }

            if (($pricingGroup['provider_code'] ?? null) !== $providerCode->value) {
                continue;
            }
            if (($pricingGroup['category'] ?? null) !== $category->value) {
                continue;
            }
            if (! $this->matchesModelId($pricingGroup, $modelId)) {
                continue;
            }

            $currency = (string) ($pricingGroup['currency'] ?? '');
            foreach ($pricingGroup['items'] ?? [] as $billingObject => $pricing) {
                if (! is_string($billingObject) || ! is_array($pricing)) {
                    continue;
                }

                $price = $pricing['price'] ?? null;
                if ($price === null || $price === '') {
                    continue;
                }

                $result ??= [
                    'currency' => $currency,
                    'items' => [],
                ];
                $result['items'][$billingObject] = (string) $price;
            }
        }

        return $result;
    }

    private function matchesModelId(array $pricingGroup, string $modelId): bool
    {
        $modelIds = $pricingGroup['model_ids'] ?? [];
        if (! is_array($modelIds)) {
            $modelIds = [];
        }
        if (isset($pricingGroup['model_id'])) {
            $modelIds[] = $pricingGroup['model_id'];
        }

        foreach ($modelIds as $candidateModelId) {
            if (trim((string) $candidateModelId) === $modelId) {
                return true;
            }
        }

        return false;
    }
}

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

    public function __construct(
        private readonly ?array $templatesConfig = null,
    ) {
    }

    public function queries(Category $category, ProviderCode $providerCode): array
    {
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

        return $result;
    }

    private function getTemplatesConfig(): array
    {
        return $this->templatesConfig ?? config(self::CONFIG_KEY, []);
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
}

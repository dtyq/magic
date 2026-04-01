<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\VideoCatalog\Service;

use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogModelDefinition;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogProviderDefinition;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Database\Model\Builder;

readonly class VideoCatalogQueryDomainService
{
    private const string CATEGORY = 'vgm';

    public static function canonicalModelId(string $modelId): string
    {
        $normalized = trim($modelId);
        if ($normalized === '') {
            return '';
        }

        /** @var list<ProviderModelModel> $providerModels */
        $providerModels = ProviderModelModel::query()
            ->whereNull('deleted_at')
            ->where('status', 1)
            ->where('organization_code', OfficialOrganizationUtil::getOfficialOrganizationCode())
            ->where('category', self::CATEGORY)
            ->where(function (Builder $query) use ($normalized): void {
                $query->where('model_id', $normalized)
                    ->orWhere('model_version', $normalized);
            })
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->all();

        if ($providerModels === []) {
            return $normalized;
        }

        return $providerModels[0]->model_id;
    }

    /**
     * @return VideoCatalogProviderDefinition[]
     */
    public function getProviders(): array
    {
        [$providersById, $providerConfigsByProviderId] = $this->loadVideoProviderContext();

        $definitions = [];
        foreach ($providersById as $providerId => $provider) {
            $providerConfigs = $providerConfigsByProviderId[$providerId] ?? [];
            if ($providerConfigs === []) {
                continue;
            }

            $definitions[] = $this->buildProviderDefinition($provider, $providerConfigs[0]);
        }

        return $definitions;
    }

    public function getProviderTemplate(string $configId): ?VideoCatalogProviderDefinition
    {
        [$providersById, , $providerConfigsById] = $this->loadVideoProviderContext();
        $providerConfig = $providerConfigsById[(int) $configId] ?? null;
        if (! $providerConfig instanceof ProviderConfigModel) {
            return null;
        }

        $provider = $providersById[$providerConfig->service_provider_id] ?? null;
        if (! $provider instanceof ProviderModel) {
            return null;
        }

        return $this->buildProviderDefinition($provider, $providerConfig);
    }

    /**
     * @return VideoCatalogModelDefinition[]
     */
    public function getModels(): array
    {
        [$providersById, , $providerConfigsById] = $this->loadVideoProviderContext();
        if ($providerConfigsById === []) {
            return [];
        }

        /** @var list<ProviderModelModel> $models */
        $models = ProviderModelModel::query()
            ->whereNull('deleted_at')
            ->where('status', 1)
            ->where('organization_code', OfficialOrganizationUtil::getOfficialOrganizationCode())
            ->where('category', self::CATEGORY)
            ->whereIn('service_provider_config_id', array_keys($providerConfigsById))
            ->get()
            ->all();

        /** @var array<string, array{model: ProviderModelModel, providerConfig: ProviderConfigModel, providerCode: string}> $selectedModels */
        $selectedModels = [];
        foreach ($models as $model) {
            $providerConfig = $providerConfigsById[$model->service_provider_config_id] ?? null;
            if (! $providerConfig instanceof ProviderConfigModel) {
                continue;
            }

            $provider = $providersById[$providerConfig->service_provider_id] ?? null;
            if (! $provider instanceof ProviderModel) {
                continue;
            }

            $providerCode = trim($providerConfig->provider_code ?: $provider->provider_code);
            $groupKey = $providerCode . '::' . $model->model_id;
            $current = $selectedModels[$groupKey] ?? null;

            if ($current === null || $this->compareModelDisplayPriority(
                $model,
                $providerConfig,
                $current['model'],
                $current['providerConfig'],
            ) < 0) {
                $selectedModels[$groupKey] = [
                    'model' => $model,
                    'providerConfig' => $providerConfig,
                    'providerCode' => $providerCode,
                ];
            }
        }

        $definitions = [];
        foreach ($selectedModels as $selectedModel) {
            $definitions[] = $this->buildModelDefinition(
                $selectedModel['model'],
                $selectedModel['providerCode']
            );
        }

        usort($definitions, static function (VideoCatalogModelDefinition $left, VideoCatalogModelDefinition $right): int {
            if ($left->getProviderCode() !== $right->getProviderCode()) {
                return strcmp($left->getProviderCode(), $right->getProviderCode());
            }
            if ($left->getSort() !== $right->getSort()) {
                return $right->getSort() <=> $left->getSort();
            }

            return $left->getId() <=> $right->getId();
        });

        return $definitions;
    }

    /**
     * @return VideoCatalogModelDefinition[]
     */
    public function queryModels(?int $modelType = null, ?array $modelIds = null): array
    {
        $models = $this->getModels();

        if ($modelType !== null) {
            $models = array_values(array_filter(
                $models,
                static fn (VideoCatalogModelDefinition $model): bool => $model->getModelType() === $modelType
            ));
        }

        if ($modelIds !== null && $modelIds !== []) {
            $canonicalModelIds = array_map([self::class, 'canonicalModelId'], $modelIds);
            $models = array_values(array_filter(
                $models,
                static fn (VideoCatalogModelDefinition $model): bool => in_array($model->getModelId(), $canonicalModelIds, true)
            ));
        }

        return $models;
    }

    public function findModel(string $modelIdOrPrimaryId): ?VideoCatalogModelDefinition
    {
        $normalized = trim($modelIdOrPrimaryId);
        if ($normalized === '') {
            return null;
        }

        return array_find($this->getModels(), static fn (VideoCatalogModelDefinition $model): bool => $normalized === (string) $model->getId()
            || self::canonicalModelId($normalized) === $model->getModelId());
    }

    /**
     * @return array{
     *     0: array<int, ProviderModel>,
     *     1: array<int, list<ProviderConfigModel>>,
     *     2: array<int, ProviderConfigModel>
     * }
     */
    private function loadVideoProviderContext(): array
    {
        /** @var list<ProviderModel> $providers */
        $providers = ProviderModel::query()
            ->whereNull('deleted_at')
            ->where('status', 1)
            ->where('is_models_enable', 1)
            ->where('category', self::CATEGORY)
            ->orderByDesc('sort_order')
            ->orderBy('id')
            ->get()
            ->all();

        if ($providers === []) {
            return [[], [], []];
        }

        /** @var array<int, ProviderModel> $providersById */
        $providersById = [];
        foreach ($providers as $provider) {
            $providersById[$provider->id] = $provider;
        }

        /** @var list<ProviderConfigModel> $providerConfigs */
        $providerConfigs = ProviderConfigModel::query()
            ->whereNull('deleted_at')
            ->where('status', 1)
            ->where('organization_code', OfficialOrganizationUtil::getOfficialOrganizationCode())
            ->whereIn('service_provider_id', array_keys($providersById))
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->all();

        /** @var array<int, list<ProviderConfigModel>> $providerConfigsByProviderId */
        $providerConfigsByProviderId = [];
        /** @var array<int, ProviderConfigModel> $providerConfigsById */
        $providerConfigsById = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerId = $providerConfig->service_provider_id;
            $providerConfigsByProviderId[$providerId] ??= [];
            $providerConfigsByProviderId[$providerId][] = $providerConfig;
            $providerConfigsById[$providerConfig->id] = $providerConfig;
        }

        return [$providersById, $providerConfigsByProviderId, $providerConfigsById];
    }

    private function buildProviderDefinition(ProviderModel $provider, ProviderConfigModel $providerConfig): VideoCatalogProviderDefinition
    {
        $providerSeed = VideoProviderSeedResolver::providerSeedData($provider->provider_code);
        $providerConfigData = is_array($providerConfig->config) ? $providerConfig->config : [];
        $hasUrl = $this->resolveStringValue($providerConfigData, ['base_url', 'url']) !== '';
        $hasApiKey = $this->resolveStringValue($providerConfigData, ['api_key', 'apiKey']) !== '';
        $maskedConfig = $this->buildMaskedProviderConfig($hasUrl, $hasApiKey);

        return new VideoCatalogProviderDefinition(
            configId: (string) $providerConfig->id,
            serviceProviderId: $provider->id,
            name: $provider->name,
            providerCode: $provider->provider_code,
            providerType: $provider->provider_type,
            category: $provider->category,
            status: $providerConfig->status,
            icon: $provider->icon,
            description: $provider->description,
            translate: is_array($provider->translate) ? $provider->translate : ($providerSeed['translate'] ?? []),
            config: $maskedConfig,
            decryptedConfig: $maskedConfig,
            alias: $providerConfig->alias !== '' ? $providerConfig->alias : (string) ($providerSeed['alias'] ?? ''),
            remark: $provider->remark,
            sort: $provider->sort_order,
        );
    }

    private function buildModelDefinition(ProviderModelModel $model, string $providerCode): VideoCatalogModelDefinition
    {
        $pricing = $this->findCurrentPricing($model->id);
        $modelSeed = VideoProviderSeedResolver::modelSeedData($model->model_id, $providerCode)
            ?: VideoProviderSeedResolver::modelSeedData($model->model_version, $providerCode);

        return new VideoCatalogModelDefinition(
            id: $model->id,
            serviceProviderConfigId: (string) $model->service_provider_config_id,
            modelId: $model->model_id,
            name: $model->name,
            modelVersion: $model->model_version,
            description: $model->description,
            icon: $model->icon,
            modelType: $model->model_type,
            category: $model->category,
            status: $model->status,
            translate: is_array($model->translate) ? $model->translate : ($modelSeed['translate'] ?? []),
            config: $pricing,
            runtimeConfig: [],
            providerCode: $providerCode,
            sort: $model->sort,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function findCurrentPricing(int $providerModelId): array
    {
        $pricing = ProviderModelConfigVersionModel::query()
            ->where('service_provider_model_id', $providerModelId)
            ->where('is_current_version', true)
            ->orderByDesc('version')
            ->orderByDesc('id')
            ->first();

        if (! $pricing instanceof ProviderModelConfigVersionModel) {
            return [];
        }

        return [
            'billing_type' => $pricing->billing_type,
            'billing_currency' => $pricing->billing_currency,
            'time_pricing' => $this->normalizeDecimalString($pricing->time_pricing),
            'time_cost' => $this->normalizeDecimalString($pricing->time_cost),
            'input_pricing' => $this->normalizeNullableDecimalString($pricing->input_pricing),
            'output_pricing' => $this->normalizeNullableDecimalString($pricing->output_pricing),
            'cache_write_pricing' => $this->normalizeNullableDecimalString($pricing->cache_write_pricing),
            'cache_hit_pricing' => $this->normalizeNullableDecimalString($pricing->cache_hit_pricing),
            'input_cost' => $this->normalizeNullableDecimalString($pricing->input_cost),
            'output_cost' => $this->normalizeNullableDecimalString($pricing->output_cost),
            'cache_write_cost' => $this->normalizeNullableDecimalString($pricing->cache_write_cost),
            'cache_hit_cost' => $this->normalizeNullableDecimalString($pricing->cache_hit_cost),
            'official_recommended' => (int) $pricing->official_recommended,
        ];
    }

    private function compareModelDisplayPriority(
        ProviderModelModel $leftModel,
        ProviderConfigModel $leftConfig,
        ProviderModelModel $rightModel,
        ProviderConfigModel $rightConfig,
    ): int {
        if ($leftModel->status !== $rightModel->status) {
            return $rightModel->status <=> $leftModel->status;
        }
        if ($leftConfig->status !== $rightConfig->status) {
            return $rightConfig->status <=> $leftConfig->status;
        }
        if ($leftModel->sort !== $rightModel->sort) {
            return $rightModel->sort <=> $leftModel->sort;
        }
        if ($leftConfig->sort !== $rightConfig->sort) {
            return $rightConfig->sort <=> $leftConfig->sort;
        }

        return $leftModel->id <=> $rightModel->id;
    }

    /**
     * @return array{url: string, api_key: string, priority: int}
     */
    private function buildMaskedProviderConfig(bool $hasUrl, bool $hasApiKey): array
    {
        return [
            'url' => $hasUrl ? '****' : '',
            'api_key' => $hasApiKey ? '****' : '',
            'priority' => 100,
        ];
    }

    private function resolveStringValue(array $config, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $config[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    private function normalizeDecimalString(mixed $value): string
    {
        if (! is_numeric($value)) {
            return '';
        }

        $normalized = number_format((float) $value, 4, '.', '');
        return rtrim(rtrim($normalized, '0'), '.') ?: '0';
    }

    private function normalizeNullableDecimalString(mixed $value): ?string
    {
        $normalized = $this->normalizeDecimalString($value);
        return $normalized === '' ? null : $normalized;
    }
}

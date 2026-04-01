<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\VideoCatalog\Service;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use DateTimeInterface;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;
use RuntimeException;

class OfficialVideoProviderDomainService
{
    /**
     * @return array{count: int, skipped: bool, message: string}
     */
    /**
     * @param list<array<string, mixed>> $endpointSeeds
     */
    public function initialize(array $endpointSeeds, bool $skipWhenApiKeyMissing = true, bool $wrapTransaction = true): array
    {
        $callback = function () use ($skipWhenApiKeyMissing, $endpointSeeds): array {
            $count = 0;
            $skippedEndpoints = [];
            $fastPreviewProviderModelId = null;
            $fastPreviewModelIdentity = null;

            foreach (VideoProviderSeedResolver::groupNormalizedEndpointSeedData($endpointSeeds) as $providerCode => $providerGroup) {
                $providerSeed = $providerGroup['provider'];
                $providerEndpointSeeds = $providerGroup['endpoints'];
                $existingProvider = $this->findProvider($providerSeed);
                $providerConfigs = $this->loadProviderConfigs($existingProvider);
                $preparedEndpoints = [];

                foreach ($providerEndpointSeeds as $endpointSeed) {
                    $resolvedApiKey = $this->resolveApiKey($providerConfigs, $endpointSeed['config']);
                    if ($resolvedApiKey === '') {
                        if ($skipWhenApiKeyMissing) {
                            $skippedEndpoints[] = $providerCode . '/' . $endpointSeed['endpoint_key'];
                            continue;
                        }

                        throw new RuntimeException(sprintf(
                            'video provider endpoint api key missing: %s/%s',
                            $providerCode,
                            $endpointSeed['endpoint_key']
                        ));
                    }

                    $endpointSeed['config']['api_key'] = $resolvedApiKey;
                    $preparedEndpoints[] = $endpointSeed;
                }

                if ($preparedEndpoints === []) {
                    continue;
                }

                [$provider, $providerTouched] = $this->upsertProvider($providerSeed, $existingProvider);
                $count += $providerTouched;

                $providerConfigIds = array_values(array_unique(array_map(
                    static fn (ProviderConfigModel $providerConfig): int => $providerConfig->id,
                    $providerConfigs
                )));
                $providerModels = $this->loadProviderModels($providerConfigIds);
                $providerModelsByIdentity = $this->indexProviderModelsByIdentity($providerModels);
                $providerModelsByModelId = $this->indexProviderModelsByModelId($providerModels);
                $preferredCurrentPricingVersions = $this->loadPreferredCurrentPricingVersions(array_values(array_unique(array_map(
                    static fn (ProviderModelModel $providerModel): int => $providerModel->id,
                    $providerModels
                ))));

                foreach ($preparedEndpoints as $endpointSeed) {
                    $existingProviderConfig = $this->findProviderConfigByEndpointKey($providerConfigs, $endpointSeed['config']['endpoint_key']);
                    [$providerConfig, $providerConfigTouched] = $this->upsertProviderConfig(
                        $provider,
                        $endpointSeed['config'],
                        $existingProviderConfig
                    );
                    $count += $providerConfigTouched;
                    $providerConfigs = $this->rememberProviderConfig($providerConfigs, $providerConfig);

                    $providerConfigId = $providerConfig->id;
                    $modelsByIdentity = $providerModelsByIdentity[$providerConfigId] ?? [];
                    $modelsByModelId = $providerModelsByModelId[$providerConfigId] ?? [];

                    foreach ($endpointSeed['models'] as $modelSeed) {
                        $existingProviderModel = $this->findProviderModel(
                            $modelsByIdentity,
                            $modelsByModelId,
                            $providerCode,
                            $modelSeed
                        );
                        [$providerModel, $providerModelTouched] = $this->upsertProviderModel(
                            $providerConfigId,
                            $providerCode,
                            $modelSeed,
                            $existingProviderModel
                        );
                        $count += $providerModelTouched;
                        $this->rememberProviderModel($providerModelsByIdentity, $providerModelsByModelId, $providerModel);

                        $providerModelId = $providerModel->id;
                        $count += $this->upsertCurrentPricing(
                            $providerModelId,
                            $modelSeed['pricing'],
                            $preferredCurrentPricingVersions[$providerModelId] ?? null
                        );

                        if ($providerCode === ProviderCode::Cloudsway->value
                            && $modelSeed['model_id'] === 'veo-3.1-fast-generate-preview') {
                            $fastPreviewProviderModelId = $providerModelId;
                            $fastPreviewModelIdentity = [
                                'model_id' => $modelSeed['model_id'],
                                'model_version' => (string) $modelSeed['model_version'],
                            ];
                        }
                    }
                }
            }

            $this->repairLegacyModeGroupRelations($fastPreviewProviderModelId, $fastPreviewModelIdentity);

            if ($count === 0 && $skippedEndpoints !== []) {
                return [
                    'count' => 0,
                    'skipped' => true,
                    'message' => 'video provider initialization skipped for endpoints: ' . implode(', ', $skippedEndpoints),
                ];
            }

            $message = 'official video providers initialized';
            if ($skippedEndpoints !== []) {
                $message .= '; skipped endpoints: ' . implode(', ', $skippedEndpoints);
            }

            return [
                'count' => $count,
                'skipped' => false,
                'message' => $message,
            ];
        };

        if (! $wrapTransaction) {
            return $callback();
        }

        return Db::transaction($callback);
    }

    /**
     * @param array<string, mixed> $providerSeed
     */
    private function findProvider(array $providerSeed): ?ProviderModel
    {
        $category = $providerSeed['category'];
        $providerCode = $providerSeed['provider_code'];

        $query = ProviderModel::query()->where('category', $category);

        if ($providerCode === ProviderCode::Wuyin->value) {
            $query->whereIn('provider_code', [
                $providerCode,
                ProviderCode::Official->value,
            ])->orderByRaw(sprintf(
                "case when provider_code = '%s' then 0 else 1 end",
                $providerCode
            ));
        } else {
            $query->where('provider_code', $providerCode);
        }

        $provider = $query
            ->orderByDesc('sort_order')
            ->orderBy('id')
            ->first();

        return $provider instanceof ProviderModel ? $provider : null;
    }

    /**
     * @param array<string, mixed> $providerSeed
     * @return array{0: ProviderModel, 1: int}
     */
    private function upsertProvider(array $providerSeed, ?ProviderModel $provider = null): array
    {
        $now = date('Y-m-d H:i:s');
        $provider ??= $this->findProvider($providerSeed);

        $attributes = [
            'name' => (string) $providerSeed['name'],
            'provider_code' => (string) $providerSeed['provider_code'],
            'description' => (string) $providerSeed['description'],
            'icon' => (string) $providerSeed['icon'],
            'provider_type' => ProviderType::Official->value,
            'category' => (string) $providerSeed['category'],
            'status' => Status::Enabled->value,
            'is_models_enable' => 1,
            'translate' => $providerSeed['translate'],
            'remark' => (string) $providerSeed['remark'],
            'sort_order' => (int) $providerSeed['sort'],
            'deleted_at' => null,
        ];

        if ($provider instanceof ProviderModel) {
            if ($this->valuesEqual($this->extractComparableProviderAttributes($provider), $attributes)) {
                return [$provider, 0];
            }

            $provider->fill(array_merge($attributes, [
                'updated_at' => $now,
            ]));
            $provider->save();

            return [$provider, 1];
        }

        $created = new ProviderModel();
        $created->fill(array_merge($attributes, [
            'created_at' => $now,
            'updated_at' => $now,
        ]));
        $created->save();

        return [$created, 1];
    }

    /**
     * @param list<ProviderConfigModel> $providerConfigs
     * @param array<string, mixed> $configSeed
     */
    private function resolveApiKey(array $providerConfigs, array $configSeed): string
    {
        $apiKey = trim((string) ($configSeed['api_key'] ?? ''));
        if ($apiKey !== '') {
            return $apiKey;
        }

        $providerConfig = $this->findProviderConfigByEndpointKey($providerConfigs, (string) ($configSeed['endpoint_key'] ?? ''));
        if (! $providerConfig instanceof ProviderConfigModel) {
            return '';
        }

        $existingConfig = is_array($providerConfig->config) ? $providerConfig->config : [];
        return trim((string) ($existingConfig['api_key'] ?? $existingConfig['apiKey'] ?? ''));
    }

    /**
     * @param array<string, mixed> $configSeed
     * @return array{0: ProviderConfigModel, 1: int}
     */
    private function upsertProviderConfig(
        ProviderModel $provider,
        array $configSeed,
        ?ProviderConfigModel $providerConfig = null
    ): array {
        $providerConfig ??= $this->findProviderConfigByEndpointKey(
            $this->loadProviderConfigs($provider),
            (string) $configSeed['endpoint_key']
        );
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $now = date('Y-m-d H:i:s');
        $configPayload = $this->buildProviderConfigPayload($providerConfig, $configSeed);

        $attributes = [
            'service_provider_id' => $provider->id,
            'organization_code' => $officialOrganizationCode,
            'provider_code' => $provider->provider_code,
            'status' => Status::Enabled->value,
            'alias' => (string) $configSeed['alias'],
            'translate' => [
                'alias' => [
                    'zh_CN' => (string) $configSeed['alias'],
                    'en_US' => (string) $configSeed['alias'],
                ],
            ],
            'sort' => (int) $configSeed['sort'],
            'config' => $configPayload,
            'deleted_at' => null,
        ];

        if ($providerConfig instanceof ProviderConfigModel) {
            if ($this->valuesEqual($this->extractComparableProviderConfigAttributes($providerConfig), $attributes)) {
                return [$providerConfig, 0];
            }

            $providerConfig->fill(array_merge($attributes, [
                'updated_at' => $now,
            ]));
            $providerConfig->save();

            return [$providerConfig, 1];
        }

        $providerConfigId = IdGenerator::getSnowId();
        $createdProviderConfig = new ProviderConfigModel();
        // ProviderConfigModel encrypts config with an AES key derived from the model id.
        // Set id before filling config-bearing attributes to avoid reading a missing id.
        $createdProviderConfig->setAttribute('id', $providerConfigId);
        $createdProviderConfig->fill(array_merge($attributes, [
            'created_at' => $now,
            'updated_at' => $now,
        ]));
        $createdProviderConfig->save();

        return [$createdProviderConfig, 1];
    }

    /**
     * @param array<string, mixed> $configSeed
     * @return array<string, mixed>
     */
    private function buildProviderConfigPayload(?ProviderConfigModel $providerConfig, array $configSeed): array
    {
        $existingConfig = $providerConfig instanceof ProviderConfigModel && is_array($providerConfig->config)
            ? $providerConfig->config
            : [];

        $payload = [
            'base_url' => trim((string) $configSeed['base_url']),
            'api_key' => trim((string) ($configSeed['api_key'] ?: ($existingConfig['api_key'] ?? $existingConfig['apiKey'] ?? ''))),
            '_seed_endpoint_key' => (string) $configSeed['endpoint_key'],
        ];

        foreach ($configSeed as $key => $value) {
            if (! is_string($key) || in_array($key, ['endpoint_key', 'base_url', 'url', 'api_key', 'apiKey', 'alias', 'sort', 'endpoint_path'], true)) {
                continue;
            }
            $payload[$key] = $value;
        }

        return $payload;
    }

    /**
     * @param array<string, mixed> $modelSeed
     * @return array{0: ProviderModelModel, 1: int}
     */
    private function upsertProviderModel(
        int $providerConfigId,
        string $providerCode,
        array $modelSeed,
        ?ProviderModelModel $providerModel = null
    ): array {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $now = date('Y-m-d H:i:s');
        $modelId = (string) $modelSeed['model_id'];
        $modelVersion = (string) $modelSeed['model_version'];

        $providerModel ??= $this->findProviderModel(
            [],
            [],
            $providerCode,
            $modelSeed
        );

        $attributes = [
            'service_provider_config_id' => $providerConfigId,
            'name' => (string) $modelSeed['name'],
            'model_version' => $modelVersion,
            'category' => (string) $modelSeed['category'],
            'model_id' => $modelId,
            'model_type' => (int) $modelSeed['model_type'],
            'config' => $modelSeed['config'],
            'description' => (string) $modelSeed['description'],
            'sort' => (int) $modelSeed['sort'],
            'icon' => (string) $modelSeed['icon'],
            'organization_code' => $officialOrganizationCode,
            'status' => (int) $modelSeed['status'],
            'disabled_by' => '',
            'translate' => $modelSeed['translate'],
            'model_parent_id' => 0,
            'visible_organizations' => $modelSeed['visible_organizations'],
            'visible_applications' => $modelSeed['visible_applications'],
            'visible_packages' => $modelSeed['visible_packages'],
            'load_balancing_weight' => (int) $modelSeed['load_balancing_weight'],
            'is_office' => 1,
            'super_magic_display_state' => 0,
            'type' => 'ATOM',
            'aggregate_config' => $modelSeed['aggregate_config'] === []
                ? null
                : $modelSeed['aggregate_config'],
            'deleted_at' => null,
        ];

        if ($providerModel instanceof ProviderModelModel) {
            if ($this->valuesEqual($this->extractComparableProviderModelAttributes($providerModel), $attributes)) {
                return [$providerModel, 0];
            }

            $providerModel->fill(array_merge($attributes, [
                'updated_at' => $now,
            ]));
            $providerModel->save();

            return [$providerModel, 1];
        }

        $created = new ProviderModelModel();
        $created->fill(array_merge($attributes, [
            'created_at' => $now,
            'updated_at' => $now,
        ]));
        $created->save();

        return [$created, 1];
    }

    /**
     * @param array<string, mixed> $pricingSeed
     */
    private function upsertCurrentPricing(
        int $providerModelId,
        array $pricingSeed,
        ?ProviderModelConfigVersionModel $currentVersion = null
    ): int {
        $now = date('Y-m-d H:i:s');

        $attributes = [
            'service_provider_model_id' => $providerModelId,
            'creativity' => 0.5,
            'max_tokens' => null,
            'temperature' => null,
            'vector_size' => 2048,
            'billing_type' => (string) $pricingSeed['billing_type'],
            'time_pricing' => $this->toNullableFloat($pricingSeed['time_pricing'] ?? null),
            'input_pricing' => $this->toNullableFloat($pricingSeed['input_pricing'] ?? null),
            'output_pricing' => $this->toNullableFloat($pricingSeed['output_pricing'] ?? null),
            'billing_currency' => (string) $pricingSeed['billing_currency'],
            'support_function' => 0,
            'cache_hit_pricing' => $this->toNullableFloat($pricingSeed['cache_hit_pricing'] ?? null),
            'max_output_tokens' => null,
            'support_embedding' => 0,
            'support_deep_think' => 0,
            'cache_write_pricing' => $this->toNullableFloat($pricingSeed['cache_write_pricing'] ?? null),
            'support_multi_modal' => 0,
            'official_recommended' => (int) ($pricingSeed['official_recommended'] ?? 1),
            'input_cost' => $this->toNullableFloat($pricingSeed['input_cost'] ?? null),
            'output_cost' => $this->toNullableFloat($pricingSeed['output_cost'] ?? null),
            'cache_hit_cost' => $this->toNullableFloat($pricingSeed['cache_hit_cost'] ?? null),
            'cache_write_cost' => $this->toNullableFloat($pricingSeed['cache_write_cost'] ?? null),
            'time_cost' => $this->toNullableFloat($pricingSeed['time_cost'] ?? null),
            'version' => $currentVersion instanceof ProviderModelConfigVersionModel ? max(1, $currentVersion->version) : 1,
            'is_current_version' => 1,
        ];

        if ($currentVersion instanceof ProviderModelConfigVersionModel) {
            if ($this->valuesEqual($this->extractComparablePricingAttributes($currentVersion), $attributes)) {
                return 0;
            }

            ProviderModelConfigVersionModel::query()
                ->where('service_provider_model_id', $providerModelId)
                ->where('id', '!=', $currentVersion->id)
                ->where('is_current_version', true)
                ->update([
                    'is_current_version' => 0,
                    'updated_at' => $now,
                ]);

            ProviderModelConfigVersionModel::query()
                ->where('id', $currentVersion->id)
                ->update(array_merge($attributes, [
                    'updated_at' => $now,
                ]));

            return 1;
        }

        ProviderModelConfigVersionModel::query()->create(array_merge($attributes, [
            'created_at' => $now,
            'updated_at' => $now,
        ]));

        return 1;
    }

    private function toNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value;
    }

    /**
     * @return list<ProviderConfigModel>
     */
    private function loadProviderConfigs(?ProviderModel $provider): array
    {
        if (! $provider instanceof ProviderModel) {
            return [];
        }

        return ProviderConfigModel::query()
            ->where('organization_code', OfficialOrganizationUtil::getOfficialOrganizationCode())
            ->where('service_provider_id', $provider->id)
            ->orderByDesc('status')
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->values()
            ->all();
    }

    /**
     * @param int[] $providerConfigIds
     * @return list<ProviderModelModel>
     */
    private function loadProviderModels(array $providerConfigIds): array
    {
        if ($providerConfigIds === []) {
            return [];
        }

        return ProviderModelModel::query()
            ->whereIn('service_provider_config_id', $providerConfigIds)
            ->orderByDesc('status')
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->all();
    }

    /**
     * @param int[] $providerModelIds
     * @return array<int, ProviderModelConfigVersionModel>
     */
    private function loadPreferredCurrentPricingVersions(array $providerModelIds): array
    {
        if ($providerModelIds === []) {
            return [];
        }

        /** @var list<ProviderModelConfigVersionModel> $pricingModels */
        $pricingModels = ProviderModelConfigVersionModel::query()
            ->whereIn('service_provider_model_id', $providerModelIds)
            ->orderBy('service_provider_model_id')
            ->orderByDesc('is_current_version')
            ->orderByDesc('version')
            ->orderByDesc('id')
            ->get()
            ->all();

        $preferredPricingVersions = [];
        foreach ($pricingModels as $pricingModel) {
            $providerModelId = $pricingModel->service_provider_model_id;
            if (! isset($preferredPricingVersions[$providerModelId])) {
                $preferredPricingVersions[$providerModelId] = $pricingModel;
            }
        }

        return $preferredPricingVersions;
    }

    /**
     * @param list<ProviderConfigModel> $providerConfigs
     */
    private function findProviderConfigByEndpointKey(array $providerConfigs, string $endpointKey): ?ProviderConfigModel
    {
        $matchedConfig = null;
        $fallbackConfig = null;
        foreach ($providerConfigs as $providerConfig) {
            $fallbackConfig ??= $providerConfig;
            $config = is_array($providerConfig->config) ? $providerConfig->config : [];
            $configuredEndpointKey = trim((string) ($config['_seed_endpoint_key'] ?? ''));
            if ($configuredEndpointKey === $endpointKey) {
                if ($providerConfig->status === Status::Enabled->value) {
                    return $providerConfig;
                }

                $matchedConfig ??= $providerConfig;
            }
        }

        if ($matchedConfig instanceof ProviderConfigModel) {
            return $matchedConfig;
        }

        if (count($providerConfigs) === 1) {
            $fallbackConfigData = $fallbackConfig instanceof ProviderConfigModel && is_array($fallbackConfig->config)
                ? $fallbackConfig->config
                : [];
            if (trim((string) ($fallbackConfigData['_seed_endpoint_key'] ?? '')) !== '') {
                return null;
            }

            return $fallbackConfig;
        }

        return null;
    }

    /**
     * @param array<string, ProviderModelModel> $providerModelsByIdentity
     * @param array<string, ProviderModelModel> $providerModelsByModelId
     * @param array<string, mixed> $modelSeed
     */
    private function findProviderModel(
        array $providerModelsByIdentity,
        array $providerModelsByModelId,
        string $providerCode,
        array $modelSeed
    ): ?ProviderModelModel {
        $modelId = $modelSeed['model_id'];
        $modelVersion = $modelSeed['model_version'];
        $identityKey = $this->providerModelIdentityKey($modelId, $modelVersion);
        if (isset($providerModelsByIdentity[$identityKey])) {
            return $providerModelsByIdentity[$identityKey];
        }

        if ($providerCode === ProviderCode::Cloudsway->value) {
            return $providerModelsByModelId[$modelId] ?? null;
        }

        return null;
    }

    /**
     * @param list<ProviderModelModel> $providerModels
     * @return array<int, array<string, ProviderModelModel>>
     */
    private function indexProviderModelsByIdentity(array $providerModels): array
    {
        $indexedModels = [];
        foreach ($providerModels as $providerModel) {
            $providerConfigId = $providerModel->service_provider_config_id;
            $indexedModels[$providerConfigId][$this->providerModelIdentityKey(
                $providerModel->model_id,
                $providerModel->model_version
            )] = $providerModel;
        }

        return $indexedModels;
    }

    /**
     * @param list<ProviderModelModel> $providerModels
     * @return array<int, array<string, ProviderModelModel>>
     */
    private function indexProviderModelsByModelId(array $providerModels): array
    {
        $indexedModels = [];
        foreach ($providerModels as $providerModel) {
            $providerConfigId = $providerModel->service_provider_config_id;
            $modelId = $providerModel->model_id;
            if (! isset($indexedModels[$providerConfigId][$modelId])) {
                $indexedModels[$providerConfigId][$modelId] = $providerModel;
            }
        }

        return $indexedModels;
    }

    /**
     * @param array<int, array<string, ProviderModelModel>> $providerModelsByIdentity
     * @param array<int, array<string, ProviderModelModel>> $providerModelsByModelId
     */
    private function rememberProviderModel(
        array &$providerModelsByIdentity,
        array &$providerModelsByModelId,
        ProviderModelModel $providerModel
    ): void {
        $providerConfigId = $providerModel->service_provider_config_id;
        $modelId = $providerModel->model_id;
        $identityKey = $this->providerModelIdentityKey($modelId, $providerModel->model_version);
        $providerModelsByIdentity[$providerConfigId][$identityKey] = $providerModel;
        if (! isset($providerModelsByModelId[$providerConfigId][$modelId])) {
            $providerModelsByModelId[$providerConfigId][$modelId] = $providerModel;
        } elseif ($providerModelsByModelId[$providerConfigId][$modelId]->id === $providerModel->id) {
            $providerModelsByModelId[$providerConfigId][$modelId] = $providerModel;
        }
    }

    /**
     * @param list<ProviderConfigModel> $providerConfigs
     * @return list<ProviderConfigModel>
     */
    private function rememberProviderConfig(array $providerConfigs, ProviderConfigModel $providerConfig): array
    {
        foreach ($providerConfigs as $index => $existingProviderConfig) {
            if ($existingProviderConfig->id === $providerConfig->id) {
                $providerConfigs[$index] = $providerConfig;
                return $providerConfigs;
            }
        }

        $providerConfigs[] = $providerConfig;
        return $providerConfigs;
    }

    private function providerModelIdentityKey(string $modelId, string $modelVersion): string
    {
        return $modelId . '::' . $modelVersion;
    }

    private function valuesEqual(array $left, array $right): bool
    {
        return $this->normalizeForComparison($left) === $this->normalizeForComparison($right);
    }

    private function normalizeForComparison(mixed $value): mixed
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d H:i:s');
        }

        if (is_float($value)) {
            return sprintf('%.12F', $value);
        }

        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->normalizeForComparison($item), $value);
        }

        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->normalizeForComparison($item);
        }

        return $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractComparableProviderAttributes(ProviderModel $provider): array
    {
        return [
            'name' => $provider->name,
            'provider_code' => $provider->provider_code,
            'description' => $provider->description,
            'icon' => $provider->icon,
            'provider_type' => $provider->provider_type,
            'category' => $provider->category,
            'status' => $provider->status,
            'is_models_enable' => $provider->is_models_enable,
            'translate' => $provider->translate,
            'remark' => $provider->remark,
            'sort_order' => $provider->sort_order,
            'deleted_at' => $provider->deleted_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractComparableProviderConfigAttributes(ProviderConfigModel $providerConfig): array
    {
        return [
            'service_provider_id' => $providerConfig->service_provider_id,
            'organization_code' => $providerConfig->organization_code,
            'provider_code' => (string) $providerConfig->provider_code,
            'status' => $providerConfig->status,
            'alias' => $providerConfig->alias,
            'translate' => $providerConfig->translate,
            'sort' => $providerConfig->sort,
            'config' => is_array($providerConfig->config) ? $providerConfig->config : [],
            'deleted_at' => $providerConfig->deleted_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractComparableProviderModelAttributes(ProviderModelModel $providerModel): array
    {
        return [
            'service_provider_config_id' => $providerModel->service_provider_config_id,
            'name' => $providerModel->name,
            'model_version' => $providerModel->model_version,
            'category' => $providerModel->category,
            'model_id' => $providerModel->model_id,
            'model_type' => $providerModel->model_type,
            'config' => $providerModel->config,
            'description' => $providerModel->description,
            'sort' => $providerModel->sort,
            'icon' => $providerModel->icon,
            'organization_code' => $providerModel->organization_code,
            'status' => $providerModel->status,
            'disabled_by' => $providerModel->disabled_by,
            'translate' => $providerModel->translate,
            'model_parent_id' => $providerModel->model_parent_id,
            'visible_organizations' => $providerModel->visible_organizations,
            'visible_applications' => $providerModel->visible_applications,
            'visible_packages' => $providerModel->visible_packages,
            'load_balancing_weight' => $providerModel->load_balancing_weight,
            'is_office' => $providerModel->is_office,
            'super_magic_display_state' => $providerModel->super_magic_display_state,
            'type' => $providerModel->type,
            'aggregate_config' => $providerModel->aggregate_config,
            'deleted_at' => $providerModel->deleted_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractComparablePricingAttributes(ProviderModelConfigVersionModel $pricing): array
    {
        return [
            'service_provider_model_id' => $pricing->service_provider_model_id,
            'creativity' => $pricing->creativity,
            'max_tokens' => $pricing->max_tokens,
            'temperature' => $pricing->temperature,
            'vector_size' => $pricing->vector_size,
            'billing_type' => $pricing->billing_type,
            'time_pricing' => $pricing->time_pricing,
            'input_pricing' => $pricing->input_pricing,
            'output_pricing' => $pricing->output_pricing,
            'billing_currency' => $pricing->billing_currency,
            'support_function' => (int) $pricing->support_function,
            'cache_hit_pricing' => $pricing->cache_hit_pricing,
            'max_output_tokens' => $pricing->max_output_tokens,
            'support_embedding' => (int) $pricing->support_embedding,
            'support_deep_think' => (int) $pricing->support_deep_think,
            'cache_write_pricing' => $pricing->cache_write_pricing,
            'support_multi_modal' => (int) $pricing->support_multi_modal,
            'official_recommended' => (int) $pricing->official_recommended,
            'input_cost' => $pricing->input_cost,
            'output_cost' => $pricing->output_cost,
            'cache_hit_cost' => $pricing->cache_hit_cost,
            'cache_write_cost' => $pricing->cache_write_cost,
            'time_cost' => $pricing->time_cost,
            'version' => $pricing->version,
            'is_current_version' => (int) $pricing->is_current_version,
        ];
    }

    /**
     * @param null|array{model_id: string, model_version: string} $fastModelIdentity
     */
    private function repairLegacyModeGroupRelations(?int $fastProviderModelId, ?array $fastModelIdentity): void
    {
        if (! is_int($fastProviderModelId) || ! Schema::hasTable('magic_mode_group_relations')) {
            return;
        }

        if (! is_array($fastModelIdentity)
            || trim((string) ($fastModelIdentity['model_id'] ?? '')) === ''
            || trim((string) ($fastModelIdentity['model_version'] ?? '')) === '') {
            return;
        }

        Db::table('magic_mode_group_relations')
            ->where(function ($query) use ($fastModelIdentity): void {
                $query->where('provider_model_id', 900000001)
                    ->orWhereIn('model_id', [
                        (string) $fastModelIdentity['model_id'],
                        (string) $fastModelIdentity['model_version'],
                    ]);
            })
            ->update([
                'model_id' => (string) $fastModelIdentity['model_id'],
                'provider_model_id' => $fastProviderModelId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }
}

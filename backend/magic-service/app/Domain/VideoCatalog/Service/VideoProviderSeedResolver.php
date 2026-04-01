<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\VideoCatalog\Service;

use App\Domain\Provider\DTO\Item\BillingType;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use JsonException;
use RuntimeException;

final class VideoProviderSeedResolver
{
    private const string DEFAULT_CATEGORY = 'vgm';

    private const string DEFAULT_PROVIDER_ICON = 'MAGIC/713471849556451329/default/magic.png';

    /**
     * @return list<array<string, mixed>>
     */
    public static function configuredEndpointSeedDataList(): array
    {
        $configured = config('model_gateway.video_providers', []);
        return self::normalizeEndpointSeedDataList(is_array($configured) ? $configured : [], true);
    }

    /**
     * @param array<string, mixed>|list<array<string, mixed>> $configured
     * @return list<array<string, mixed>>
     */
    public static function normalizeEndpointSeedDataList(array $configured, bool $resolveDynamicStrings = false): array
    {
        if ($configured === []) {
            return [];
        }

        if (! array_is_list($configured)) {
            if (isset($configured['provider_code'])) {
                $configured = [$configured];
            } else {
                throw new RuntimeException('model_gateway.video_providers must be a JSON array');
            }
        }

        $normalized = [];
        foreach ($configured as $index => $endpointSeed) {
            if (! is_array($endpointSeed)) {
                throw new RuntimeException(sprintf('video provider endpoint at index %d must be an object', $index));
            }

            $providerCode = trim((string) ($endpointSeed['provider_code'] ?? ''));
            if ($providerCode === '') {
                throw new RuntimeException(sprintf('video provider endpoint at index %d missing provider_code', $index));
            }

            $endpointKey = trim((string) ($endpointSeed['endpoint_key'] ?? ''));
            if ($endpointKey === '') {
                throw new RuntimeException(sprintf('video provider endpoint at index %d missing endpoint_key', $index));
            }

            $providerSeed = self::normalizeProviderSeed($providerCode, is_array($endpointSeed['provider'] ?? null) ? $endpointSeed['provider'] : []);
            $configSeed = self::normalizeConfigSeed(
                $providerSeed,
                $endpointKey,
                is_array($endpointSeed['config'] ?? null) ? $endpointSeed['config'] : [],
                $resolveDynamicStrings,
            );
            $modelSeeds = self::normalizeModelSeedList(
                $providerSeed,
                $endpointKey,
                is_array($endpointSeed['models'] ?? null) ? $endpointSeed['models'] : []
            );

            $normalized[] = [
                'provider_code' => $providerCode,
                'endpoint_key' => $endpointKey,
                'provider' => $providerSeed,
                'config' => $configSeed,
                'models' => $modelSeeds,
            ];
        }

        self::assertProviderMetadataConsistency($normalized);

        return $normalized;
    }

    /**
     * @param list<array<string, mixed>> $endpointSeeds
     * @return array<string, array{provider: array<string, mixed>, endpoints: list<array<string, mixed>>}>
     */
    public static function groupNormalizedEndpointSeedData(array $endpointSeeds): array
    {
        $groups = [];
        foreach ($endpointSeeds as $endpointSeed) {
            $providerCode = (string) $endpointSeed['provider_code'];
            if (! isset($groups[$providerCode])) {
                $groups[$providerCode] = [
                    'provider' => $endpointSeed['provider'],
                    'endpoints' => [],
                ];
            }

            $groups[$providerCode]['endpoints'][] = $endpointSeed;
        }

        return $groups;
    }

    /**
     * @return array<string, mixed>
     */
    public static function providerSeedData(?string $providerCode = null): array
    {
        foreach (self::configuredEndpointSeedDataList() as $endpointSeed) {
            if ($providerCode === null || $providerCode === (string) $endpointSeed['provider_code']) {
                return $endpointSeed['provider'];
            }
        }

        return [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function modelSeedDataList(?string $providerCode = null, ?string $endpointKey = null): array
    {
        $matchedModelSeeds = [];
        foreach (self::configuredEndpointSeedDataList() as $endpointSeed) {
            if ($providerCode !== null && $providerCode !== (string) $endpointSeed['provider_code']) {
                continue;
            }
            if ($endpointKey !== null && $endpointKey !== (string) $endpointSeed['endpoint_key']) {
                continue;
            }

            if ($endpointKey !== null) {
                return $endpointSeed['models'];
            }

            foreach ($endpointSeed['models'] as $modelSeed) {
                $matchedModelSeeds[$modelSeed['model_id'] . '::' . $modelSeed['model_version']] = $modelSeed;
            }
        }

        if ($matchedModelSeeds !== []) {
            return array_values($matchedModelSeeds);
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    public static function modelSeedData(?string $identifier = null, ?string $providerCode = null, ?string $endpointKey = null): array
    {
        $normalizedIdentifier = trim((string) $identifier);

        if ($normalizedIdentifier !== '') {
            foreach (self::configuredEndpointSeedDataList() as $endpointSeed) {
                if ($providerCode !== null && $providerCode !== (string) $endpointSeed['provider_code']) {
                    continue;
                }
                if ($endpointKey !== null && $endpointKey !== (string) $endpointSeed['endpoint_key']) {
                    continue;
                }

                foreach ($endpointSeed['models'] as $modelSeed) {
                    if ($normalizedIdentifier === (string) $modelSeed['model_id']
                        || $normalizedIdentifier === (string) $modelSeed['model_version']) {
                        return $modelSeed;
                    }
                }
            }
        }

        $modelSeeds = self::modelSeedDataList($providerCode, $endpointKey);
        if ($modelSeeds !== []) {
            return $modelSeeds[0];
        }

        return [];
    }

    /**
     * @param list<array<string, mixed>> $endpointSeeds
     */
    private static function assertProviderMetadataConsistency(array $endpointSeeds): void
    {
        $providers = [];
        foreach ($endpointSeeds as $endpointSeed) {
            $providerCode = (string) $endpointSeed['provider_code'];
            $currentProvider = $endpointSeed['provider'];

            if (! isset($providers[$providerCode])) {
                $providers[$providerCode] = $currentProvider;
                continue;
            }

            if (self::jsonEncodeForComparison($providers[$providerCode]) !== self::jsonEncodeForComparison($currentProvider)) {
                throw new RuntimeException(sprintf(
                    'video provider metadata mismatch for provider_code %s',
                    $providerCode
                ));
            }
        }
    }

    /**
     * @param array<string, mixed> $provider
     * @return array<string, mixed>
     */
    private static function normalizeProviderSeed(string $providerCode, array $provider): array
    {
        $name = self::stringValue($provider, 'name', $providerCode);
        $alias = self::stringValue($provider, 'alias', $name . ' Video');
        $description = self::stringValue($provider, 'description', $name . ' 文生视频模型');

        return [
            'provider_code' => $providerCode,
            'name' => $name,
            'alias' => $alias,
            'description' => $description,
            'icon' => self::stringValue($provider, 'icon', self::DEFAULT_PROVIDER_ICON),
            'remark' => self::stringValue($provider, 'remark', $name . ' 文生视频'),
            'sort' => self::intValue($provider, 'sort', 1000),
            'category' => self::stringValue($provider, 'category', self::DEFAULT_CATEGORY),
            'translate' => self::normalizeProviderTranslate($provider, $name, $description, $alias),
        ];
    }

    /**
     * @param array<string, mixed> $providerSeed
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private static function normalizeConfigSeed(
        array $providerSeed,
        string $endpointKey,
        array $config,
        bool $resolveDynamicStrings
    ): array {
        $baseUrl = self::normalizeConfigStringValue(
            self::stringValue($config, 'base_url', self::stringValue($config, 'url', '')),
            $resolveDynamicStrings,
        );
        if ($baseUrl === '') {
            throw new RuntimeException(sprintf(
                'video provider endpoint %s/%s missing config.base_url',
                $providerSeed['provider_code'],
                $endpointKey
            ));
        }

        $normalized = [
            'endpoint_key' => $endpointKey,
            'base_url' => $baseUrl,
            'api_key' => self::normalizeConfigStringValue(
                self::stringValue($config, 'api_key', self::stringValue($config, 'apiKey', '')),
                $resolveDynamicStrings,
            ),
            'alias' => self::stringValue($config, 'alias', (string) $providerSeed['alias']),
            'sort' => self::intValue($config, 'sort', (int) $providerSeed['sort']),
        ];

        foreach ($config as $key => $value) {
            if (! is_string($key) || isset($normalized[$key]) || in_array($key, ['url', 'apiKey', 'endpoint_path'], true)) {
                continue;
            }

            if (is_string($value)) {
                $normalized[$key] = self::normalizeConfigStringValue($value, $resolveDynamicStrings);
                continue;
            }

            $normalized[$key] = $value;
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $providerSeed
     * @param list<array<string, mixed>> $models
     * @return list<array<string, mixed>>
     */
    private static function normalizeModelSeedList(array $providerSeed, string $endpointKey, array $models): array
    {
        if ($models === [] || ! array_is_list($models)) {
            throw new RuntimeException(sprintf(
                'video provider endpoint %s/%s missing models list',
                $providerSeed['provider_code'],
                $endpointKey
            ));
        }

        $normalized = [];
        foreach ($models as $index => $model) {
            if (! is_array($model)) {
                throw new RuntimeException(sprintf(
                    'video provider endpoint %s/%s model at index %d must be an object',
                    $providerSeed['provider_code'],
                    $endpointKey,
                    $index
                ));
            }

            $normalized[] = self::normalizeModelSeed($providerSeed, $endpointKey, $model, $index);
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $providerSeed
     * @param array<string, mixed> $model
     * @return array<string, mixed>
     */
    private static function normalizeModelSeed(array $providerSeed, string $endpointKey, array $model, int $index): array
    {
        $modelId = self::stringValue($model, 'model_id', '');
        // 视频 provider 的 model_version 沿用平台通用语义：
        // 存“模型部署名称”，对 Cloudsway 即上游 endpoint_id。
        $modelVersion = self::stringValue($model, 'model_version', '');
        if ($modelId === '' || $modelVersion === '') {
            throw new RuntimeException(sprintf(
                'video provider endpoint %s/%s model at index %d missing model_id or model_version',
                $providerSeed['provider_code'],
                $endpointKey,
                $index
            ));
        }

        $name = self::stringValue($model, 'name', $modelId);
        $description = self::stringValue($model, 'description', $name);

        return [
            'model_id' => $modelId,
            'model_version' => $modelVersion,
            'name' => $name,
            'description' => $description,
            'icon' => self::stringValue($model, 'icon', (string) $providerSeed['icon']),
            'sort' => self::intValue($model, 'sort', (int) $providerSeed['sort']),
            'category' => self::stringValue($model, 'category', (string) $providerSeed['category']),
            'model_type' => self::intValue($model, 'model_type', ModelType::TEXT_TO_VIDEO->value),
            'load_balancing_weight' => self::intValue($model, 'load_balancing_weight', 0),
            'translate' => self::normalizeModelTranslate($model, $name, $description),
            'config' => is_array($model['config'] ?? null) ? $model['config'] : [],
            'visible_organizations' => self::normalizeStringList($model['visible_organizations'] ?? []),
            'visible_applications' => self::normalizeStringList($model['visible_applications'] ?? []),
            'visible_packages' => self::normalizeStringList($model['visible_packages'] ?? []),
            'aggregate_config' => is_array($model['aggregate_config'] ?? null) ? $model['aggregate_config'] : [],
            'status' => self::intValue($model, 'status', 1),
            'pricing' => self::normalizePricingSeed($model['pricing'] ?? []),
        ];
    }

    /**
     * @param array<string, mixed> $pricing
     * @return array<string, mixed>
     */
    private static function normalizePricingSeed(mixed $pricing): array
    {
        $pricing = is_array($pricing) ? $pricing : [];

        return [
            'billing_type' => self::stringValue($pricing, 'billing_type', BillingType::Times->value),
            'billing_currency' => self::stringValue($pricing, 'billing_currency', 'CNY'),
            'time_pricing' => self::nullableNumericString($pricing['time_pricing'] ?? null),
            'time_cost' => self::nullableNumericString($pricing['time_cost'] ?? null),
            'input_pricing' => self::nullableNumericString($pricing['input_pricing'] ?? null),
            'output_pricing' => self::nullableNumericString($pricing['output_pricing'] ?? null),
            'cache_write_pricing' => self::nullableNumericString($pricing['cache_write_pricing'] ?? null),
            'cache_hit_pricing' => self::nullableNumericString($pricing['cache_hit_pricing'] ?? null),
            'input_cost' => self::nullableNumericString($pricing['input_cost'] ?? null),
            'output_cost' => self::nullableNumericString($pricing['output_cost'] ?? null),
            'cache_write_cost' => self::nullableNumericString($pricing['cache_write_cost'] ?? null),
            'cache_hit_cost' => self::nullableNumericString($pricing['cache_hit_cost'] ?? null),
            'official_recommended' => self::intValue($pricing, 'official_recommended', 1),
        ];
    }

    /**
     * @param array<string, mixed> $provider
     * @return array<string, mixed>
     */
    private static function normalizeProviderTranslate(array $provider, string $name, string $description, string $alias): array
    {
        $translate = is_array($provider['translate'] ?? null) ? $provider['translate'] : [];

        return [
            'name' => self::normalizeI18nPair($translate['name'] ?? null, $name),
            'description' => self::normalizeI18nPair($translate['description'] ?? null, $description),
            'alias' => self::normalizeI18nPair($translate['alias'] ?? null, $alias),
        ];
    }

    /**
     * @param array<string, mixed> $model
     * @return array<string, mixed>
     */
    private static function normalizeModelTranslate(array $model, string $name, string $description): array
    {
        $translate = is_array($model['translate'] ?? null) ? $model['translate'] : [];

        return [
            'name' => self::normalizeI18nPair($translate['name'] ?? null, $name),
            'description' => self::normalizeI18nPair($translate['description'] ?? null, $description),
        ];
    }

    /**
     * @return array{zh_CN: string, en_US: string}
     */
    private static function normalizeI18nPair(mixed $translate, string $defaultValue): array
    {
        $translate = is_array($translate) ? $translate : [];

        return [
            'zh_CN' => self::stringValue($translate, 'zh_CN', $defaultValue),
            'en_US' => self::stringValue($translate, 'en_US', $defaultValue),
        ];
    }

    /**
     * @return list<string>
     */
    private static function normalizeStringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(static fn ($item): string => trim((string) $item), $value), static fn (string $item): bool => $item !== ''));
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function stringValue(array $payload, string $key, string $default): string
    {
        $value = $payload[$key] ?? null;
        if (is_scalar($value)) {
            $normalized = trim((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return $default;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function intValue(array $payload, string $key, int $default): int
    {
        $value = $payload[$key] ?? null;
        if (is_numeric($value)) {
            return (int) $value;
        }

        return $default;
    }

    private static function nullableNumericString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_numeric($value)) {
            throw new RuntimeException('video pricing field must be numeric');
        }

        return (string) $value;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function jsonEncodeForComparison(array $payload): string
    {
        try {
            return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('failed to encode video provider metadata', previous: $exception);
        }
    }

    private static function normalizeConfigStringValue(string $value, bool $resolveDynamicStrings): string
    {
        $normalized = trim($value);
        if (! $resolveDynamicStrings || $normalized === '' || ! str_starts_with($normalized, 'env:')) {
            return $normalized;
        }

        $envKey = trim(substr($normalized, 4));
        if ($envKey === '') {
            return '';
        }

        $resolved = getenv($envKey);
        return is_string($resolved) ? trim($resolved) : '';
    }
}

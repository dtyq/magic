<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace MagicTestSupport\VideoTesting;

use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;

trait UsesOfficialVideoProviderFixtures
{
    use UsesDatabaseIsolation;

    private const string TEST_FAST_MODEL_ID = 'test-video-fast-generate-preview';

    private const string TEST_PRO_MODEL_ID = 'test-video-pro-generate-preview';

    private const string TEST_FAST_MODEL_VERSION = 'test_video_fast';

    private const string TEST_PRO_MODEL_VERSION = 'test_video_pro';

    /**
     * 初始化视频服务商测试隔离。
     * 这里只隔离配置读取，不回滚数据库；数据库侧依赖固定组织编码和固定主键做幂等 upsert。
     */
    protected function setUpOfficialVideoProviderIsolation(): void
    {
        $organizationCode = $this->officialVideoFixtureOrganizationCode();

        $this->beginDatabaseIsolation();
        $this->setIsolatedConfig('service_provider.office_organization', $organizationCode);
        $this->setIsolatedConfig('model_gateway.video_providers', [
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://cloudsway-video.mock.example.test',
                apiKey: '',
                models: $this->defaultOfficialVideoProviderModels(),
            ),
        ]);
    }

    protected function tearDownOfficialVideoProviderIsolation(): void
    {
        $this->endDatabaseIsolation();
    }

    /**
     * 在固定的“官方测试组织”下 upsert 一组视频 provider/config/model fixture。
     * 官方语义来自官方组织，不依赖测试库里只有一个视频 provider。
     * 因此这里严禁改成随机主键或每次插入新数据，否则共享测试库会持续膨胀。
     *
     * @return array{provider_id: int, config_id: int, fast_model_id: int, pro_model_id: int}
     */
    protected function createOfficialVideoProviderFixture(
        string $baseUrl = 'https://official-video-fixture.example.com',
        string $apiKey = 'official-video-fixture-key'
    ): array {
        $fixtureIds = $this->officialVideoFixtureIds();
        $fixtureSorts = $this->officialVideoFixtureSorts();
        $organizationCode = $this->officialVideoFixtureOrganizationCode();
        $providerSeed = $this->officialVideoProviderSeed();
        $fastModelSeed = $this->officialVideoModelSeed(self::TEST_FAST_MODEL_ID);
        $proModelSeed = $this->officialVideoModelSeed(self::TEST_PRO_MODEL_ID);
        $now = date('Y-m-d H:i:s');

        $this->upsertProvider([
            'id' => $fixtureIds['provider_id'],
            'name' => $providerSeed['name'],
            'provider_code' => $providerSeed['provider_code'],
            'description' => $providerSeed['description'],
            'icon' => $providerSeed['icon'],
            'provider_type' => ProviderType::Official->value,
            'category' => $providerSeed['category'],
            'status' => Status::Enabled->value,
            'is_models_enable' => 1,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
            'translate' => json_encode($providerSeed['translate'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'remark' => $providerSeed['remark'],
            'sort_order' => $fixtureSorts['provider_sort'],
        ], $now);

        $this->upsertProviderConfig([
            'id' => $fixtureIds['provider_config_id'],
            'service_provider_id' => $fixtureIds['provider_id'],
            'organization_code' => $organizationCode,
            'provider_code' => $providerSeed['provider_code'],
            'config' => ProviderConfigAssembler::encodeConfig([
                'base_url' => $baseUrl,
                'api_key' => $apiKey,
                '_seed_endpoint_key' => 'default',
            ], (string) $fixtureIds['provider_config_id']),
            'status' => Status::Enabled->value,
            'alias' => $providerSeed['alias'],
            'translate' => json_encode([
                'alias' => $providerSeed['translate']['alias'],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'sort' => $fixtureSorts['provider_sort'],
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ], $now);

        $this->insertOfficialVideoProviderModel(
            $fixtureIds['fast_model_id'],
            $fixtureIds['fast_model_config_version_id'],
            $fastModelSeed,
            $fixtureSorts['fast_model_sort'],
            $organizationCode,
            $fixtureIds['provider_config_id'],
            $now
        );
        $this->insertOfficialVideoProviderModel(
            $fixtureIds['pro_model_id'],
            $fixtureIds['pro_model_config_version_id'],
            $proModelSeed,
            $fixtureSorts['pro_model_sort'],
            $organizationCode,
            $fixtureIds['provider_config_id'],
            $now
        );
        $this->disableCompetingOfficialVideoRows($organizationCode, $fixtureIds, $fastModelSeed, $proModelSeed, $now);

        return [
            'provider_id' => $fixtureIds['provider_id'],
            'config_id' => $fixtureIds['provider_config_id'],
            'fast_model_id' => $fixtureIds['fast_model_id'],
            'pro_model_id' => $fixtureIds['pro_model_id'],
        ];
    }

    protected function trackProviderTreeByProviderId(int $providerId): void
    {
        // 空实现，避免测试再依赖事务回滚。
    }

    protected function getOfficialVideoProvider(): ProviderModel
    {
        return ProviderModel::query()
            ->where('id', $this->officialVideoFixtureIds()['provider_id'])
            ->firstOrFail();
    }

    protected function getOfficialVideoProviderConfig(int $providerId): ProviderConfigModel
    {
        return ProviderConfigModel::query()
            ->where('id', $this->officialVideoFixtureIds()['provider_config_id'])
            ->where('service_provider_id', $providerId)
            ->firstOrFail();
    }

    protected function getOfficialVideoProviderConfigByEndpointKey(int $providerId, string $endpointKey): ?ProviderConfigModel
    {
        /** @var list<ProviderConfigModel> $providerConfigs */
        $providerConfigs = ProviderConfigModel::query()
            ->where('service_provider_id', $providerId)
            ->where('organization_code', $this->officialVideoFixtureOrganizationCode())
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->all();

        foreach ($providerConfigs as $providerConfig) {
            $config = is_array($providerConfig->config) ? $providerConfig->config : [];
            if (($config['_seed_endpoint_key'] ?? '') === $endpointKey) {
                return $providerConfig;
            }
        }

        return null;
    }

    protected function getOfficialVideoProviderModel(int $providerConfigId, string $modelId): ProviderModelModel
    {
        $providerModel = ProviderModelModel::query()
            ->where('service_provider_config_id', $providerConfigId)
            ->where('model_id', $modelId)
            ->orderBy('id')
            ->first();
        if ($providerModel instanceof ProviderModelModel) {
            return $providerModel;
        }

        $fixtureIds = $this->officialVideoFixtureIds();
        $providerModelId = $modelId === self::TEST_PRO_MODEL_ID
            ? $fixtureIds['pro_model_id']
            : $fixtureIds['fast_model_id'];

        return ProviderModelModel::query()
            ->where('id', $providerModelId)
            ->where('service_provider_config_id', $providerConfigId)
            ->where('model_id', $modelId)
            ->firstOrFail();
    }

    protected function getOfficialVideoCurrentPricing(int $providerModelId): ProviderModelConfigVersionModel
    {
        $fixtureIds = $this->officialVideoFixtureIds();
        $configVersionId = $providerModelId === $fixtureIds['pro_model_id']
            ? $fixtureIds['pro_model_config_version_id']
            : $fixtureIds['fast_model_config_version_id'];

        return ProviderModelConfigVersionModel::query()
            ->where('id', $configVersionId)
            ->where('service_provider_model_id', $providerModelId)
            ->where('is_current_version', true)
            ->firstOrFail();
    }

    /**
     * 返回固定 fixture 主键集合。
     * 调用方必须保证这些 ID 稳定且可复用，不能为了“隔离”改成随机值。
     *
     * @return array{
     *     provider_id: int,
     *     provider_config_id: int,
     *     fast_model_id: int,
     *     pro_model_id: int,
     *     fast_model_config_version_id: int,
     *     pro_model_config_version_id: int
     * }
     */
    abstract protected function officialVideoFixtureIds(): array;

    /**
     * 返回固定的官方测试组织编码。
     * 测试通过组织编码隔离官方语义，不允许复用真实组织编码。
     */
    abstract protected function officialVideoFixtureOrganizationCode(): string;

    /**
     * @return array{provider_sort: int, fast_model_sort: int, pro_model_sort: int}
     */
    protected function officialVideoFixtureSorts(): array
    {
        return [
            'provider_sort' => 2000000000,
            'fast_model_sort' => 1999999990,
            'pro_model_sort' => 1999999980,
        ];
    }

    /**
     * @param null|list<array<string, mixed>> $models
     * @return array<string, mixed>
     */
    protected function officialVideoProviderEndpointSeed(
        string $baseUrl,
        string $apiKey,
        string $endpointKey = 'default',
        ?array $models = null,
        ?array $provider = null,
        ?array $config = null,
        string $providerCode = 'Cloudsway'
    ): array {
        $providerSeed = array_merge(
            $this->officialVideoProviderSeed($providerCode),
            $provider ?? []
        );

        return [
            'provider_code' => $providerCode,
            'endpoint_key' => $endpointKey,
            'provider' => [
                'name' => $providerSeed['name'],
                'alias' => $providerSeed['alias'],
                'description' => $providerSeed['description'],
                'icon' => $providerSeed['icon'],
                'remark' => $providerSeed['remark'],
                'sort' => $providerSeed['sort'],
                'category' => $providerSeed['category'],
                'translate' => $providerSeed['translate'],
            ],
            'config' => array_merge([
                'base_url' => $baseUrl,
                'api_key' => $apiKey,
                'alias' => $providerSeed['alias'],
                'sort' => $providerSeed['sort'],
            ], $config ?? []),
            'models' => $models ?? $this->defaultOfficialVideoProviderModels(),
        ];
    }

    protected function officialFastVideoModelId(): string
    {
        return self::TEST_FAST_MODEL_ID;
    }

    protected function officialProVideoModelId(): string
    {
        return self::TEST_PRO_MODEL_ID;
    }

    protected function officialFastVideoModelVersion(): string
    {
        return self::TEST_FAST_MODEL_VERSION;
    }

    protected function officialProVideoModelVersion(): string
    {
        return self::TEST_PRO_MODEL_VERSION;
    }

    /**
     * @return array<string, mixed>
     */
    protected function officialVideoProviderSeed(string $providerCode = 'Cloudsway'): array
    {
        return [
            'provider_code' => $providerCode,
            'name' => 'Video Gateway',
            'alias' => 'Video Models',
            'description' => '聚合文生视频模型能力。',
            'icon' => 'MAGIC/713471849556451329/default/magic.png',
            'remark' => '聚合文生视频',
            'sort' => 1000,
            'category' => 'vgm',
            'translate' => [
                'name' => ['zh_CN' => '视频模型', 'en_US' => 'Video Gateway'],
                'description' => [
                    'zh_CN' => '聚合文生视频模型能力。',
                    'en_US' => 'Aggregated text-to-video model capabilities.',
                ],
                'alias' => ['zh_CN' => '视频模型', 'en_US' => 'Video Models'],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function officialVideoModelSeed(string $identifier): array
    {
        return match ($identifier) {
            self::TEST_FAST_MODEL_ID, self::TEST_FAST_MODEL_VERSION => [
                'model_id' => self::TEST_FAST_MODEL_ID,
                'model_version' => self::TEST_FAST_MODEL_VERSION,
                'name' => 'Veo 3.1 Fast',
                'description' => 'Google 文生视频模型，当前首期开放 Veo 3.1 Fast。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'sort' => 1000,
                'category' => 'vgm',
                'model_type' => 5,
                'load_balancing_weight' => 0,
                'translate' => [
                    'name' => ['zh_CN' => 'Veo 3.1 Fast', 'en_US' => 'Veo 3.1 Fast'],
                    'description' => [
                        'zh_CN' => 'Google 文生视频模型，当前首期开放 Veo 3.1 Fast。',
                        'en_US' => 'Google Veo 3.1 Fast text-to-video model.',
                    ],
                ],
                'config' => [],
                'visible_organizations' => [],
                'visible_applications' => [],
                'visible_packages' => [],
                'aggregate_config' => [],
                'status' => 1,
                'pricing' => [
                    'billing_type' => 'Times',
                    'billing_currency' => 'CNY',
                    'time_pricing' => '0.01',
                    'time_cost' => '0.01',
                    'input_pricing' => null,
                    'output_pricing' => null,
                    'cache_write_pricing' => null,
                    'cache_hit_pricing' => null,
                    'input_cost' => null,
                    'output_cost' => null,
                    'cache_write_cost' => null,
                    'cache_hit_cost' => null,
                    'official_recommended' => 1,
                ],
            ],
            self::TEST_PRO_MODEL_ID, self::TEST_PRO_MODEL_VERSION => [
                'model_id' => self::TEST_PRO_MODEL_ID,
                'model_version' => self::TEST_PRO_MODEL_VERSION,
                'name' => 'Veo 3.1 Pro',
                'description' => 'Google 文生视频模型，当前开放 Veo 3.1 Pro。',
                'icon' => 'MAGIC/713471849556451329/default/magic.png',
                'sort' => 990,
                'category' => 'vgm',
                'model_type' => 5,
                'load_balancing_weight' => 0,
                'translate' => [
                    'name' => ['zh_CN' => 'Veo 3.1 Pro', 'en_US' => 'Veo 3.1 Pro'],
                    'description' => [
                        'zh_CN' => 'Google 文生视频模型，当前开放 Veo 3.1 Pro。',
                        'en_US' => 'Google Veo 3.1 Pro text-to-video model.',
                    ],
                ],
                'config' => [],
                'visible_organizations' => [],
                'visible_applications' => [],
                'visible_packages' => [],
                'aggregate_config' => [],
                'status' => 1,
                'pricing' => [
                    'billing_type' => 'Times',
                    'billing_currency' => 'CNY',
                    'time_pricing' => '0.1',
                    'time_cost' => '0.1',
                    'input_pricing' => null,
                    'output_pricing' => null,
                    'cache_write_pricing' => null,
                    'cache_hit_pricing' => null,
                    'input_cost' => null,
                    'output_cost' => null,
                    'cache_write_cost' => null,
                    'cache_hit_cost' => null,
                    'official_recommended' => 1,
                ],
            ],
            default => [],
        };
    }

    private function insertOfficialVideoProviderModel(
        int $providerModelId,
        int $configVersionId,
        array $modelSeed,
        int $sort,
        string $organizationCode,
        int $providerConfigId,
        string $now
    ): void {
        ProviderModelConfigVersionModel::query()
            ->where('service_provider_model_id', $providerModelId)
            ->where('id', '!=', $configVersionId)
            ->update([
                'is_current_version' => 0,
                'updated_at' => $now,
            ]);

        $this->upsertProviderModel([
            'id' => $providerModelId,
            'service_provider_config_id' => $providerConfigId,
            'name' => $modelSeed['name'],
            'model_version' => $modelSeed['model_version'],
            'category' => $modelSeed['category'],
            'model_id' => $modelSeed['model_id'],
            'model_type' => $modelSeed['model_type'],
            'config' => json_encode([], JSON_THROW_ON_ERROR),
            'description' => $modelSeed['description'],
            'sort' => $sort,
            'icon' => $modelSeed['icon'],
            'organization_code' => $organizationCode,
            'status' => Status::Enabled->value,
            'disabled_by' => '',
            'translate' => json_encode($modelSeed['translate'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'model_parent_id' => 0,
            'visible_organizations' => json_encode([], JSON_THROW_ON_ERROR),
            'visible_applications' => json_encode([], JSON_THROW_ON_ERROR),
            'visible_packages' => json_encode([], JSON_THROW_ON_ERROR),
            'load_balancing_weight' => 0,
            'is_office' => 1,
            'super_magic_display_state' => 0,
            'type' => 'ATOM',
            'aggregate_config' => null,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => null,
        ], $now);

        $this->upsertProviderModelConfigVersion([
            'id' => $configVersionId,
            'service_provider_model_id' => $providerModelId,
            'creativity' => 0.5,
            'max_tokens' => null,
            'temperature' => null,
            'vector_size' => 2048,
            'billing_type' => $modelSeed['pricing']['billing_type'],
            'time_pricing' => (float) $modelSeed['pricing']['time_pricing'],
            'input_pricing' => null,
            'output_pricing' => null,
            'billing_currency' => $modelSeed['pricing']['billing_currency'],
            'support_function' => 0,
            'cache_hit_pricing' => null,
            'max_output_tokens' => null,
            'support_embedding' => 0,
            'support_deep_think' => 0,
            'cache_write_pricing' => null,
            'support_multi_modal' => 0,
            'official_recommended' => 1,
            'input_cost' => null,
            'output_cost' => null,
            'cache_hit_cost' => null,
            'cache_write_cost' => null,
            'time_cost' => (float) $modelSeed['pricing']['time_cost'],
            'version' => 1,
            'is_current_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ], $now);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function upsertProvider(array $payload, string $now): void
    {
        $updated = ProviderModel::query()
            ->where('id', $payload['id'])
            ->update(array_merge($payload, [
                'updated_at' => $now,
                'deleted_at' => null,
            ]));

        if ($updated > 0) {
            return;
        }

        if (ProviderModel::query()->where('id', $payload['id'])->exists()) {
            return;
        }

        ProviderModel::query()->insert($payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function upsertProviderConfig(array $payload, string $now): void
    {
        $updated = ProviderConfigModel::query()
            ->where('id', $payload['id'])
            ->update(array_merge($payload, [
                'updated_at' => $now,
                'deleted_at' => null,
            ]));

        if ($updated > 0) {
            return;
        }

        if (ProviderConfigModel::query()->where('id', $payload['id'])->exists()) {
            return;
        }

        ProviderConfigModel::query()->insert($payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function upsertProviderModel(array $payload, string $now): void
    {
        $updated = ProviderModelModel::query()
            ->where('id', $payload['id'])
            ->update(array_merge($payload, [
                'updated_at' => $now,
                'deleted_at' => null,
            ]));

        if ($updated > 0) {
            return;
        }

        if (ProviderModelModel::query()->where('id', $payload['id'])->exists()) {
            return;
        }

        ProviderModelModel::query()->insert($payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function upsertProviderModelConfigVersion(array $payload, string $now): void
    {
        $updated = ProviderModelConfigVersionModel::query()
            ->where('id', $payload['id'])
            ->update(array_merge($payload, [
                'updated_at' => $now,
            ]));

        if ($updated > 0) {
            return;
        }

        if (ProviderModelConfigVersionModel::query()->where('id', $payload['id'])->exists()) {
            return;
        }

        ProviderModelConfigVersionModel::query()->insert($payload);
    }

    /**
     * @param array{
     *     provider_id: int,
     *     provider_config_id: int,
     *     fast_model_id: int,
     *     pro_model_id: int,
     *     fast_model_config_version_id: int,
     *     pro_model_config_version_id: int
     * } $fixtureIds
     * @param array<string, mixed> $fastModelSeed
     * @param array<string, mixed> $proModelSeed
     */
    private function disableCompetingOfficialVideoRows(
        string $organizationCode,
        array $fixtureIds,
        array $fastModelSeed,
        array $proModelSeed,
        string $now
    ): void {
        ProviderConfigModel::query()
            ->where('organization_code', $organizationCode)
            ->where('provider_code', $this->officialVideoProviderSeed()['provider_code'])
            ->where('id', '!=', $fixtureIds['provider_config_id'])
            ->update([
                'status' => 0,
                'sort' => 0,
                'updated_at' => $now,
            ]);

        ProviderModelModel::query()
            ->where('organization_code', $organizationCode)
            ->where('id', '!=', $fixtureIds['fast_model_id'])
            ->where('id', '!=', $fixtureIds['pro_model_id'])
            ->where(function ($query) use ($fastModelSeed, $proModelSeed): void {
                $query->whereIn('model_id', [
                    $fastModelSeed['model_id'],
                    $proModelSeed['model_id'],
                ])->orWhereIn('model_version', [
                    $fastModelSeed['model_version'],
                    $proModelSeed['model_version'],
                ]);
            })
            ->update([
                'status' => 0,
                'updated_at' => $now,
            ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function defaultOfficialVideoProviderModels(): array
    {
        return [
            $this->officialVideoModelSeed(self::TEST_FAST_MODEL_ID),
            $this->officialVideoModelSeed(self::TEST_PRO_MODEL_ID),
        ];
    }
}

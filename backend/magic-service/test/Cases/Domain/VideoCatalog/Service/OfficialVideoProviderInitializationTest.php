<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\VideoCatalog\Service;

use App\Application\ModelGateway\Service\OfficialVideoProviderInitAppService;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class OfficialVideoProviderInitializationTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    private const string TEST_API_KEY = 'test-001';

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testSeederCreatesCloudswayMultiEndpointConfigsFromEmptyState(): void
    {
        $this->purgeOfficialProviderTree('Cloudsway');

        $this->initializeProviders([
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://cloudsway-video.mock.example.test',
                apiKey: self::TEST_API_KEY,
                endpointKey: 'veo',
                providerCode: 'Cloudsway',
                config: [
                    'sort' => 1100,
                ],
                models: [
                    $this->buildVideoModelSeed(
                        'veo-3.1-fast-generate-preview',
                        'LCnVzCkkMnVuIyrz',
                        'Veo 3.1 Fast',
                        1100,
                        '0.01',
                        'Google 文生视频模型，Veo 3.1 Fast，生成速度较快。',
                        'Google Veo 3.1 Fast text-to-video model with faster generation speed.'
                    ),
                    $this->buildVideoModelSeed(
                        'veo-3.1-generate-preview',
                        'LCnVzCkkMnVuIyrz',
                        'Veo 3.1 Pro',
                        1090,
                        '0.1',
                        'Google 文生视频模型，Veo 3.1 Pro，生成质量更高。',
                        'Google Veo 3.1 Pro text-to-video model with higher generation quality.'
                    ),
                ],
            ),
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://cloudsway-video.mock.example.test',
                apiKey: self::TEST_API_KEY,
                endpointKey: 'seedance',
                providerCode: 'Cloudsway',
                config: [
                    'sort' => 1080,
                ],
                models: [
                    $this->buildVideoModelSeed(
                        'seedance-1.5-pro',
                        'rrpvTsUlqilBwMXg',
                        'Seedance 1.5 Pro',
                        1080,
                        '0.05',
                        '字节跳动 Seedance 视频模型，Seedance 1.5 Pro。',
                        'ByteDance Seedance 1.5 Pro video model.'
                    ),
                ],
            ),
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://cloudsway-video.mock.example.test',
                apiKey: self::TEST_API_KEY,
                endpointKey: 'keling',
                providerCode: 'Cloudsway',
                config: [
                    'sort' => 1070,
                ],
                models: [
                    $this->buildVideoModelSeed(
                        'keling-3.0-video',
                        'YGNqszpCuuWLpyUt',
                        'KeLing 3.0 Video',
                        1070,
                        '0.05',
                        '快手可灵视频模型，KeLing 3.0 Video。',
                        'Kuaishou KeLing 3.0 video model.'
                    ),
                ],
            ),
        ]);

        $provider = ProviderModel::query()
            ->where('category', 'vgm')
            ->where('provider_code', 'Cloudsway')
            ->orderByDesc('sort_order')
            ->orderBy('id')
            ->firstOrFail();
        $providerTree = $this->loadProviderTree((int) $provider->id);
        $veoConfig = $providerTree['configsByEndpointKey']['veo'] ?? null;
        $seedanceConfig = $providerTree['configsByEndpointKey']['seedance'] ?? null;
        $kelingConfig = $providerTree['configsByEndpointKey']['keling'] ?? null;

        $this->assertInstanceOf(ProviderConfigModel::class, $veoConfig);
        $this->assertInstanceOf(ProviderConfigModel::class, $seedanceConfig);
        $this->assertInstanceOf(ProviderConfigModel::class, $kelingConfig);
        $this->assertSame(3, count($providerTree['providerConfigs']));
        $this->assertArrayNotHasKey('endpoint_path', $veoConfig->config);
        $this->assertArrayNotHasKey('endpoint_path', $seedanceConfig->config);
        $this->assertArrayNotHasKey('endpoint_path', $kelingConfig->config);
        $this->assertSame(self::TEST_API_KEY, $veoConfig->config['api_key'] ?? null);
        $this->assertSame(self::TEST_API_KEY, $seedanceConfig->config['api_key'] ?? null);
        $this->assertSame(self::TEST_API_KEY, $kelingConfig->config['api_key'] ?? null);
        $this->assertSame([
            'veo-3.1-fast-generate-preview',
            'veo-3.1-generate-preview',
            'seedance-1.5-pro',
            'keling-3.0-video',
        ], array_values(array_unique($this->collectModelIds(
            [
                (int) $veoConfig->id,
                (int) $seedanceConfig->id,
                (int) $kelingConfig->id,
            ],
            $providerTree['modelsByConfigId']
        ))));
    }

    public function testSeederRefreshesCloudswayModelVersionByModelIdWithoutCreatingDuplicateRows(): void
    {
        $providers = [
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://cloudsway-video.mock.example.test',
                apiKey: self::TEST_API_KEY,
                endpointKey: 'veo',
                providerCode: 'Cloudsway',
                config: [
                    'sort' => 1100,
                ],
                models: [
                    $this->buildVideoModelSeed(
                        'veo-3.1-generate-preview',
                        'LCnVzCkkMnVulyrz',
                        'Veo 3.1 Pro',
                        1090,
                        '0.1'
                    ),
                ],
            ),
        ];

        $this->initializeProviders($providers);

        $provider = ProviderModel::query()
            ->where('category', 'vgm')
            ->where('provider_code', 'Cloudsway')
            ->orderByDesc('sort_order')
            ->orderBy('id')
            ->firstOrFail();
        $providerConfig = $this->getOfficialVideoProviderConfigByEndpointKey((int) $provider->id, 'veo');
        $this->assertInstanceOf(ProviderConfigModel::class, $providerConfig);

        ProviderModelModel::query()
            ->where('service_provider_config_id', (int) $providerConfig->id)
            ->where('model_id', 'veo-3.1-generate-preview')
            ->update(['model_version' => 'MaaS_Veo_3.1_generate_preview']);

        $this->initializeProviders($providers);

        $models = ProviderModelModel::query()
            ->where('service_provider_config_id', (int) $providerConfig->id)
            ->where('model_id', 'veo-3.1-generate-preview')
            ->orderBy('id')
            ->get()
            ->all();

        $this->assertCount(1, $models);
        $this->assertSame('LCnVzCkkMnVulyrz', $models[0]->model_version);
    }

    private function buildVideoModelSeed(
        string $modelId,
        string $modelVersion,
        string $name,
        int $sort,
        string $timePricing,
        ?string $descriptionZh = null,
        ?string $descriptionEn = null,
    ): array {
        $descriptionZh ??= sprintf('%s 视频模型。', $name);
        $descriptionEn ??= sprintf('%s video model.', $name);

        return [
            'model_id' => $modelId,
            'model_version' => $modelVersion,
            'name' => $name,
            'description' => $descriptionZh,
            'icon' => 'MAGIC/713471849556451329/default/magic.png',
            'sort' => $sort,
            'category' => 'vgm',
            'model_type' => 5,
            'load_balancing_weight' => 100,
            'translate' => [
                'name' => ['zh_CN' => $name, 'en_US' => $name],
                'description' => ['zh_CN' => $descriptionZh, 'en_US' => $descriptionEn],
            ],
            'pricing' => [
                'billing_currency' => 'CNY',
                'billing_type' => 'Times',
                'time_pricing' => $timePricing,
                'time_cost' => $timePricing,
                'official_recommended' => 1,
            ],
        ];
    }

    /**
     * @param list<array<string, mixed>> $providers
     */
    private function initializeProviders(array $providers): array
    {
        return di(OfficialVideoProviderInitAppService::class)->initializeWithProviders($providers);
    }

    private function purgeOfficialProviderTree(string $providerCode): void
    {
        $providerConfigs = ProviderConfigModel::query()
            ->where('organization_code', self::TEST_OFFICIAL_ORGANIZATION_CODE)
            ->where('provider_code', $providerCode)
            ->get()
            ->all();
        $providerConfigIds = array_values(array_map(
            static fn (ProviderConfigModel $providerConfig): int => (int) $providerConfig->id,
            $providerConfigs
        ));

        if ($providerConfigIds !== []) {
            $providerModels = ProviderModelModel::query()
                ->whereIn('service_provider_config_id', $providerConfigIds)
                ->get()
                ->all();
            $providerModelIds = array_values(array_map(
                static fn (ProviderModelModel $providerModel): int => (int) $providerModel->id,
                $providerModels
            ));

            if ($providerModelIds !== []) {
                ProviderModelConfigVersionModel::query()
                    ->whereIn('service_provider_model_id', $providerModelIds)
                    ->delete();
            }

            ProviderModelModel::query()
                ->whereIn('service_provider_config_id', $providerConfigIds)
                ->delete();

            ProviderConfigModel::query()
                ->whereIn('id', $providerConfigIds)
                ->delete();
        }
    }

    /**
     * @return array{
     *     providerConfigs: list<ProviderConfigModel>,
     *     configsByEndpointKey: array<string, ProviderConfigModel>,
     *     modelsByConfigId: array<int, list<ProviderModelModel>>,
     *     modelsByConfigAndModelId: array<int, array<string, ProviderModelModel>>,
     *     currentPricingRowsByModelId: array<int, list<ProviderModelConfigVersionModel>>,
     *     currentPricingByModelId: array<int, ProviderModelConfigVersionModel>
     * }
     */
    private function loadProviderTree(int $providerId): array
    {
        /** @var list<ProviderConfigModel> $providerConfigs */
        $providerConfigs = ProviderConfigModel::query()
            ->where('service_provider_id', $providerId)
            ->where('organization_code', self::TEST_OFFICIAL_ORGANIZATION_CODE)
            ->where('status', 1)
            ->orderByDesc('sort')
            ->orderBy('id')
            ->get()
            ->all();

        $configsByEndpointKey = [];
        $providerConfigIds = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerConfigIds[] = (int) $providerConfig->id;
            $config = is_array($providerConfig->config) ? $providerConfig->config : [];
            $endpointKey = trim((string) ($config['_seed_endpoint_key'] ?? ''));
            if ($endpointKey !== '' && ! isset($configsByEndpointKey[$endpointKey])) {
                $configsByEndpointKey[$endpointKey] = $providerConfig;
            }
        }

        $modelsByConfigId = [];
        $modelsByConfigAndModelId = [];
        $providerModelIds = [];

        if ($providerConfigIds !== []) {
            /** @var list<ProviderModelModel> $providerModels */
            $providerModels = ProviderModelModel::query()
                ->whereIn('service_provider_config_id', $providerConfigIds)
                ->where('status', 1)
                ->orderByDesc('sort')
                ->orderBy('id')
                ->get()
                ->all();

            foreach ($providerModels as $providerModel) {
                $providerConfigId = (int) $providerModel->service_provider_config_id;
                if (! isset($modelsByConfigAndModelId[$providerConfigId][(string) $providerModel->model_id])) {
                    $modelsByConfigAndModelId[$providerConfigId][(string) $providerModel->model_id] = $providerModel;
                    $modelsByConfigId[$providerConfigId][] = $providerModel;
                    $providerModelIds[] = (int) $providerModel->id;
                }
            }
        }

        $currentPricingRowsByModelId = [];
        $currentPricingByModelId = [];
        if ($providerModelIds !== []) {
            /** @var list<ProviderModelConfigVersionModel> $pricingRows */
            $pricingRows = ProviderModelConfigVersionModel::query()
                ->whereIn('service_provider_model_id', $providerModelIds)
                ->where('is_current_version', true)
                ->orderBy('id')
                ->get()
                ->all();

            foreach ($pricingRows as $pricingRow) {
                $providerModelId = (int) $pricingRow->service_provider_model_id;
                $currentPricingRowsByModelId[$providerModelId][] = $pricingRow;
                if (! isset($currentPricingByModelId[$providerModelId])) {
                    $currentPricingByModelId[$providerModelId] = $pricingRow;
                }
            }
        }

        return [
            'providerConfigs' => $providerConfigs,
            'configsByEndpointKey' => $configsByEndpointKey,
            'modelsByConfigId' => $modelsByConfigId,
            'modelsByConfigAndModelId' => $modelsByConfigAndModelId,
            'currentPricingRowsByModelId' => $currentPricingRowsByModelId,
            'currentPricingByModelId' => $currentPricingByModelId,
        ];
    }

    /**
     * @param int[] $providerConfigIds
     * @param array<int, list<ProviderModelModel>> $modelsByConfigId
     * @return string[]
     */
    private function collectModelIds(array $providerConfigIds, array $modelsByConfigId): array
    {
        $modelIds = [];
        foreach ($providerConfigIds as $providerConfigId) {
            foreach ($modelsByConfigId[$providerConfigId] ?? [] as $providerModel) {
                $modelIds[] = (string) $providerModel->model_id;
            }
        }

        return $modelIds;
    }

    /**
     * @param list<ProviderModelModel> $providerModels
     * @param string[] $modelIds
     */
    private function countModelsByIds(array $providerModels, array $modelIds): int
    {
        return count(array_values(array_filter(
            $providerModels,
            static fn (ProviderModelModel $providerModel): bool => in_array((string) $providerModel->model_id, $modelIds, true)
        )));
    }
}

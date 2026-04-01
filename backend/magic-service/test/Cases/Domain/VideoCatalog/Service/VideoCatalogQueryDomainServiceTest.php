<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\VideoCatalog\Service;

use App\Application\ModelGateway\Service\OfficialVideoProviderInitAppService;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Domain\VideoCatalog\Entity\ValueObject\VideoCatalogProviderDefinition;
use App\Domain\VideoCatalog\Service\VideoCatalogQueryDomainService;
use HyperfTest\Support\UsesOfficialVideoProviderFixtures;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoCatalogQueryDomainServiceTest extends TestCase
{
    use UsesOfficialVideoProviderFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpOfficialVideoProviderIsolation();
        $this->createOfficialVideoProviderFixture('https://catalog.example.com', 'catalog-key');
    }

    protected function tearDown(): void
    {
        $this->tearDownOfficialVideoProviderIsolation();

        parent::tearDown();
    }

    public function testGetProvidersReturnsDatabaseBackedVideoProvider(): void
    {
        $service = new VideoCatalogQueryDomainService();
        $providers = $service->getProviders();

        $wuyinProvider = array_find(
            $providers,
            static fn (VideoCatalogProviderDefinition $provider): bool => $provider->getProviderCode() === 'Wuyin'
        );
        $this->assertNotNull($wuyinProvider);
        $this->assertNotEmpty($wuyinProvider->getConfigId());
        $this->assertSame('Video Gateway', $wuyinProvider->getName());
        $this->assertSame('vgm', $wuyinProvider->getCategory());
    }

    public function testGetProviderTemplateReturnsMatchingProviderDefinition(): void
    {
        $service = new VideoCatalogQueryDomainService();

        $providerTemplate = $service->getProviderTemplate((string) self::TEST_PROVIDER_CONFIG_ID);

        $this->assertNotNull($providerTemplate);
        $this->assertSame((string) self::TEST_PROVIDER_CONFIG_ID, $providerTemplate->getConfigId());
        $this->assertSame(self::TEST_PROVIDER_ID, $providerTemplate->getServiceProviderId());
        $this->assertSame('Wuyin', $providerTemplate->getProviderCode());
    }

    public function testQueryModelsDeduplicatesSameModelAcrossMultipleEndpoints(): void
    {
        $this->initializeProviders([
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://catalog.example.com',
                apiKey: 'catalog-key',
                endpointKey: 'default'
            ),
            $this->officialVideoProviderEndpointSeed(
                baseUrl: 'https://catalog-backup.example.com',
                apiKey: 'catalog-backup-key',
                endpointKey: 'backup',
                models: [
                    array_merge(
                        $this->officialVideoModelSeed($this->officialFastVideoModelId()),
                        ['load_balancing_weight' => 88]
                    ),
                    array_merge(
                        $this->officialVideoModelSeed($this->officialProVideoModelId()),
                        ['load_balancing_weight' => 66]
                    ),
                ],
                config: [
                    'alias' => 'Wuyin Backup',
                    'sort' => 900,
                ],
            ),
        ]);

        $provider = $this->getOfficialVideoProvider();
        $providerConfigDefault = $this->getOfficialVideoProviderConfigByEndpointKey((int) $provider->id, 'default');
        $providerConfigBackup = $this->getOfficialVideoProviderConfigByEndpointKey((int) $provider->id, 'backup');
        $this->assertNotNull($providerConfigDefault);
        $this->assertNotNull($providerConfigBackup);
        $this->assertSame(4, ProviderModelModel::query()
            ->whereIn('service_provider_config_id', [(int) $providerConfigDefault->id, (int) $providerConfigBackup->id])
            ->whereIn('model_id', [
                $this->officialFastVideoModelId(),
                $this->officialProVideoModelId(),
            ])
            ->selectRaw('distinct service_provider_config_id, model_id')
            ->get()
            ->count());

        $service = new VideoCatalogQueryDomainService();
        $models = $service->queryModels(ModelType::TEXT_TO_VIDEO->value, [
            $this->officialFastVideoModelId(),
            $this->officialProVideoModelId(),
        ]);

        $this->assertCount(2, $models);

        $modelsByModelId = [];
        foreach ($models as $model) {
            $modelsByModelId[$model->getModelId()] = $model;
            $this->assertGreaterThan(0, $model->getId());
            $this->assertSame(ModelType::TEXT_TO_VIDEO->value, $model->getModelType());
            $this->assertSame([], $model->getRuntimeConfig());
            $this->assertSame($model->getId(), $service->findModel((string) $model->getId())?->getId());
        }

        $this->assertSame('0.01', $modelsByModelId[$this->officialFastVideoModelId()]->getConfig()['time_pricing']);
        $this->assertSame('0.1', $modelsByModelId[$this->officialProVideoModelId()]->getConfig()['time_pricing']);
        $this->assertSame(
            $modelsByModelId[$this->officialFastVideoModelId()]->getId(),
            $service->findModel($this->officialFastVideoModelVersion())?->getId()
        );
        $this->assertSame(
            $modelsByModelId[$this->officialProVideoModelId()]->getId(),
            $service->findModel($this->officialProVideoModelVersion())?->getId()
        );
    }

    /**
     * @param list<array<string, mixed>> $providers
     */
    private function initializeProviders(array $providers): array
    {
        return di(OfficialVideoProviderInitAppService::class)->initializeWithProviders($providers);
    }
}

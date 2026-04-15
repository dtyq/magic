<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Mode\Service\ModeAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\ModelFilter\OrganizationBasedModelFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class ModeAppServiceTest extends TestCase
{
    public function testConfiguredVgmRelationsAreClassifiedAsVideoModels(): void
    {
        $service = $this->createService();
        $aggregate = $this->createAggregateWithRelations(['llm-model', 'vlm-model', 'vgm-model']);

        $videoModels = $this->invokePrivateMethod($service, 'getVideoModelsForAggregate', [
            $aggregate,
            [
                'llm-model' => $this->createProviderModel('llm-model', Category::LLM),
                'vlm-model' => $this->createProviderModel('vlm-model', Category::VLM),
                'vgm-model' => $this->createProviderModel('vgm-model', Category::VGM),
            ],
        ]);

        $this->assertSame(['vgm-model'], array_keys($videoModels));
        $this->assertSame(Category::VGM, $videoModels['vgm-model']->getCategory());
    }

    public function testConfiguredVgmRelationsAreExcludedFromTextModelCollection(): void
    {
        $service = $this->createService();
        $aggregate = $this->createAggregateWithRelations(['llm-model', 'vgm-model']);

        $models = $this->invokePrivateMethod($service, 'getModelsForAggregate', [
            $aggregate,
            [
                'llm-model' => $this->createProviderModel('llm-model', Category::LLM),
                'vgm-model' => $this->createProviderModel('vgm-model', Category::VGM),
            ],
        ]);

        $this->assertSame(['llm-model'], array_keys($models));
    }

    public function testBuildVideoGenerationConfigCandidatesReturnsAvailableProviderModels(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'veo-3.1-fast-generate-preview' => [
                    $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM, 'LCnVzCkkMnVulyrz', 11),
                ],
            ]
        );

        /** @var list<VideoGenerationConfigCandidate> $candidates */
        $candidates = $this->invokePrivateMethod($service, 'buildVideoGenerationConfigCandidates', [[
            'veo-3.1-fast-generate-preview',
        ]]);

        $this->assertCount(1, $candidates);
        $this->assertSame('veo-3.1-fast-generate-preview', $candidates[0]->getModelId());
        $this->assertSame('LCnVzCkkMnVulyrz', $candidates[0]->getModelVersion());
        $this->assertSame(ProviderCode::Cloudsway, $candidates[0]->getProviderCode());
    }

    public function testBuildModeRuntimeDataIncludesVideoModelsForFeaturedResponse(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'llm-model' => [
                    $this->createProviderModel('llm-model', Category::LLM, 'llm-version', 11),
                ],
                'vlm-model' => [
                    $this->createProviderModel('vlm-model', Category::VLM, 'vlm-version', 11),
                ],
                'veo-3.1-fast-generate-preview' => [
                    $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM, 'LCnVzCkkMnVulyrz', 11),
                ],
            ]
        );
        $authorization = (new MagicUserAuthorization())->setOrganizationCode('TGosRaFhvb');
        $aggregate = $this->createAggregateWithRelations([
            'llm-model',
            'vlm-model',
            'veo-3.1-fast-generate-preview',
        ]);

        $runtimeData = $this->invokePrivateMethod($service, 'buildModeRuntimeData', [
            $authorization,
            [$aggregate],
        ]);
        $modeAggregateDTO = $runtimeData['mode_aggregates']['general'];
        $groups = $this->invokePrivateMethod($service, 'buildModeGroups', [$modeAggregateDTO]);

        $this->assertSame(['3'], $groups[0]['video_model_ids']);
        $this->assertArrayHasKey('3', $runtimeData['models']);
        $this->assertSame(
            'veo-3.1-fast-generate-preview',
            $runtimeData['models']['3']->getModelId()
        );
        $this->assertNotNull($runtimeData['models']['3']->getVideoGenerationConfig());
        $config = $runtimeData['models']['3']->getVideoGenerationConfig();
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $config?->toArray()['supported_inputs']);
        $this->assertSame(0, $config?->toArray()['reference_images']['max_count']);
        $this->assertSame([], $config?->toArray()['reference_images']['reference_types']);
    }

    public function testBuildModeRuntimeDataIncludesCloudswayVeoProReferenceImageConstraint(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'veo-3.1-generate-preview' => [
                    $this->createProviderModel('veo-3.1-generate-preview', Category::VGM, 'LCnVzCkkMnVulyrz', 11),
                ],
            ]
        );
        $authorization = (new MagicUserAuthorization())->setOrganizationCode('TGosRaFhvb');
        $aggregate = $this->createAggregateWithRelations([
            'veo-3.1-generate-preview',
        ]);

        $runtimeData = $this->invokePrivateMethod($service, 'buildModeRuntimeData', [
            $authorization,
            [$aggregate],
        ]);

        $config = $runtimeData['models']['1']->getVideoGenerationConfig();
        $this->assertNotNull($config);
        $this->assertContains('reference_images', $config->toArray()['supported_inputs']);
        $this->assertSame(['asset'], $config->toArray()['reference_images']['reference_types']);
        $this->assertSame([
            'reference_images_requires_duration_seconds' => 8,
        ], $config->toArray()['constraints']);
    }

    public function testBuildModeRuntimeDataIncludesKelingResolutionConfigWithoutSizes(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'keling-3.0-video' => [
                    $this->createProviderModel('keling-3.0-video', Category::VGM, 'YGNqszpCuuWLpyUt', 11),
                ],
            ]
        );
        $authorization = (new MagicUserAuthorization())->setOrganizationCode('TGosRaFhvb');
        $aggregate = $this->createAggregateWithRelations([
            'keling-3.0-video',
        ]);

        $runtimeData = $this->invokePrivateMethod($service, 'buildModeRuntimeData', [
            $authorization,
            [$aggregate],
        ]);

        $config = $runtimeData['models']['1']->getVideoGenerationConfig();
        $this->assertNotNull($config);
        $this->assertSame(['720p', '1080p'], $config->toArray()['generation']['resolutions']);
        $this->assertSame('720p', $config->toArray()['generation']['default_resolution']);
        $this->assertArrayNotHasKey('sizes', $config->toArray()['generation']);
    }

    /**
     * @param array<int, ProviderConfigEntity> $providerConfigs
     * @param array<string, list<ProviderModelEntity>> $providerModelsByModelIds
     */
    private function createService(array $providerConfigs = [], array $providerModelsByModelIds = []): ModeAppService
    {
        $providerConfigRepository = $this->createMock(ProviderConfigRepositoryInterface::class);
        $providerConfigRepository
            ->method('getByIds')
            ->willReturnCallback(static fn (): array => $providerConfigs);
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository
            ->method('getByModelIds')
            ->willReturnCallback(static fn (): array => $providerModelsByModelIds);
        $organizationModelFilter = $this->createMock(OrganizationBasedModelFilterInterface::class);
        $organizationModelFilter
            ->method('filterModelsByOrganization')
            ->willReturnCallback(static fn (string $organizationCode, array $models): array => $models);
        $organizationModelFilter
            ->method('getUpgradeRequiredModelIds')
            ->willReturn([]);

        return new ModeAppService(
            new ModeDomainService(
                $this->createMock(ModeRepositoryInterface::class),
                $this->createMock(ModeGroupRepositoryInterface::class),
                $this->createMock(ModeGroupRelationRepositoryInterface::class)
            ),
            new ProviderModelDomainService(
                $providerModelRepository,
                $providerConfigRepository,
                $this->createMock(ProviderModelConfigVersionRepositoryInterface::class)
            ),
            new ModeGroupDomainService(
                $this->createMock(ModeGroupRepositoryInterface::class),
                $this->createMock(ModeGroupRelationRepositoryInterface::class),
                $this->createMock(ModeRepositoryInterface::class)
            ),
            new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)),
            new ProviderConfigDomainService(
                $providerConfigRepository,
                $this->createMock(ProviderModelRepositoryInterface::class),
                $this->createMock(ProviderRepositoryInterface::class),
                $this->createMock(LockerInterface::class)
            ),
            new VideoGenerationConfigDomainService($this->createVideoGenerateFactory()),
            $organizationModelFilter,
        );
    }

    private function createVideoGenerateFactory(): VideoGenerationProviderAdapterFactoryInterface
    {
        return new VideoGenerateFactory(
            new CloudswayVideoAdapterRouter(
                new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
            ),
            new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class))),
        );
    }

    /**
     * @param list<string> $modelIds
     */
    private function createAggregateWithRelations(array $modelIds): ModeAggregate
    {
        $mode = new ModeEntity([
            'id' => 1,
            'identifier' => 'general',
            'name_i18n' => ['zh_CN' => '通用'],
            'placeholder_i18n' => ['zh_CN' => '描述'],
            'status' => true,
        ]);
        $group = new ModeGroupEntity([
            'id' => 10,
            'mode_id' => 1,
            'name_i18n' => ['zh_CN' => '默认分组'],
            'status' => true,
        ]);

        $relations = [];
        foreach ($modelIds as $sort => $modelId) {
            $relations[] = new ModeGroupRelationEntity([
                'id' => $sort + 1,
                'mode_id' => 1,
                'group_id' => 10,
                'model_id' => $modelId,
                'provider_model_id' => $sort + 100,
                'sort' => 100 - $sort,
            ]);
        }

        return new ModeAggregate($mode, [
            new ModeGroupAggregate($group, $relations),
        ]);
    }

    private function createProviderModel(
        string $modelId,
        Category $category,
        ?string $modelVersion = null,
        int $serviceProviderConfigId = 1
    ): ProviderModelEntity {
        return new ProviderModelEntity([
            'id' => random_int(1000, 9999),
            'service_provider_config_id' => $serviceProviderConfigId,
            'name' => strtoupper($modelId),
            'model_id' => $modelId,
            'model_version' => $modelVersion ?? ($modelId . '-version'),
            'category' => $category->value,
            'status' => 1,
            'organization_code' => 'TGosRaFhvb',
            'config' => ['support_function' => true],
        ]);
    }

    private function createProviderConfigEntity(int $id, ProviderCode $providerCode): ProviderConfigEntity
    {
        return new ProviderConfigEntity([
            'id' => $id,
            'service_provider_id' => $id,
            'provider_code' => $providerCode->value,
            'status' => Status::Enabled->value,
            'organization_code' => 'TGosRaFhvb',
        ]);
    }

    /**
     * @param array<int, mixed> $arguments
     */
    private function invokePrivateMethod(object $target, string $methodName, array $arguments): mixed
    {
        $method = new ReflectionMethod($target, $methodName);
        $method->setAccessible(true);

        return $method->invokeArgs($target, $arguments);
    }
}

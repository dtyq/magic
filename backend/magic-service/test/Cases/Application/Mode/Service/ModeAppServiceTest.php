<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Mode\Service\ModeAppService;
use App\Application\Permission\Service\UserModelAccessAppService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAppService;
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
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\ModelFilter\OrganizationBasedModelFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\DashScopeVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan30VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiOmni1FlashVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter\GeminiVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingOmniVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Adapter\MiniMaxH3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Capability\MiniMaxH3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\MiniMaxVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Transport\ApiKeyMiniMaxTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance20MiniFastVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance20VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\Seedance25VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter\VolcengineArkVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance20GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance20MiniFastGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\Seedance25GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\ApplicationContext;
use Hyperf\Di\Container;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use RuntimeException;

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

    public function testBuildVideoGenerationConfigCandidatesFollowsRuntimeProviderPriority(): void
    {
        $service = $this->createService(
            [
                11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway),
                12 => $this->createProviderConfigEntity(12, ProviderCode::Cloudsway),
            ],
            [
                'veo-3.1-fast-generate-preview' => [
                    $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM, 'sort-low', 11, sort: 0, id: 1001),
                    $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM, 'sort-high-config-low', 11, sort: 9, id: 1002),
                    $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM, 'sort-high-config-high', 12, sort: 9, id: 1003),
                ],
            ]
        );

        /** @var list<VideoGenerationConfigCandidate> $candidates */
        $candidates = $this->invokePrivateMethod($service, 'buildVideoGenerationConfigCandidates', [[
            'veo-3.1-fast-generate-preview',
        ]]);

        // 必须与运行时一致：sort desc → service_provider_config_id desc → id asc，取首条
        $this->assertCount(3, $candidates);
        $this->assertSame(
            ['sort-high-config-high', 'sort-high-config-low', 'sort-low'],
            array_map(static fn (VideoGenerationConfigCandidate $candidate): string => $candidate->getModelVersion(), $candidates)
        );
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

    public function testGetModelsBatchExcludesDynamicModelWhenAllChildrenDisabled(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'dynamic-model' => [
                    $this->createProviderModel(
                        'dynamic-model',
                        Category::LLM,
                        'dynamic-version',
                        0,
                        Status::Enabled,
                        ProviderModelType::DYNAMIC,
                        ['models' => ['atom-model']]
                    ),
                ],
                'atom-model' => [
                    $this->createProviderModel(
                        'atom-model',
                        Category::LLM,
                        'atom-version',
                        11,
                        Status::Disabled
                    ),
                ],
            ]
        );

        $models = $this->invokePrivateMethod($service, 'getModelsBatch', [['dynamic-model']]);

        $this->assertSame([], $models);
    }

    public function testGetModelsBatchKeepsDynamicModelWhenChildIsEnabled(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'dynamic-model' => [
                    $this->createProviderModel(
                        'dynamic-model',
                        Category::LLM,
                        'dynamic-version',
                        0,
                        Status::Enabled,
                        ProviderModelType::DYNAMIC,
                        ['models' => ['atom-model']]
                    ),
                ],
                'atom-model' => [
                    $this->createProviderModel(
                        'atom-model',
                        Category::LLM,
                        'atom-version',
                        11,
                        Status::Enabled
                    ),
                ],
            ]
        );

        $models = $this->invokePrivateMethod($service, 'getModelsBatch', [['dynamic-model']]);

        $this->assertArrayHasKey('dynamic-model', $models);
        $this->assertSame('dynamic-model', $models['dynamic-model']->getModelId());
        $this->assertTrue($models['dynamic-model']->isDynamicModel());
    }

    public function testGetModelsBatchKeepsNestedDynamicModelWhenLeafIsEnabled(): void
    {
        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'dynamic-root' => [
                    $this->createProviderModel(
                        'dynamic-root',
                        Category::LLM,
                        'dynamic-root-version',
                        0,
                        Status::Enabled,
                        ProviderModelType::DYNAMIC,
                        ['models' => ['dynamic-mid']]
                    ),
                ],
                'dynamic-mid' => [
                    $this->createProviderModel(
                        'dynamic-mid',
                        Category::LLM,
                        'dynamic-mid-version',
                        0,
                        Status::Enabled,
                        ProviderModelType::DYNAMIC,
                        ['models' => [['model_id' => 'atom-leaf']]]
                    ),
                ],
                'atom-leaf' => [
                    $this->createProviderModel(
                        'atom-leaf',
                        Category::LLM,
                        'atom-leaf-version',
                        11,
                        Status::Enabled
                    ),
                ],
            ]
        );

        $models = $this->invokePrivateMethod($service, 'getModelsBatch', [['dynamic-root']]);

        $this->assertArrayHasKey('dynamic-root', $models);
        $this->assertArrayHasKey('dynamic-mid', $models);
        $this->assertArrayHasKey('atom-leaf', $models);
    }

    public function testBuildModeRuntimeDataIncludesKelingResolutionAndSizeConfig(): void
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
        $this->assertCount(6, $config->toArray()['generation']['sizes']);
        $this->assertSame([
            'label' => '16:9',
            'value' => '1280x720',
            'width' => 1280,
            'height' => 720,
            'resolution' => '720p',
        ], $config->toArray()['generation']['sizes'][0]);
    }

    /**
     * @dataProvider featuredAgentI18nFallbackProvider
     */
    public function testGetFeaturedAgentUsesI18nNameAndDescriptionFallback(
        array $nameI18n,
        array $descriptionI18n,
        string $expectedName,
        string $expectedDescription
    ): void {
        CoContext::setLanguage('zh_CN');

        $aggregate = $this->createAggregateWithRelations(['llm-model']);
        $modeDomainService = $this->createMock(ModeDomainService::class);
        $modeDomainService
            ->method('getModes')
            ->willReturn(['list' => [$aggregate->getMode()]]);
        $modeDomainService
            ->method('batchBuildModeAggregates')
            ->willReturn([$aggregate]);

        $service = $this->createService(
            [11 => $this->createProviderConfigEntity(11, ProviderCode::Cloudsway)],
            [
                'llm-model' => [
                    $this->createProviderModel('llm-model', Category::LLM, 'llm-version', 11),
                ],
            ],
            null,
            $modeDomainService
        );

        $agent = $this->createFeaturedAgent($nameI18n, $descriptionI18n);
        $superMagicAgentAppService = $this->createMock(SuperMagicAgentAppService::class);
        $superMagicAgentAppService
            ->method('getFeaturedAgent')
            ->willReturn([
                'frequent' => [$agent],
                'all' => [],
                'total' => 1,
                'playbooks' => [],
            ]);
        $userModelAccessAppService = $this->createMock(UserModelAccessAppService::class);
        $userModelAccessAppService
            ->method('resolveAccessContext')
            ->willReturn([
                'is_restricted' => false,
                'accessible_model_id_map' => [],
            ]);

        $authorization = (new MagicUserAuthorization())->setOrganizationCode('TGosRaFhvb');
        $result = $this->withContainerBindings([
            SuperMagicAgentAppService::class => $superMagicAgentAppService,
            UserModelAccessAppService::class => $userModelAccessAppService,
        ], static fn () => $service->getFeaturedAgent($authorization));

        $this->assertSame($expectedName, $result['list'][0]['mode']['name']);
        $this->assertSame($expectedDescription, $result['list'][0]['mode']['description']);
        $this->assertSame('描述', $result['list'][0]['mode']['placeholder']);
    }

    public static function featuredAgentI18nFallbackProvider(): array
    {
        return [
            'current language value' => [
                ['zh_CN' => '当前名称', 'default' => '默认名称'],
                ['zh_CN' => '当前描述', 'default' => '默认描述'],
                '当前名称',
                '当前描述',
            ],
            'default value' => [
                ['default' => '默认名称'],
                ['default' => '默认描述'],
                '默认名称',
                '默认描述',
            ],
            'scalar value' => [
                [],
                [],
                'Scalar Name',
                'Scalar Description',
            ],
        ];
    }

    /**
     * @param array<int, ProviderConfigEntity> $providerConfigs
     * @param array<string, list<ProviderModelEntity>> $providerModelsByModelIds
     */
    private function createService(
        array $providerConfigs = [],
        array $providerModelsByModelIds = [],
        ?OrganizationBasedModelFilterInterface $organizationModelFilter = null,
        ?ModeDomainService $modeDomainService = null
    ): ModeAppService {
        $providerConfigRepository = $this->createMock(ProviderConfigRepositoryInterface::class);
        $providerConfigRepository
            ->method('getByIds')
            ->willReturnCallback(static fn (): array => $providerConfigs);
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository
            ->method('getByModelIds')
            ->willReturnCallback(
                static fn ($dataIsolation, array $modelIds): array => array_intersect_key(
                    $providerModelsByModelIds,
                    array_fill_keys($modelIds, true)
                )
            );
        if ($organizationModelFilter === null) {
            $organizationModelFilter = $this->createMock(OrganizationBasedModelFilterInterface::class);
            $organizationModelFilter
                ->method('filterModelsByOrganization')
                ->willReturnCallback(static fn (string $organizationCode, array $models): array => $models);
            $organizationModelFilter
                ->method('getUpgradeRequiredModelIds')
                ->willReturn([]);
        }

        return new ModeAppService(
            $modeDomainService ?? new ModeDomainService(
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
            new KelingVideoAdapterRouter(
                new KelingOmniVideoAdapter(
                    new KelingOmniGenerationCapabilityProvider(),
                    new KelingTransportFactory(
                        new ApiKeyKelingTransport(
                            new KelingVideoClient($this->createMock(ClientFactory::class))
                        )
                    )
                )
            ),
            $this->createVolcengineArkRouter($this->createMock(ClientFactory::class)),
            new DashScopeVideoAdapterRouter(new Wan30VideoAdapter(
                new Wan30GenerationCapabilityProvider(),
                $this->createMock(DashScopeTransportInterface::class),
            )),
            new MiniMaxH3VideoAdapter(
                new MiniMaxH3GenerationCapabilityProvider(),
                new ApiKeyMiniMaxTransport(new MiniMaxVideoClient($this->createMock(ClientFactory::class))),
            ),
            new GeminiVideoAdapterRouter(
                new GeminiOmni1FlashVideoAdapter(
                    new GeminiOmniGenerationCapabilityProvider(),
                    $this->createMock(GeminiTransportInterface::class),
                ),
            ),
        );
    }

    private function createVolcengineArkRouter(ClientFactory $clientFactory): VolcengineArkVideoAdapterRouter
    {
        return new VolcengineArkVideoAdapterRouter(
            new Seedance20MiniFastVideoAdapter(
                new Seedance20MiniFastGenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
            new Seedance20VideoAdapter(
                new Seedance20GenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
            new Seedance25VideoAdapter(
                new Seedance25GenerationCapabilityProvider(),
                new VolcengineArkVideoClient($clientFactory),
            ),
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
        int $serviceProviderConfigId = 1,
        Status $status = Status::Enabled,
        ProviderModelType $providerModelType = ProviderModelType::ATOM,
        ?array $aggregateConfig = null,
        int $sort = 0,
        ?int $id = null
    ): ProviderModelEntity {
        return new ProviderModelEntity([
            'id' => $id ?? random_int(1000, 9999),
            'service_provider_config_id' => $serviceProviderConfigId,
            'name' => strtoupper($modelId),
            'model_id' => $modelId,
            'model_version' => $modelVersion ?? ($modelId . '-version'),
            'category' => $category->value,
            'status' => $status->value,
            'sort' => $sort,
            'type' => $providerModelType->value,
            'aggregate_config' => $aggregateConfig,
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

    private function createFeaturedAgent(array $nameI18n, array $descriptionI18n): SuperMagicAgentEntity
    {
        $agent = new SuperMagicAgentEntity();
        $agent->setCode('general');
        $agent->setName('Scalar Name');
        $agent->setDescription('Scalar Description');
        $agent->setNameI18n($nameI18n);
        $agent->setDescriptionI18n($descriptionI18n);
        $agent->setIcon([]);

        return $agent;
    }

    private function withContainerBindings(array $bindings, callable $callback): mixed
    {
        $container = ApplicationContext::getContainer();
        if (! $container instanceof Container) {
            throw new RuntimeException('ModeAppServiceTest requires Hyperf DI container.');
        }

        $originalBindings = [];
        foreach (array_keys($bindings) as $id) {
            $originalBindings[$id] = $container->get($id);
        }
        foreach ($bindings as $id => $binding) {
            $container->set($id, $binding);
        }

        try {
            return $callback();
        } finally {
            foreach ($originalBindings as $id => $binding) {
                $container->set($id, $binding);
            }
        }
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

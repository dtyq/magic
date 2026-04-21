<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Service;

use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupModelDTO;
use App\Application\Mode\Service\AdminModeAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Mode\Service\ModeGroupDomainService;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\AggregateStrategy;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\ModelFilter\OrganizationBasedModelFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use ArrayObject;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class AdminModeAppServiceTest extends TestCase
{
    public function testProcessDynamicModelsUsesRelationIdToDetectExistingDynamicModel(): void
    {
        $modeDomainService = $this->createMock(ModeDomainService::class);
        $dynamicModel = $this->createProviderModel(
            id: '873224246247403521',
            modelId: '6ee5aa3a700bb66ef14770eb5c6a2671',
            category: Category::LLM,
            type: 'DYNAMIC'
        );
        $modeDomainService->method('getModeGroupRelationsIndexedById')->willReturn([
            'stale-relation-id' => $this->createMock(ModeGroupRelationEntity::class),
        ]);
        $syncCalls = new ArrayObject();
        $providerModelDomainService = $this->createProviderModelDomainService(
            modelsByModelId: [],
            syncResult: $dynamicModel,
            syncCalls: $syncCalls,
        );
        $service = $this->createService($modeDomainService, $providerModelDomainService);
        $authorization = new MagicUserAuthorization();
        $aggregateDTO = $this->createAggregateDTO([
            $this->createModelDTO([
                'id' => 'stale-relation-id',
                'group_id' => '10',
                'model_id' => '6ee5aa3a700bb66ef14770eb5c6a2671',
                'provider_model_id' => '873224246247403521',
                'model_name' => '动态模型',
                'model_type' => 'dynamic',
                'model_category' => 'llm',
                'aggregate_config' => [
                    'models' => [
                        ['model_id' => 'gemini-3-pro-preview'],
                    ],
                    'strategy' => 'permission_fallback',
                    'strategy_config' => ['order' => 'asc'],
                ],
            ]),
        ]);

        $this->invokePrivateMethod($service, 'processDynamicModels', [$authorization, $aggregateDTO]);

        /** @var AdminModeGroupModelDTO $modelDTO */
        $modelDTO = $aggregateDTO->getGroups()[0]->getModels()[0];
        $this->assertCount(1, $syncCalls);
        $this->assertSame('6ee5aa3a700bb66ef14770eb5c6a2671', $syncCalls[0]['modelId']);
        $this->assertSame(AggregateStrategy::PERMISSION_FALLBACK, $syncCalls[0]['strategy']);
        $this->assertSame('6ee5aa3a700bb66ef14770eb5c6a2671', $modelDTO->getModelId());
        $this->assertSame('873224246247403521', $modelDTO->getProviderModelId());
        $this->assertSame('llm', $modelDTO->getModelCategory());
    }

    public function testProcessDynamicModelsHandlesDynamicModelInVideoModels(): void
    {
        $modeDomainService = $this->createMock(ModeDomainService::class);
        $modeDomainService->method('getModeGroupRelationsIndexedById')->willReturn([]);
        $dynamicVideoModel = $this->createProviderModel(
            id: '893883549354524672',
            modelId: 'veo-3.1-generate-preview',
            category: Category::VGM
        );
        $syncCalls = new ArrayObject();
        $providerModelDomainService = $this->createProviderModelDomainService(
            syncResult: $dynamicVideoModel,
            syncCalls: $syncCalls,
        );
        $service = $this->createService($modeDomainService, $providerModelDomainService);
        $authorization = new MagicUserAuthorization();
        $aggregateDTO = $this->createAggregateDTO(models: [], videoModels: [
            $this->createModelDTO([
                'id' => 'video-dynamic-relation',
                'group_id' => '10',
                'model_id' => 'veo-3.1-generate-preview',
                'provider_model_id' => '',
                'model_name' => 'Veo 3.1 Pro',
                'model_type' => 'dynamic',
                'model_category' => 'vgm',
                'aggregate_config' => [
                    'models' => [
                        ['model_id' => 'veo-3.1-fast-generate-preview'],
                    ],
                    'strategy' => 'permission_fallback',
                    'strategy_config' => ['order' => 'asc'],
                ],
            ]),
        ]);

        $this->invokePrivateMethod($service, 'processDynamicModels', [$authorization, $aggregateDTO]);

        /** @var AdminModeGroupModelDTO $modelDTO */
        $modelDTO = $aggregateDTO->getGroups()[0]->getVideoModels()[0];
        $this->assertCount(1, $syncCalls);
        $this->assertSame('veo-3.1-generate-preview', $syncCalls[0]['modelId']);
        $this->assertSame('vgm', $syncCalls[0]['category']);
        $this->assertSame('veo-3.1-generate-preview', $modelDTO->getModelId());
        $this->assertSame('893883549354524672', $modelDTO->getProviderModelId());
    }

    private function createService(
        ModeDomainService $modeDomainService,
        ProviderModelDomainService $providerModelDomainService
    ): AdminModeAppService {
        $modeDataIsolation = new ModeDataIsolation('TGosRaFhvb', 'usi_test');
        $groupDomainService = $this->createMock(ModeGroupDomainService::class);
        $fileDomainService = new FileDomainService($this->createMock(CloudFileRepositoryInterface::class));
        $providerConfigDomainService = new ProviderConfigDomainService(
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelRepositoryInterface::class),
            $this->createMock(ProviderRepositoryInterface::class),
            $this->createMock(LockerInterface::class)
        );
        $videoGenerationConfigDomainService = new VideoGenerationConfigDomainService(
            $this->createMock(VideoGenerationProviderAdapterFactoryInterface::class)
        );
        $organizationModelFilter = $this->createMock(OrganizationBasedModelFilterInterface::class);

        return new class($modeDomainService, $providerModelDomainService, $groupDomainService, $fileDomainService, $providerConfigDomainService, $videoGenerationConfigDomainService, $organizationModelFilter, $modeDataIsolation) extends AdminModeAppService {
            public function __construct(
                ModeDomainService $modeDomainService,
                ProviderModelDomainService $providerModelDomainService,
                ModeGroupDomainService $groupDomainService,
                FileDomainService $fileDomainService,
                ProviderConfigDomainService $providerConfigDomainService,
                VideoGenerationConfigDomainService $videoGenerationConfigDomainService,
                ?OrganizationBasedModelFilterInterface $organizationModelFilter,
                private readonly ModeDataIsolation $modeDataIsolation
            ) {
                parent::__construct(
                    $modeDomainService,
                    $providerModelDomainService,
                    $groupDomainService,
                    $fileDomainService,
                    $providerConfigDomainService,
                    $videoGenerationConfigDomainService,
                    $organizationModelFilter
                );
            }

            protected function getModeDataIsolation(MagicUserAuthorization $authorization): ModeDataIsolation
            {
                return $this->modeDataIsolation;
            }
        };
    }

    /**
     * @param list<AdminModeGroupModelDTO> $models
     * @param list<AdminModeGroupModelDTO> $imageModels
     * @param list<AdminModeGroupModelDTO> $videoModels
     */
    private function createAggregateDTO(array $models = [], array $imageModels = [], array $videoModels = []): AdminModeAggregateDTO
    {
        $aggregateDTO = new AdminModeAggregateDTO();
        $aggregateDTO->setMode(new AdminModeDTO([
            'id' => '821020773216972802',
            'identifier' => 'default',
            'name_i18n' => ['zh_CN' => '默认模式'],
            'status' => true,
        ]));
        $aggregateDTO->setGroups([
            new AdminModeGroupAggregateDTO(
                new AdminModeGroupDTO([
                    'id' => '10',
                    'mode_id' => '821020773216972802',
                    'name_i18n' => ['zh_CN' => '默认分组'],
                    'status' => true,
                ]),
                $models,
                $imageModels,
                $videoModels
            ),
        ]);

        return $aggregateDTO;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function createModelDTO(array $data): AdminModeGroupModelDTO
    {
        return new AdminModeGroupModelDTO($data);
    }

    private function createProviderModel(
        string $id,
        string $modelId,
        Category $category,
        string $type = 'ATOM',
        string $configId = '1',
        string $organizationCode = 'TGosRaFhvb'
    ): ProviderModelEntity {
        return new ProviderModelEntity([
            'id' => $id,
            'service_provider_config_id' => (int) $configId,
            'name' => $modelId,
            'model_id' => $modelId,
            'model_version' => $modelId . '-version',
            'category' => $category->value,
            'status' => 1,
            'type' => $type,
            'organization_code' => $organizationCode,
            'config' => ['support_function' => true],
        ]);
    }

    /**
     * @param array<string, ProviderModelEntity> $modelsByLookup
     * @param array<string, ProviderModelEntity> $modelsByModelId
     */
    private function createProviderModelDomainService(
        array $modelsByLookup = [],
        array $modelsByModelId = [],
        ?ProviderModelEntity $syncResult = null,
        ?ArrayObject $syncCalls = null
    ): ProviderModelDomainService {
        return new readonly class($this->createMock(ProviderModelRepositoryInterface::class), $this->createMock(ProviderConfigRepositoryInterface::class), $this->createMock(ProviderModelConfigVersionRepositoryInterface::class), $modelsByLookup, $modelsByModelId, $syncResult, $syncCalls ?? new ArrayObject()) extends ProviderModelDomainService {
            /**
             * @param array<string, ProviderModelEntity> $modelsByLookup
             * @param array<string, ProviderModelEntity> $modelsByModelId
             */
            public function __construct(
                ProviderModelRepositoryInterface $providerModelRepository,
                ProviderConfigRepositoryInterface $providerConfigRepository,
                ProviderModelConfigVersionRepositoryInterface $providerModelConfigVersionRepository,
                private array $modelsByLookup,
                private array $modelsByModelId,
                private ?ProviderModelEntity $syncResult,
                public ArrayObject $syncCalls,
            ) {
                parent::__construct(
                    $providerModelRepository,
                    $providerConfigRepository,
                    $providerModelConfigVersionRepository
                );
            }

            public function getAvailableByModelIdOrId(
                ProviderDataIsolation $dataIsolation,
                string $modelId,
                bool $checkStatus = true
            ): ?ProviderModelEntity {
                return $this->modelsByLookup[$modelId] ?? null;
            }

            public function getByModelId(ProviderDataIsolation $dataIsolation, string $modelId): ?ProviderModelEntity
            {
                return $this->modelsByModelId[$modelId] ?? null;
            }

            public function syncAggregateModel(
                ProviderDataIsolation $dataIsolation,
                string $modelId,
                string $name,
                array $subModels,
                AggregateStrategy $strategy = AggregateStrategy::PERMISSION_FALLBACK,
                array $strategyConfig = ['order' => 'asc'],
                string $icon = '',
                string $description = '',
                array $translate = [],
                string $category = ''
            ): ProviderModelEntity {
                $this->syncCalls->append([
                    'modelId' => $modelId,
                    'name' => $name,
                    'subModels' => $subModels,
                    'strategy' => $strategy,
                    'strategyConfig' => $strategyConfig,
                    'icon' => $icon,
                    'description' => $description,
                    'translate' => $translate,
                    'category' => $category,
                ]);

                return $this->syncResult ?? ($this->modelsByModelId[$modelId] ?? $this->modelsByLookup[$modelId]);
            }
        };
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

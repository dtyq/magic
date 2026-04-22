<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\AggregateModelResolverService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ModelAccessContext;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AggregateModelResolverServiceTest extends TestCase
{
    public function testResolveSkipsDeniedChildAndFallsBackToNextAccessibleModel(): void
    {
        $rootModel = $this->makeDynamicModel('dynamic-root', ['model-a', 'model-b']);
        $service = $this->createService([
            'dynamic-root' => $rootModel,
        ]);

        $resolvedModelId = $service->resolve(
            'dynamic-root',
            $this->createDataIsolation(['model-a', 'model-b']),
            new ModelAccessContext(PermissionControlStatus::ENABLED, ['model-a'], ['dynamic-root', 'model-b'])
        );

        $this->assertSame('model-b', $resolvedModelId);
    }

    public function testResolveSupportsNestedDynamicModels(): void
    {
        $rootModel = $this->makeDynamicModel('dynamic-root', ['dynamic-child']);
        $childModel = $this->makeDynamicModel('dynamic-child', ['model-c']);
        $service = $this->createService([
            'dynamic-root' => $rootModel,
            'dynamic-child' => $childModel,
        ]);

        $resolvedModelId = $service->resolve(
            'dynamic-root',
            $this->createDataIsolation(['dynamic-child', 'model-c']),
            new ModelAccessContext(PermissionControlStatus::ENABLED, [], ['dynamic-root', 'dynamic-child', 'model-c'])
        );

        $this->assertSame('model-c', $resolvedModelId);
    }

    public function testResolveIgnoresUserAccessContextWhenPermissionControlDisabled(): void
    {
        $rootModel = $this->makeDynamicModel('dynamic-root', ['model-a', 'model-b']);
        $service = $this->createService([
            'dynamic-root' => $rootModel,
        ]);

        $resolvedModelId = $service->resolve(
            'dynamic-root',
            $this->createDataIsolation(['model-a', 'model-b']),
            new ModelAccessContext(PermissionControlStatus::DISABLED, [], ['dynamic-root'])
        );

        $this->assertSame('model-a', $resolvedModelId);
    }

    public function testResolveModelReturnsNullWhenCircularDynamicModelsHaveNoAccessibleLeaf(): void
    {
        $rootModel = $this->makeDynamicModel('dynamic-root', ['dynamic-child']);
        $childModel = $this->makeDynamicModel('dynamic-child', ['dynamic-root']);
        $service = $this->createService([
            'dynamic-root' => $rootModel,
            'dynamic-child' => $childModel,
        ]);

        $this->assertNull($service->resolveModel(
            $rootModel,
            $this->createDataIsolation(['dynamic-child']),
            new ModelAccessContext(PermissionControlStatus::ENABLED, [], ['dynamic-root', 'dynamic-child'])
        ));
    }

    /**
     * @param array<string, ProviderModelEntity> $models
     */
    private function createService(array $models): AggregateModelResolverService
    {
        $repository = $this->createMock(ProviderModelRepositoryInterface::class);

        return new readonly class($repository, $models) extends AggregateModelResolverService {
            /**
             * @param array<string, ProviderModelEntity> $models
             */
            public function __construct(
                ProviderModelRepositoryInterface $providerModelRepository,
                private array $models
            ) {
                parent::__construct($providerModelRepository);
            }

            protected function getProviderModel(string $modelId, ModelGatewayDataIsolation $dataIsolation): ?ProviderModelEntity
            {
                return $this->models[$modelId] ?? null;
            }
        };
    }

    /**
     * @param list<string> $availableModelIds
     */
    private function createDataIsolation(array $availableModelIds): ModelGatewayDataIsolation
    {
        $subscriptionManager = new class($availableModelIds) extends BaseSubscriptionManager {
            /**
             * @param list<string> $availableModelIds
             */
            public function __construct(private array $availableModelIds)
            {
            }

            public function getAvailableModelIds(?ModelType $modelType): ?array
            {
                return $this->availableModelIds;
            }
        };
        $subscriptionManager->setEnabled(true);

        return new class($subscriptionManager) extends ModelGatewayDataIsolation {
            public function __construct(private BaseSubscriptionManager $subscriptionManager)
            {
            }

            public function getSubscriptionManager(): BaseSubscriptionManager
            {
                return $this->subscriptionManager;
            }

            public function getCurrentOrganizationCode(): string
            {
                return 'ORG_TEST';
            }

            public function getCurrentUserId(): string
            {
                return 'user-1';
            }

            public function getMagicId(): string
            {
                return 'magic-1';
            }
        };
    }

    /**
     * @param list<string> $subModelIds
     */
    private function makeDynamicModel(string $modelId, array $subModelIds): ProviderModelEntity
    {
        return (new ProviderModelEntity())
            ->setModelId($modelId)
            ->setModelType(ModelType::LLM)
            ->setType(ProviderModelType::DYNAMIC)
            ->setAggregateConfig([
                'models' => $subModelIds,
                'strategy' => 'permission_fallback',
                'strategy_config' => ['order' => 'asc'],
            ]);
    }
}

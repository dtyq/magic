<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowAIModelQuery;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Domain\Flow\Service\MagicFlowAIModelDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use HyperfTest\Cases\BaseTest;
use HyperfTest\Cases\Domain\Flow\Entity\MockMagicFlowAIModelEntity;

/**
 * @internal
 */
class MagicFlowAIModelDomainServiceTest extends BaseTest
{
    public function testSave()
    {
        $repository = $this->getRepositoryTemplate();
        $service = new MagicFlowAIModelDomainService($repository);
        $entity = MockMagicFlowAIModelEntity::createMockMagicFlowAIModelEntity('glm-4-9b');
        $entity->setId(null);
        $this->assertNull($entity->getId());
        $entity = $service->save(FlowDataIsolation::create('DT001'), $entity);
        $this->assertNotNull($entity->getId());
    }

    public function testGetByName()
    {
        $repository = $this->getRepositoryTemplate();
        $service = new MagicFlowAIModelDomainService($repository);
        $entity = $service->getByName(FlowDataIsolation::create(), 'test');
        $this->assertNull($entity);

        $entity = $service->getByName(FlowDataIsolation::create(), 'glm-4-9b');
        $this->assertNotEmpty($entity);
    }

    public function testQueries()
    {
        $repository = $this->getRepositoryTemplate();
        $service = new MagicFlowAIModelDomainService($repository);
        $query = new MagicFlowAIModelQuery();
        $page = new Page();
        $result = $service->queries(FlowDataIsolation::create(), $query, $page);
        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('list', $result);
    }

    private function getRepositoryTemplate(): MagicFlowAIModelRepositoryInterface
    {
        return new class implements MagicFlowAIModelRepositoryInterface {
            public function save(FlowDataIsolation $dataIsolation, MagicFlowAIModelEntity $magicFlowAIModelEntity): MagicFlowAIModelEntity
            {
                $magicFlowAIModelEntity->setId(123);
                return $magicFlowAIModelEntity;
            }

            public function getByName(FlowDataIsolation $dataIsolation, string $name): ?MagicFlowAIModelEntity
            {
                return MockMagicFlowAIModelEntity::createMockMagicFlowAIModelEntity($name);
            }

            public function queries(FlowDataIsolation $dataIsolation, MagicFlowAIModelQuery $query, Page $page): array
            {
                return [
                    'total' => 0,
                    'list' => [],
                ];
            }
        };
    }
}

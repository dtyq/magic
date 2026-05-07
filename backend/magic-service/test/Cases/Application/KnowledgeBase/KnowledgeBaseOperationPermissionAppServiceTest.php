<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\KnowledgeBase;

use App\Application\KnowledgeBase\Service\KnowledgeBaseOperationPermissionAppService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class KnowledgeBaseOperationPermissionAppServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
    }

    public function testGetKnowledgeOperationByUserIdsOnlyUsesUserAndDepartmentTargets(): void
    {
        $repository = Mockery::mock(OperationPermissionRepositoryInterface::class);
        $departmentUserRepository = Mockery::mock(MagicDepartmentUserRepositoryInterface::class);

        $departmentUserRepository->shouldReceive('getDepartmentIdsByUserIds')
            ->once()
            ->withArgs(function ($dataIsolation, array $userIds, bool $withAllParentIds): bool {
                return $dataIsolation->getCurrentOrganizationCode() === 'DT001'
                    && $dataIsolation->getCurrentUserId() === 'user-1'
                    && $userIds === ['user-1']
                    && $withAllParentIds;
            })
            ->andReturn([
                'user-1' => ['dept-1'],
            ]);

        $repository->shouldReceive('listByTargetIds')
            ->once()
            ->withArgs(function (
                KnowledgeBasePermissionDataIsolation $dataIsolation,
                ResourceType $resourceType,
                array $targetIds,
                array $resourceIds
            ): bool {
                sort($targetIds);
                return $dataIsolation->getCurrentOrganizationCode() === 'DT001'
                    && $resourceType === ResourceType::Knowledge
                    && $targetIds === ['dept-1', 'user-1']
                    && $resourceIds === ['KB1'];
            })
            ->andReturn([
                $this->makePermission('KB1', TargetType::UserId, 'user-1', Operation::Read),
                $this->makePermission('KB1', TargetType::DepartmentId, 'dept-1', Operation::Admin),
            ]);

        $service = new KnowledgeBaseOperationPermissionAppService($repository, $departmentUserRepository);
        $operations = $service->getKnowledgeOperationByUserIds(
            new KnowledgeBasePermissionDataIsolation('DT001', 'user-1'),
            ['user-1'],
            ['KB1']
        );

        $this->assertSame(Operation::Admin, $operations['user-1']['KB1'] ?? null);
    }

    private function makePermission(
        string $resourceId,
        TargetType $targetType,
        string $targetId,
        Operation $operation
    ): OperationPermissionEntity {
        $entity = new OperationPermissionEntity();
        $entity->setOrganizationCode('DT001');
        $entity->setResourceType(ResourceType::Knowledge);
        $entity->setResourceId($resourceId);
        $entity->setTargetType($targetType);
        $entity->setTargetId($targetId);
        $entity->setOperation($operation);
        $entity->setCreator('user-1');
        return $entity;
    }
}

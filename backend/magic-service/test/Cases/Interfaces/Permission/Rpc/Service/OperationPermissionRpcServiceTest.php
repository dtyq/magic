<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Permission\Rpc\Service;

use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Interfaces\Permission\Rpc\Service\OperationPermissionRpcService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * @internal
 */
class OperationPermissionRpcServiceTest extends TestCase
{
    public function testAccessOwnerShouldGrantOwnerPermission(): void
    {
        $repository = $this->createMock(OperationPermissionRepositoryInterface::class);
        $logger = $this->createMock(LoggerInterface::class);

        $repository->expects($this->once())
            ->method('save')
            ->with(
                $this->callback(function ($dataIsolation): bool {
                    return $dataIsolation instanceof PermissionDataIsolation
                        && $dataIsolation->getCurrentOrganizationCode() === 'DT001'
                        && $dataIsolation->getCurrentUserId() === 'user-1';
                }),
                $this->callback(function ($entity): bool {
                    return $entity instanceof OperationPermissionEntity
                        && $entity->getResourceType() === ResourceType::Knowledge
                        && $entity->getResourceId() === 'KNOWLEDGE-1'
                        && $entity->getTargetType() === TargetType::UserId
                        && $entity->getTargetId() === 'user-1'
                        && $entity->getOperation() === Operation::Owner;
                })
            )
            ->willReturnCallback(static fn ($_, $entity) => $entity);

        $service = new OperationPermissionRpcService($this->createDomainService($repository), $logger);
        $result = $service->accessOwner([
            'organization_code' => 'DT001',
            'current_user_id' => 'user-1',
            'resource_type' => ResourceType::Knowledge->value,
            'resource_id' => 'KNOWLEDGE-1',
            'owner_user_id' => 'user-1',
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
        $this->assertSame([], $result['data']);
    }

    public function testAccessOwnerShouldRejectInvalidParams(): void
    {
        $service = new OperationPermissionRpcService(
            $this->createDomainService($this->createMock(OperationPermissionRepositoryInterface::class)),
            $this->createMock(LoggerInterface::class)
        );

        $result = $service->accessOwner([
            'organization_code' => 'DT001',
            'current_user_id' => 'user-1',
            'resource_type' => 999,
            'resource_id' => '',
            'owner_user_id' => 'user-1',
        ]);

        $this->assertSame(400, $result['code']);
        $this->assertSame('invalid access owner params', $result['message']);
    }

    public function testAccessOwnerShouldReturn500WhenDomainThrows(): void
    {
        $repository = $this->createMock(OperationPermissionRepositoryInterface::class);
        $logger = $this->createMock(LoggerInterface::class);

        $repository->expects($this->once())
            ->method('save')
            ->willThrowException(new RuntimeException('boom'));
        $logger->expects($this->once())->method('error');

        $service = new OperationPermissionRpcService($this->createDomainService($repository), $logger);
        $result = $service->accessOwner([
            'organization_code' => 'DT001',
            'current_user_id' => 'user-1',
            'resource_type' => ResourceType::Knowledge->value,
            'resource_id' => 'KNOWLEDGE-1',
            'owner_user_id' => 'user-1',
        ]);

        $this->assertSame(500, $result['code']);
        $this->assertSame('boom', $result['message']);
    }

    public function testDeleteByResourceShouldDeleteResourcePermissions(): void
    {
        $repository = $this->createMock(OperationPermissionRepositoryInterface::class);
        $logger = $this->createMock(LoggerInterface::class);

        $permissionEntity = $this->createMock(OperationPermissionEntity::class);
        $repository->expects($this->once())
            ->method('listByResource')
            ->with(
                $this->callback(function ($dataIsolation): bool {
                    return $dataIsolation instanceof PermissionDataIsolation
                        && $dataIsolation->getCurrentOrganizationCode() === 'DT001';
                }),
                ResourceType::Knowledge,
                'KNOWLEDGE-1'
            )
            ->willReturn(['owner' => $permissionEntity]);
        $repository->expects($this->once())
            ->method('beachDelete')
            ->with(
                $this->isInstanceOf(PermissionDataIsolation::class),
                [$permissionEntity]
            );

        $service = new OperationPermissionRpcService($this->createDomainService($repository), $logger);
        $result = $service->deleteByResource([
            'organization_code' => 'DT001',
            'current_user_id' => '',
            'resource_type' => ResourceType::Knowledge->value,
            'resource_id' => 'KNOWLEDGE-1',
        ]);

        $this->assertSame(0, $result['code']);
        $this->assertSame('success', $result['message']);
    }

    private function createDomainService(OperationPermissionRepositoryInterface $repository): OperationPermissionDomainService
    {
        return new OperationPermissionDomainService(
            $repository,
            $this->createMock(MagicGroupRepositoryInterface::class),
            $this->createMock(MagicDepartmentUserRepositoryInterface::class),
        );
    }
}

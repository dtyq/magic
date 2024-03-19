<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Service\MagicGroupDomainService;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use JetBrains\PhpStorm\ArrayShape;
use Qbhy\HyperfAuth\Authenticatable;

class OperationPermissionAppService extends AbstractPermissionAppService
{
    public function __construct(
        private readonly OperationPermissionDomainService $operationPermissionDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly MagicGroupDomainService $magicGroupDomainService,
    ) {
    }

    public function transferOwner(Authenticatable $authorization, ResourceType $resourceType, string $resourceId, string $ownerUserId, bool $reserveManager = true): void
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);
        $operation = $this->getOperationByResourceAndUser(
            $dataIsolation,
            $resourceType,
            $resourceId,
            $authorization->getId(),
        );
        $operation->validate('transfer', 'owner');
        $this->operationPermissionDomainService->transferOwner($dataIsolation, $resourceType, $resourceId, $ownerUserId, $reserveManager);
    }

    /**
     * @return array{list: array<string, OperationPermissionEntity>, users: array<string, MagicUserEntity>,departments:MagicDepartmentEntity[], groups: array<string, MagicGroupEntity>}
     */
    public function listByResource(Authenticatable $authorization, ResourceType $resourceType, string $resourceId): array
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);

        $operation = $this->getOperationByResourceAndUser(
            $dataIsolation,
            $resourceType,
            $resourceId,
            $authorization->getId()
        );
        if (! $operation->canRead()) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'common.access', ['label' => $resourceId]);
        }

        $list = $this->operationPermissionDomainService->listByResource($dataIsolation, $resourceType, $resourceId);
        $userIds = [];
        $departmentIds = [];
        $groupIds = [];
        foreach ($list as $item) {
            if ($item->getTargetType() === TargetType::UserId) {
                $userIds[] = $item->getTargetId();
            }
            if ($item->getTargetType() === TargetType::DepartmentId) {
                $departmentIds[] = $item->getTargetId();
            }
            if ($item->getTargetType() === TargetType::GroupId) {
                $groupIds[] = $item->getTargetId();
            }
        }
        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        // 根据 userid 获取用户信息
        $users = $this->magicUserDomainService->getByUserIds($contactDataIsolation, $userIds);
        // 获取用户的 departmentId
        $userDepartmentList = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserIds($contactDataIsolation, $userIds);
        foreach ($userDepartmentList as $userDepartmentIds) {
            $departmentIds = array_merge($departmentIds, $userDepartmentIds);
        }
        $departments = $this->magicDepartmentDomainService->getDepartmentByIds($contactDataIsolation, $departmentIds, true);
        // 获取群组信息
        $groups = $this->magicGroupDomainService->getGroupsInfoByIds($groupIds, $contactDataIsolation, true);

        return [
            'list' => $list,
            'users' => $users,
            'departments' => $departments,
            'groups' => $groups,
        ];
    }

    /**
     * 对资源进行授权.
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function resourceAccess(Authenticatable $authorization, ResourceType $resourceType, string $resourceId, array $operationPermissions): void
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);
        $operation = $this->getOperationByResourceAndUser(
            $dataIsolation,
            $resourceType,
            $resourceId,
            $authorization->getId()
        );
        $operation->validate('manage', $resourceId);

        $this->operationPermissionDomainService->resourceAccess($dataIsolation, $resourceType, $resourceId, $operationPermissions);
    }

    /**
     * 获取用户对某个资源的最高权限.
     */
    public function getOperationByResourceAndUser(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, string $userId): Operation
    {
        if ($resourceType === ResourceType::ToolSet && $resourceId === ConstValue::TOOL_SET_DEFAULT_CODE) {
            return Operation::Admin;
        }
        return $this->getResourceOperationByUserIds($dataIsolation, $resourceType, [$userId], [$resourceId])[$userId][$resourceId] ?? Operation::None;
    }

    /**
     * 获取用户对某一类资源的最高操作权限.
     */
    #[ArrayShape([
        // userId => [resourceId => Operation]
        'string' => [
            'string' => Operation::class,
        ],
    ])]
    public function getResourceOperationByUserIds(BaseDataIsolation|PermissionDataIsolation $dataIsolation, ResourceType $resourceType, array $userIds, array $resourceIds = []): array
    {
        if (! $dataIsolation instanceof PermissionDataIsolation) {
            $dataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        }
        return $this->operationPermissionDomainService->getResourceOperationByUserIds($dataIsolation, $resourceType, $userIds, $resourceIds);
    }
}

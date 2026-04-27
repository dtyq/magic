<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use DateTime;
use Hyperf\DbConnection\Annotation\Transactional;
use JetBrains\PhpStorm\ArrayShape;

readonly class OperationPermissionDomainService
{
    public function __construct(
        private OperationPermissionRepositoryInterface $operationPermissionRepository,
        private MagicGroupRepositoryInterface $magicGroupRepository,
        private MagicDepartmentUserRepositoryInterface $departmentUserRepository,
    ) {
    }

    /**
     * @return array<string, OperationPermissionEntity>
     */
    public function listByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): array
    {
        return $this->operationPermissionRepository->listByResource($dataIsolation, $resourceType, $resourceId);
    }

    /**
     * @return array<OperationPermissionEntity>
     */
    public function listByTargetIds(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, array $targetIds, array $resourceIds = []): array
    {
        return $this->operationPermissionRepository->listByTargetIds($dataIsolation, $resourceType, $targetIds, $resourceIds);
    }

    /**
     * 授权拥有者.
     */
    public function accessOwner(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, string $userId): OperationPermissionEntity
    {
        $operationPermission = new OperationPermissionEntity();
        $operationPermission->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $operationPermission->setResourceType($resourceType);
        $operationPermission->setResourceId($resourceId);
        $operationPermission->setTargetType(TargetType::UserId);
        $operationPermission->setTargetId($userId);
        $operationPermission->setOperation(Operation::Owner);
        $operationPermission->setCreator($dataIsolation->getCurrentUserId());
        $operationPermission->prepareForSave();
        return $this->operationPermissionRepository->save($dataIsolation, $operationPermission);
    }

    /**
     * 增量写入单个资源权限。
     *
     * 适用于协作者新增或角色变更场景，不会影响当前资源上的其他协作者记录。
     */
    public function upsertResourceOperation(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceId,
        OperationPermissionEntity $operationPermission
    ): OperationPermissionEntity {
        // 增量写入单个协作者权限，避免 resourceAccess() 的“全量覆盖”语义误删其他协作者。
        if ($operationPermission->getOperation()->isOwner()) {
            return $this->accessOwner($dataIsolation, $resourceType, $resourceId, $operationPermission->getTargetId());
        }

        $operationPermission->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $operationPermission->setResourceType($resourceType);
        $operationPermission->setResourceId($resourceId);
        $operationPermission->setCreator($dataIsolation->getCurrentUserId());
        $operationPermission->setModifier($dataIsolation->getCurrentUserId());
        $operationPermission->prepareForSave();

        return $this->operationPermissionRepository->save($dataIsolation, $operationPermission);
    }

    /**
     * 批量增量写入资源权限。
     *
     * 用于协作者批量新增或批量改权场景，逐条复用单条 upsert 语义。
     *
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function batchUpsertResourceOperations(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceId,
        array $operationPermissions
    ): void {
        // 当前阶段优先保证语义正确，批量场景逐条 upsert，便于复用现有 save 逻辑。
        foreach ($operationPermissions as $operationPermission) {
            $this->upsertResourceOperation($dataIsolation, $resourceType, $resourceId, $operationPermission);
        }
    }

    /**
     * Delete all operation permissions for a resource.
     */
    public function deleteByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): void
    {
        $operationPermissions = $this->operationPermissionRepository->listByResource($dataIsolation, $resourceType, $resourceId);
        if ($operationPermissions === []) {
            return;
        }

        $this->operationPermissionRepository->beachDelete($dataIsolation, array_values($operationPermissions));
    }

    /**
     * 按目标列表删除资源上的协作者权限。
     *
     * 只删除命中的非所有者权限记录，不影响当前资源上的其他协作者。
     *
     * @param array<int, array{target_type: string, target_id: string}> $targets
     */
    public function deleteResourceOperationsByTargets(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceId,
        array $targets
    ): void {
        // 精准按 target_type + target_id 删除，且显式保护所有者权限不被协作接口误删。
        $historyPermissions = $this->operationPermissionRepository->listByResource($dataIsolation, $resourceType, $resourceId);
        if ($historyPermissions === [] || $targets === []) {
            return;
        }

        $deletes = [];
        foreach ($targets as $target) {
            $targetType = match ($target['target_type']) {
                'User' => TargetType::UserId,
                'Department' => TargetType::DepartmentId,
                'Group' => TargetType::GroupId,
                default => null,
            };
            if ($targetType === null) {
                continue;
            }

            $key = $targetType->value . '_' . $target['target_id'];
            $historyPermission = $historyPermissions[$key] ?? null;
            if ($historyPermission === null || $historyPermission->getOperation()->isOwner()) {
                continue;
            }

            $deletes[] = $historyPermission;
        }

        $this->operationPermissionRepository->beachDelete($dataIsolation, $deletes);
    }

    /**
     * 判断用户是否是资源的所有者.
     */
    public function isResourceOwner(BaseDataIsolation|PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, string $userId): bool
    {
        if (! $dataIsolation instanceof PermissionDataIsolation) {
            $dataIsolation = PermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
        }
        $ownerOperationPermission = $this->operationPermissionRepository->getResourceOwner($dataIsolation, $resourceType, $resourceId);
        if (! $ownerOperationPermission) {
            return false;
        }
        return $ownerOperationPermission->getTargetId() === $userId;
    }

    /**
     * 转让资源拥有者.
     */
    #[Transactional]
    public function transferOwner(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, string $ownerUserId, bool $reserveManager = true): void
    {
        $ownerOperationPermission = $this->operationPermissionRepository->getResourceOwner($dataIsolation, $resourceType, $resourceId);
        if (! $ownerOperationPermission) {
            return;
        }
        if ($ownerOperationPermission->getTargetId() === $ownerUserId) {
            // 没有任何变更
            return;
        }
        // 赋予新的 owner
        $this->accessOwner($dataIsolation, $resourceType, $resourceId, $ownerUserId);
        if ($reserveManager) {
            // 保留管理权限
            $ownerOperationPermission->setOperation(Operation::Admin);
            $this->operationPermissionRepository->save($dataIsolation, $ownerOperationPermission);
        } else {
            $this->operationPermissionRepository->beachDelete($dataIsolation, [$ownerOperationPermission]);
        }
    }

    /**
     * 对资源进行授权.
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    #[Transactional]
    public function resourceAccess(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId, array $operationPermissions): void
    {
        // 查找当前资源所有的权限，区分 新增、修改、删除 todo 这里或许可以改成 delete 全量后 insert
        $add = $edit = [];

        $historyOperationPermissions = $this->operationPermissionRepository->listByResource($dataIsolation, $resourceType, $resourceId);
        // owner 不能被操作，得先去除
        foreach ($historyOperationPermissions as $index => $historyOperationPermission) {
            if ($historyOperationPermission->getOperation()->isOwner()) {
                unset($historyOperationPermissions[$index]);
            }
        }

        $handleKey = [];
        foreach ($operationPermissions as $operationPermission) {
            $operationPermission->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $operationPermission->setResourceType($resourceType);
            $operationPermission->setResourceId($resourceId);
            $operationPermission->setCreator($dataIsolation->getCurrentUserId());

            $key = $operationPermission->getTargetType()->value . '_' . $operationPermission->getTargetId();
            $historyOperationPermission = $historyOperationPermissions[$key] ?? null;
            unset($historyOperationPermissions[$key]);

            // 根据 key 去重
            if ($handleKey[$key] ?? false) {
                continue;
            }
            $handleKey[$key] = true;

            // 如果 owner，不能操作
            if ($historyOperationPermission && $historyOperationPermission->getOperation()->isOwner()) {
                continue;
            }
            if ($operationPermission->getOperation()->isOwner()) {
                continue;
            }

            if ($historyOperationPermission) {
                if ($operationPermission->getOperation() === $historyOperationPermission->getOperation()) {
                    continue;
                }
                $historyOperationPermission->setOperation($operationPermission->getOperation());
                $historyOperationPermission->setUpdatedAt(new DateTime());
                $edit[] = $historyOperationPermission;
            } else {
                $operationPermission->prepareForSave();
                $add[] = $operationPermission;
            }
        }

        $delete = $historyOperationPermissions;

        $this->operationPermissionRepository->batchInsert($dataIsolation, $add);
        $this->operationPermissionRepository->beachUpdate($dataIsolation, $edit);
        $this->operationPermissionRepository->beachDelete($dataIsolation, $delete);
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
    public function getResourceOperationByUserIds(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, array $userIds, ?array $resourceIds = []): array
    {
        $resourceIds = $resourceIds ?? [];

        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        // 获取用户所在部门、群组添加到 target 中查找
        $userDepartmentList = $this->departmentUserRepository->getDepartmentIdsByUserIds($contactDataIsolation, $userIds, true);
        $userGroupIds = $this->magicGroupRepository->getGroupIdsByUserIds($userIds);
        $targetIds = [];
        $targetIds[] = $userIds;

        $departmentUserIds = [];
        foreach ($userDepartmentList as $userId => $departmentIds) {
            $targetIds[] = $departmentIds;
            foreach ($departmentIds as $departmentId) {
                $departmentUserIds[$departmentId][] = $userId;
            }
        }

        $groupUserIds = [];
        foreach ($userGroupIds as $userId => $groupIds) {
            $targetIds[] = $groupIds;
            foreach ($groupIds as $groupId) {
                $groupUserIds[$groupId][] = $userId;
            }
        }
        $targetIds = array_merge(...$targetIds);
        $targetIds = array_values(array_unique($targetIds));
        $resourcesOperationPermissions = $this->listByTargetIds($dataIsolation, $resourceType, $targetIds, $resourceIds);

        $list = [];
        foreach ($resourcesOperationPermissions as $resourcesOperationPermission) {
            if ($resourcesOperationPermission->getTargetType() === TargetType::UserId) {
                $userId = $resourcesOperationPermission->getTargetId();
                $topOperation = $list[$userId][$resourcesOperationPermission->getResourceId()] ?? null;
                if ($resourcesOperationPermission->getOperation()->gt($topOperation)) {
                    $list[$userId][$resourcesOperationPermission->getResourceId()] = $resourcesOperationPermission->getOperation();
                }
            }
            if ($resourcesOperationPermission->getTargetType() === TargetType::GroupId) {
                foreach ($groupUserIds[$resourcesOperationPermission->getTargetId()] ?? [] as $userId) {
                    $topOperation = $list[$userId][$resourcesOperationPermission->getResourceId()] ?? null;
                    if ($resourcesOperationPermission->getOperation()->gt($topOperation)) {
                        $list[$userId][$resourcesOperationPermission->getResourceId()] = $resourcesOperationPermission->getOperation();
                    }
                }
            }
            if ($resourcesOperationPermission->getTargetType() === TargetType::DepartmentId) {
                foreach ($departmentUserIds[$resourcesOperationPermission->getTargetId()] ?? [] as $userId) {
                    $topOperation = $list[$userId][$resourcesOperationPermission->getResourceId()] ?? null;
                    if ($resourcesOperationPermission->getOperation()->gt($topOperation)) {
                        $list[$userId][$resourcesOperationPermission->getResourceId()] = $resourcesOperationPermission->getOperation();
                    }
                }
            }
        }

        return $list;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityDepartment;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityUser;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\DbConnection\Db;

/**
 * 资源可见性领域服务.
 */
readonly class ResourceVisibilityDomainService
{
    public function __construct(
        private ResourceVisibilityRepositoryInterface $resourceVisibilityRepository,
        private MagicDepartmentUserRepositoryInterface $departmentUserRepository
    ) {
    }

    /**
     * 批量保存资源可见性配置.
     *
     * @param PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param ResourceType $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @param array<ResourceVisibilityEntity> $entities 实体数组
     */
    public function batchSaveResourceVisibility(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        array $entities
    ): void {
        Db::transaction(function () use ($dataIsolation, $resourceType, $resourceCode, $entities) {
            // 1. 先删除该resource的所有旧配置
            $this->resourceVisibilityRepository->deleteByResourceCode($dataIsolation, $resourceType, $resourceCode);

            // 2. 为每个实体设置资源信息
            foreach ($entities as $entity) {
                $entity->setResourceType($resourceType);
                $entity->setResourceCode($resourceCode);

                $entity->prepareForCreation();
            }

            // 3. 批量插入新配置
            if (! empty($entities)) {
                $this->resourceVisibilityRepository->batchInsert($dataIsolation, $entities);
            }
        });
    }

    /**
     * 查询资源可见性列表.
     *
     * @param PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param ResourceType $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @return array<ResourceVisibilityEntity>
     */
    public function listResourceVisibility(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode
    ): array {
        return $this->resourceVisibilityRepository->listByResource($dataIsolation, $resourceType, $resourceCode);
    }

    /**
     * 按资源和主体类型精准删除可见性记录，避免“全量查出再重建”的高成本操作。
     *
     * @param array<string> $principalIds
     */
    public function deleteResourceVisibilityByPrincipals(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        PrincipalType $principalType,
        array $principalIds
    ): int {
        return $this->resourceVisibilityRepository->deleteByResourceAndPrincipals(
            $dataIsolation,
            $resourceType,
            $resourceCode,
            $principalType,
            $principalIds
        );
    }

    /**
     * 按主体精准追加可见性记录。
     *
     * 这里使用“批量查询已有 + 批量 insertOrIgnore 缺失”的方式：
     * - 不会读取整份资源可见范围
     * - 不会重建其它记录
     * - 可以兼顾批量性能和并发幂等
     *
     * @param array<string> $principalIds
     */
    public function addResourceVisibilityByPrincipalsIfMissing(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        PrincipalType $principalType,
        array $principalIds
    ): void {
        $principalIds = array_values(array_unique(array_filter($principalIds)));
        if ($principalIds === []) {
            return;
        }

        $existingPrincipalIds = $this->resourceVisibilityRepository->listExistingPrincipalIdsByResourceAndType(
            $dataIsolation,
            $resourceType,
            $resourceCode,
            $principalType,
            $principalIds
        );
        $missingPrincipalIds = array_values(array_diff($principalIds, $existingPrincipalIds));

        if ($missingPrincipalIds === []) {
            return;
        }

        $entities = [];
        foreach ($missingPrincipalIds as $principalId) {
            $entity = new ResourceVisibilityEntity();
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $entity->setPrincipalType($principalType);
            $entity->setPrincipalId($principalId);
            $entity->setResourceType($resourceType);
            $entity->setResourceCode($resourceCode);
            $entity->setCreator($dataIsolation->getCurrentUserId());
            $entity->setModifier($dataIsolation->getCurrentUserId());
            $entities[] = $entity;
        }

        $this->resourceVisibilityRepository->batchInsertOrIgnore($dataIsolation, $entities);
    }

    /**
     * 获取用户可访问的资源编码列表.
     *
     * @param PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param string $userId 用户ID
     * @param ResourceType $resourceType 资源类型
     * @param null|array $resourceIds 资源编码过滤列表，null 表示返回全部可访问资源
     * @return array resource_code 数组
     */
    public function getUserAccessibleResourceCodes(
        PermissionDataIsolation $dataIsolation,
        string $userId,
        ResourceType $resourceType,
        ?array $resourceIds = null
    ): array {
        $contactDataIsolation = ContactDataIsolation::simpleMake(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );

        // 获取用户所在部门（包含所有父级部门）
        $userDepartmentList = $this->departmentUserRepository->getDepartmentIdsByUserIds(
            $contactDataIsolation,
            [$userId],
            true
        );
        $departmentIds = $userDepartmentList[$userId] ?? [];

        // 构建主体ID数组：用户ID + 部门ID列表（含父级） + 群组ID列表 + 组织code
        $principalIds = array_merge(
            [$userId],                                              // 用户ID
            $departmentIds,                                         // 部门ID列表（包含所有父级）
            [$dataIsolation->getCurrentOrganizationCode()]          // 组织code
        );

        // 去重
        $principalIds = array_values(array_unique($principalIds));

        // 调用仓储查询获取实体列表
        $entities = $this->resourceVisibilityRepository->listByPrincipalIds(
            $dataIsolation,
            $principalIds,
            $resourceType,
            $resourceIds
        );

        // 从实体列表中提取资源编码并去重
        $codes = [];
        foreach ($entities as $entity) {
            $codes[] = $entity->getResourceCode();
        }

        return array_values(array_unique($codes));
    }

    /**
     * 保存可见性配置(高层封装).
     *
     * @param BaseDataIsolation|PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param ResourceType $resourceType 资源类型
     * @param string $resourceCode 资源编码
     * @param VisibilityConfig $visibilityConfig 可见性配置值对象
     */
    public function saveVisibilityConfig(
        BaseDataIsolation|PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        VisibilityConfig $visibilityConfig,
    ): void {
        if (! $dataIsolation instanceof PermissionDataIsolation) {
            $dataIsolation = PermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
        }

        $visibilityType = $visibilityConfig->getVisibilityType();
        $currentUserId = $dataIsolation->getCurrentUserId();

        // 根据可见性类型创建实体数组
        $entities = [];

        if ($visibilityType === VisibilityType::ALL) {
            // visibility_type = 1: 全员可见，创建一个组织级别的记录
            $entity = new ResourceVisibilityEntity();
            $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $entity->setPrincipalType(PrincipalType::ORGANIZATION);
            $entity->setPrincipalId($dataIsolation->getCurrentOrganizationCode());
            $entity->setCreator($currentUserId);
            $entity->setModifier($currentUserId);
            $entities[] = $entity;
        } elseif ($visibilityType === VisibilityType::SPECIFIC) {
            // visibility_type = 2: 部分可见，需要至少有一个用户或部门
            $users = $visibilityConfig->getUsers();
            $departments = $visibilityConfig->getDepartments();

            if (empty($users) && empty($departments)) {
                ExceptionBuilder::throw(
                    PermissionErrorCode::VISIBILITY_TYPE_2_REQUIRES_USERS_OR_DEPARTMENTS,
                    'permission.error.visibility_type_2_requires_users_or_departments'
                );
            }

            // 为每个用户创建实体
            foreach ($users as $user) {
                $entity = new ResourceVisibilityEntity();
                $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
                $entity->setPrincipalType(PrincipalType::USER);
                $entity->setPrincipalId($user->getId());
                $entity->setCreator($currentUserId);
                $entity->setModifier($currentUserId);
                $entities[] = $entity;
            }

            // 为每个部门创建实体
            foreach ($departments as $department) {
                $entity = new ResourceVisibilityEntity();
                $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
                $entity->setPrincipalType(PrincipalType::DEPARTMENT);
                $entity->setPrincipalId($department->getId());
                $entity->setCreator($currentUserId);
                $entity->setModifier($currentUserId);
                $entities[] = $entity;
            }
        }

        // 调用底层的批量保存方法
        $this->batchSaveResourceVisibility(
            $dataIsolation,
            $resourceType,
            $resourceCode,
            $entities
        );
    }

    /**
     * 获取可见性配置(高层封装).
     *
     * @param BaseDataIsolation|PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param ResourceType $resourceType 资源类型
     * @param string $resourceCode 资源编码
     */
    public function getVisibilityConfig(
        BaseDataIsolation|PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode
    ): VisibilityConfig {
        if (! $dataIsolation instanceof PermissionDataIsolation) {
            $dataIsolation = PermissionDataIsolation::createByBaseDataIsolation($dataIsolation);
        }

        // 查询所有可见性实体
        $entities = $this->listResourceVisibility($dataIsolation, $resourceType, $resourceCode);

        $visibilityConfig = new VisibilityConfig();

        // 没有任何记录，visibility_type = 0
        if (empty($entities)) {
            $visibilityConfig->setVisibilityType(VisibilityType::NONE);
            return $visibilityConfig;
        }

        // 只有一条组织级别的记录，visibility_type = 1
        if (count($entities) === 1 && $entities[0]->getPrincipalType() === PrincipalType::ORGANIZATION) {
            $visibilityConfig->setVisibilityType(VisibilityType::ALL);
            return $visibilityConfig;
        }

        // 其他情况，visibility_type = 2
        $visibilityConfig->setVisibilityType(VisibilityType::SPECIFIC);

        // 收集用户ID和部门ID
        $userIds = [];
        $departmentIds = [];

        foreach ($entities as $entity) {
            $principalType = $entity->getPrincipalType();
            $principalId = $entity->getPrincipalId();

            if ($principalType === PrincipalType::USER) {
                $userIds[] = $principalId;
            } elseif ($principalType === PrincipalType::DEPARTMENT) {
                $departmentIds[] = $principalId;
            }
        }

        // 使用 Db 直接查询用户信息
        if (! empty($userIds)) {
            $userIds = array_unique($userIds);
            $usersData = Db::table('magic_contact_users')
                ->whereIn('user_id', $userIds)
                ->whereNull('deleted_at')
                ->select(['user_id', 'nickname', 'avatar_url'])
                ->get()->toArray();

            foreach ($usersData as $userData) {
                $user = new VisibilityUser([
                    'id' => $userData['user_id'],
                    'nickname' => $userData['nickname'] ?? '',
                    'avatar' => $userData['avatar_url'] ?? '',
                ]);
                $visibilityConfig->addUser($user);
            }
        }

        // 使用 Db 直接查询部门信息
        if (! empty($departmentIds)) {
            $departmentIds = array_unique($departmentIds);
            $departmentsData = Db::table('magic_contact_departments')
                ->whereIn('department_id', $departmentIds)
                ->whereNull('deleted_at')
                ->select(['department_id', 'name'])
                ->get()->toArray();

            foreach ($departmentsData as $departmentData) {
                $department = new VisibilityDepartment([
                    'id' => $departmentData['department_id'],
                    'name' => $departmentData['name'] ?? '',
                ]);
                $visibilityConfig->addDepartment($department);
            }
        }

        return $visibilityConfig;
    }
}

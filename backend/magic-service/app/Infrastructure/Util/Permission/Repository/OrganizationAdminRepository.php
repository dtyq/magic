<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Repository;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Repository\Facade\OrganizationAdminRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\Model\OrganizationAdminModel;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

use function Hyperf\Support\now;

/**
 * 组织管理员仓库实现.
 */
readonly class OrganizationAdminRepository implements OrganizationAdminRepositoryInterface
{
    public function __construct(
        private MagicUserRepositoryInterface $userRepository
    ) {
    }

    /**
     * 保存组织管理员.
     */
    public function save(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdminEntity): OrganizationAdminEntity
    {
        $data = [
            'user_id' => $organizationAdminEntity->getUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'magic_id' => $organizationAdminEntity->getMagicId(),
            'grantor_user_id' => $organizationAdminEntity->getGrantorUserId(),
            'granted_at' => $organizationAdminEntity->getGrantedAt(),
            'status' => $organizationAdminEntity->getStatus(),
            'is_organization_creator' => $organizationAdminEntity->isOrganizationCreator() ? 1 : 0,
            'remarks' => $organizationAdminEntity->getRemarks(),
            'updated_at' => $organizationAdminEntity->getUpdatedAt() ?? now(),
        ];

        if ($organizationAdminEntity->shouldCreate()) {
            $data['created_at'] = $organizationAdminEntity->getCreatedAt() ?? now();
            $model = OrganizationAdminModel::create($data);
            $organizationAdminEntity->setId($model->id);
        } else {
            $model = $this->organizationAdminQuery($dataIsolation)
                ->where('id', $organizationAdminEntity->getId())
                ->first();
            if ($model) {
                $model->fill($data);
                $model->save();
            }
        }

        return $organizationAdminEntity;
    }

    /**
     * 根据ID获取组织管理员.
     */
    public function getById(DataIsolation $dataIsolation, int $id): ?OrganizationAdminEntity
    {
        $model = $this->organizationAdminQuery($dataIsolation)
            ->where('id', $id)
            ->first();

        return $model ? $this->mapArrayToEntity($model->toArray()) : null;
    }

    /**
     * 根据用户ID获取组织管理员.
     */
    public function getByUserId(DataIsolation $dataIsolation, string $userId): ?OrganizationAdminEntity
    {
        $model = $this->organizationAdminQuery($dataIsolation)
            ->where('user_id', $userId)
            ->first();

        return $model ? $this->mapArrayToEntity($model->toArray()) : null;
    }

    /**
     * 查询组织管理员列表.
     */
    public function queries(DataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        $query = $this->organizationAdminQuery($dataIsolation);

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        // 排序：先按是否为组织创建者排序，再按授权时间排序，都是降序
        $query->orderBy('is_organization_creator', 'desc')
            ->orderBy('granted_at', 'desc');

        // 分页
        $total = $query->count();
        $query->forPage($page->getPage(), $page->getPageNum());

        $models = Db::select($query->toSql(), $query->getBindings());
        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->mapArrayToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * 删除组织管理员.
     */
    public function delete(DataIsolation $dataIsolation, OrganizationAdminEntity $organizationAdminEntity): void
    {
        $this->organizationAdminQuery($dataIsolation)
            ->where('id', $organizationAdminEntity->getId())
            ->delete();
    }

    /**
     * 检查用户是否为组织管理员.
     */
    public function isOrganizationAdmin(DataIsolation $dataIsolation, string $userId): bool
    {
        return $this->organizationAdminQuery($dataIsolation)
            ->where('user_id', $userId)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->exists();
    }

    /**
     * 授予用户组织管理员权限.
     */
    public function grant(DataIsolation $dataIsolation, string $userId, ?string $grantorUserId, ?string $remarks = null, bool $isOrganizationCreator = false): OrganizationAdminEntity
    {
        // 检查是否已存在
        $existing = $this->getByUserId($dataIsolation, $userId);
        if ($existing) {
            return $existing;
        }

        // 创建新的组织管理员
        $entity = new OrganizationAdminEntity();
        $entity->setUserId($userId);
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        // 获取用户的 magic_id
        $user = $this->userRepository->getUserById($userId);
        if ($user) {
            $entity->setMagicId($user->getMagicId());
        }

        $entity->setGrantorUserId($grantorUserId);
        $entity->setGrantedAt(new DateTime());
        $entity->setStatus(OrganizationAdminModel::STATUS_ENABLED);
        $entity->setIsOrganizationCreator($isOrganizationCreator);
        $entity->setRemarks($remarks);

        return $this->save($dataIsolation, $entity);
    }

    /**
     * 撤销用户组织管理员权限.
     */
    public function revoke(DataIsolation $dataIsolation, string $userId): void
    {
        $entity = $this->getByUserId($dataIsolation, $userId);
        if ($entity) {
            $entity->revoke();
            $this->save($dataIsolation, $entity);
        }
    }

    /**
     * 获取组织创建人.
     */
    public function getOrganizationCreator(DataIsolation $dataIsolation): ?OrganizationAdminEntity
    {
        $model = $this->organizationAdminQuery($dataIsolation)
            ->where('is_organization_creator', 1)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->first();

        return $model ? $this->mapArrayToEntity($model->toArray()) : null;
    }

    /**
     * 获取组织下所有组织管理员.
     */
    public function getAllOrganizationAdmins(DataIsolation $dataIsolation): array
    {
        $query = $this->organizationAdminQuery($dataIsolation);
        $models = Db::select($query->toSql(), $query->getBindings());

        $entities = [];
        foreach ($models as $row) {
            $entities[] = $this->mapArrayToEntity($row);
        }

        return $entities;
    }

    /**
     * 批量检查用户是否为组织管理员.
     */
    public function batchCheckOrganizationAdmin(DataIsolation $dataIsolation, array $userIds): array
    {
        $organizationAdminUserIds = $this->organizationAdminQuery($dataIsolation)
            ->whereIn('user_id', $userIds)
            ->where('status', OrganizationAdminModel::STATUS_ENABLED)
            ->pluck('user_id')
            ->toArray();

        $result = [];
        foreach ($userIds as $userId) {
            $result[$userId] = in_array($userId, $organizationAdminUserIds);
        }

        return $result;
    }

    /**
     * 基于数据隔离获取 OrganizationAdminModel 查询构造器.
     */
    private function organizationAdminQuery(DataIsolation $dataIsolation): Builder
    {
        return OrganizationAdminModel::query()->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
    }

    /**
     * 映射数组数据到实体.
     * @param mixed $row
     */
    private function mapArrayToEntity($row): OrganizationAdminEntity
    {
        // 处理 DB::select 返回的 stdClass 对象或数组
        $data = is_array($row) ? $row : (array) $row;

        $entity = new OrganizationAdminEntity();
        $entity->setId($data['id'] ?? null);
        $entity->setUserId($data['user_id'] ?? '');
        $entity->setOrganizationCode($data['organization_code'] ?? '');
        $entity->setMagicId($data['magic_id'] ?? null);
        $entity->setGrantorUserId($data['grantor_user_id'] ?? null);
        $entity->setStatus($data['status'] ?? 1);
        $entity->setIsOrganizationCreator((bool) ($data['is_organization_creator'] ?? false));
        $entity->setRemarks($data['remarks'] ?? null);

        // 处理日期字段
        if (isset($data['granted_at']) && $data['granted_at']) {
            $entity->setGrantedAt(new DateTime($data['granted_at']));
        }
        if (isset($data['created_at']) && $data['created_at']) {
            $entity->setCreatedAt(new DateTime($data['created_at']));
        }
        if (isset($data['updated_at']) && $data['updated_at']) {
            $entity->setUpdatedAt(new DateTime($data['updated_at']));
        }

        return $entity;
    }
}

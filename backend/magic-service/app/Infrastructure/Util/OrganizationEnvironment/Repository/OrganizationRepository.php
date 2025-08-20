<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\OrganizationEnvironment\Repository;

use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Persistence\Model\OrganizationModel;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;
use Hyperf\Database\Model\Builder;

use function Hyperf\Support\now;

/**
 * 组织仓库实现.
 */
class OrganizationRepository implements OrganizationRepositoryInterface
{
    /**
     * 保存组织.
     */
    public function save(OrganizationEntity $organizationEntity): OrganizationEntity
    {
        $data = [
            'magic_organization_code' => $organizationEntity->getMagicOrganizationCode(),
            'name' => $organizationEntity->getName(),
            'platform_type' => $organizationEntity->getPlatformType(),
            'logo' => $organizationEntity->getLogo(),
            'introduction' => $organizationEntity->getIntroduction(),
            'contact_user' => $organizationEntity->getContactUser(),
            'contact_mobile' => $organizationEntity->getContactMobile(),
            'industry_type' => $organizationEntity->getIndustryType(),
            'number' => $organizationEntity->getNumber(),
            'status' => $organizationEntity->getStatus(),
            'creator_id' => $organizationEntity->getCreatorId(),
            'type' => $organizationEntity->getType(),
            'updated_at' => $organizationEntity->getUpdatedAt() ?? now(),
        ];

        if ($organizationEntity->shouldCreate()) {
            $data['created_at'] = $organizationEntity->getCreatedAt() ?? now();

            $model = OrganizationModel::create($data);
            $organizationEntity->setId($model->id);
        } else {
            // 使用模型更新以便使用 casts 处理 JSON 与日期字段
            $model = OrganizationModel::query()
                ->where('id', $organizationEntity->getId())
                ->first();
            if ($model) {
                $model->fill($data);
                $model->save();
            }
        }

        return $organizationEntity;
    }

    /**
     * 根据ID获取组织.
     */
    public function getById(int $id): ?OrganizationEntity
    {
        $model = OrganizationModel::query()
            ->where('id', $id)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 根据编码获取组织.
     */
    public function getByCode(string $code): ?OrganizationEntity
    {
        $model = OrganizationModel::query()
            ->where('magic_organization_code', $code)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 根据名称获取组织.
     */
    public function getByName(string $name): ?OrganizationEntity
    {
        $model = OrganizationModel::query()
            ->where('name', $name)
            ->first();

        return $model ? $this->mapToEntity($model) : null;
    }

    /**
     * 查询组织列表.
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        $query = OrganizationModel::query();

        // 应用过滤条件
        $this->applyFilters($query, $filters);

        // 获取总数
        $total = $query->count();

        // 分页查询
        $models = $query->orderBy('created_at', 'desc')
            ->forPage($page->getPage(), $page->getPageNum())
            ->get();

        $organizations = [];
        foreach ($models as $model) {
            $organizations[] = $this->mapToEntity($model);
        }

        return [
            'total' => $total,
            'list' => $organizations,
        ];
    }

    /**
     * 删除组织.
     */
    public function delete(OrganizationEntity $organizationEntity): void
    {
        $model = OrganizationModel::query()
            ->where('id', $organizationEntity->getId())
            ->first();

        if ($model) {
            $model->delete();
        }
    }

    /**
     * 检查编码是否已存在.
     */
    public function existsByCode(string $code, ?int $excludeId = null): bool
    {
        $query = OrganizationModel::query()->where('magic_organization_code', $code);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    /**
     * 应用过滤条件.
     */
    private function applyFilters(Builder $query, ?array $filters): void
    {
        if (! $filters) {
            return;
        }

        if (! empty($filters['name'])) {
            $query->where('name', 'like', '%' . $filters['name'] . '%');
        }

        if (! empty($filters['magic_organization_code'])) {
            $query->where('magic_organization_code', $filters['magic_organization_code']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['creator_id'])) {
            $query->where('creator_id', $filters['creator_id']);
        }
    }

    /**
     * 将模型映射为实体.
     */
    private function mapToEntity(OrganizationModel $model): OrganizationEntity
    {
        $entity = new OrganizationEntity();
        $entity->setId($model->id);
        $entity->setMagicOrganizationCode($model->magic_organization_code);
        $entity->setName($model->name);
        $entity->setPlatformType($model->platform_type);
        $entity->setLogo($model->logo);
        $entity->setIntroduction($model->introduction);
        $entity->setContactUser($model->contact_user);
        $entity->setContactMobile($model->contact_mobile);
        $entity->setIndustryType($model->industry_type);
        $entity->setNumber($model->number);
        $entity->setStatus($model->status);
        $entity->setCreatorId($model->creator_id);
        $entity->setType($model->type);

        if ($model->created_at) {
            $entity->setCreatedAt(new DateTime($model->created_at->toDateTimeString()));
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt(new DateTime($model->updated_at->toDateTimeString()));
        }

        if ($model->deleted_at) {
            $entity->setDeletedAt(new DateTime($model->deleted_at->toDateTimeString()));
        }

        return $entity;
    }
}

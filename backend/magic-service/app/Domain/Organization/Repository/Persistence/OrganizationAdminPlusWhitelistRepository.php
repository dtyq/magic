<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Repository\Persistence;

use App\Domain\Organization\Entity\OrganizationAdminPlusWhitelistEntity;
use App\Domain\Organization\Factory\OrganizationAdminPlusWhitelistFactory;
use App\Domain\Organization\Repository\Facade\OrganizationAdminPlusWhitelistRepositoryInterface;
use App\Domain\Organization\Repository\Persistence\Model\OrganizationAdminPlusWhitelistModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class OrganizationAdminPlusWhitelistRepository extends AbstractRepository implements OrganizationAdminPlusWhitelistRepositoryInterface
{
    public function __construct(public OrganizationAdminPlusWhitelistModel $model)
    {
    }

    public function getByOrganizationCode(string $organizationCode): ?OrganizationAdminPlusWhitelistEntity
    {
        $record = $this->model::query()
            ->where('organization_code', $organizationCode)
            ->first();
        if ($record === null) {
            return null;
        }
        return OrganizationAdminPlusWhitelistFactory::modelToEntity($record);
    }

    public function save(OrganizationAdminPlusWhitelistEntity $entity): OrganizationAdminPlusWhitelistEntity
    {
        /** @var null|OrganizationAdminPlusWhitelistModel $model */
        $model = $this->model::query()
            ->withTrashed()
            ->where('organization_code', $entity->getOrganizationCode())
            ->first();

        if ($model === null) {
            // 新建
            if ($entity->getId() === null) {
                $entity->setId(IdGenerator::getSnowId());
            }
            $model = new OrganizationAdminPlusWhitelistModel();
            $model->fill([
                'id' => $entity->getId(),
                'organization_code' => $entity->getOrganizationCode(),
                'enabled' => $entity->isEnabled() ? 1 : 0,
            ]);
        } else {
            // 更新（包含从软删除恢复的场景）
            if (method_exists($model, 'trashed') && $model->trashed()) {
                // 恢复软删除
                $model->restore();
            }
            // 以数据库主键为准，避免覆盖主键导致 insert
            $entity->setId((int) $model->id);
            $model->fill([
                'organization_code' => $entity->getOrganizationCode(),
                'enabled' => $entity->isEnabled() ? 1 : 0,
            ]);
        }

        $model->save();
        $entity->setId((int) $model->id);
        return $entity;
    }

    public function deleteByOrganizationCode(string $organizationCode): void
    {
        $model = $this->model::query()->where('organization_code', $organizationCode)->first();
        if ($model) {
            $model->delete();
        }
    }

    public function deleteById(int $id): void
    {
        $model = $this->model::query()->where('id', $id)->first();
        if ($model) {
            $model->delete();
        }
    }

    public function queries(?string $organizationCode, int $page, int $pageSize): array
    {
        $builder = $this->model::query();
        if (! empty($organizationCode)) {
            $builder->where('organization_code', 'like', "%{$organizationCode}%");
        }
        $total = (clone $builder)->count();
        $list = $builder->orderByDesc('id')
            ->forPage($page, $pageSize)
            ->get();
        $entities = [];
        foreach ($list as $item) {
            $entities[] = OrganizationAdminPlusWhitelistFactory::modelToEntity($item);
        }
        return ['total' => (int) $total, 'list' => $entities];
    }
}

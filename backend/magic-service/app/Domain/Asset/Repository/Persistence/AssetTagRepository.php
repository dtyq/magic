<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ValueObject\AssetTagNodeType;
use App\Domain\Asset\Factory\AssetTagFactory;
use App\Domain\Asset\Repository\Facade\AssetTagRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetTagModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class AssetTagRepository implements AssetTagRepositoryInterface
{
    public function queryVisible(AssetDataIsolation $dataIsolation, ?string $ownerUid = null, ?string $businessType = null): array
    {
        $builder = AssetTagModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('status', 1);
        // null 表示不按业务类型过滤（后台查看全部）；用户侧必须显式传入。
        if ($businessType !== null) {
            $builder->where('business_type', $businessType);
        }
        $builder->where(static function ($query) use ($ownerUid): void {
            $query->whereNull('owner_uid');
            if ($ownerUid !== null && $ownerUid !== '') {
                $query->orWhere('owner_uid', $ownerUid);
            }
        });
        return $builder->orderBy('sort', 'desc')->orderBy('id', 'desc')->get()->map(static fn (AssetTagModel $model) => AssetTagFactory::modelToEntity($model))->all();
    }

    public function queryVisibleTree(AssetDataIsolation $dataIsolation, ?string $ownerUid = null, ?string $businessType = null): array
    {
        $nodes = $this->queryVisible($dataIsolation, $ownerUid, $businessType);
        $children = [];
        $roots = [];
        foreach ($nodes as $node) {
            if ($node->getParentId() === 0) {
                $roots[] = $node;
                continue;
            }
            $children[(string) $node->getParentId()][] = $node;
        }
        foreach ($nodes as $node) {
            $nodeChildren = $children[(string) $node->getId()] ?? [];
            $node->setChildren($nodeChildren);
            // 节点类型由结构派生：有下级即标签组，没有下级即普通标签。
            $node->setNodeType($nodeChildren === [] ? AssetTagNodeType::Tag : AssetTagNodeType::Group);
        }
        return $roots;
    }

    public function findById(AssetDataIsolation $dataIsolation, int|string $id): ?AssetTagEntity
    {
        $model = AssetTagModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('id', $id)->first();
        return $model ? AssetTagFactory::modelToEntity($model) : null;
    }

    /** @return array<string, AssetTagEntity> */
    public function findByIds(AssetDataIsolation $dataIsolation, array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [];
        }
        $models = AssetTagModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->whereIn('id', $ids)->get();
        $result = [];
        foreach ($models as $model) {
            $entity = AssetTagFactory::modelToEntity($model);
            $result[(string) $entity->getId()] = $entity;
        }
        return $result;
    }

    public function findOfficialByName(AssetDataIsolation $dataIsolation, array $nameI18n, string $nodeType, int $parentId): ?AssetTagEntity
    {
        $model = AssetTagModel::query()
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode())
            ->whereNull('owner_uid')
            ->where('node_type', $nodeType)
            ->where('parent_id', $parentId)
            ->where(static function ($query) use ($nameI18n): void {
                $query->where('name_i18n->zh_CN', $nameI18n['zh_CN'])
                    ->orWhere('name_i18n->default', $nameI18n['zh_CN']);
            })
            ->first();
        return $model ? AssetTagFactory::modelToEntity($model) : null;
    }

    public function save(AssetDataIsolation $dataIsolation, AssetTagEntity $entity): AssetTagEntity
    {
        $entity->setOrganizationCode($entity->getOrganizationCode() ?: $dataIsolation->getCurrentOrganizationCode());
        $model = $entity->getId()
            ? AssetTagModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('id', $entity->getId())->first()
            : new AssetTagModel();
        $model ??= new AssetTagModel();
        if (! $entity->getId()) {
            $entity->setId(IdGenerator::getSnowId());
        }
        $model->fill($entity->toArray());
        $model->save();
        return AssetTagFactory::modelToEntity($model);
    }

    public function delete(AssetDataIsolation $dataIsolation, int|string $id, ?string $ownerUid = null): bool
    {
        $builder = AssetTagModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('id', $id);
        if ($ownerUid !== null) {
            $builder->where('owner_uid', $ownerUid);
        }
        return (bool) $builder->first()?->delete();
    }

    public function hasChildren(AssetDataIsolation $dataIsolation, int|string $parentId): bool
    {
        return AssetTagModel::query()
            ->whereIn('organization_code', $dataIsolation->getOrganizationCodes())
            ->where('parent_id', $parentId)
            ->where('status', 1)
            ->exists();
    }
}

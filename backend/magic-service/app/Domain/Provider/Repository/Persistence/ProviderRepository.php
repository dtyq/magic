<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderQuery;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Provider\Assembler\ProviderAssembler;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

class ProviderRepository extends AbstractModelRepository implements ProviderRepositoryInterface
{
    public function getById(int $id): ?ProviderEntity
    {
        $builder = $this->createProviderQuery();
        $builder->where('id', $id);
        $result = Db::select($builder->toSql(), $builder->getBindings());
        if (empty($result)) {
            return null;
        }

        return ProviderAssembler::toEntity($result[0]);
    }

    /**
     * @param array<int> $ids
     * @return array<int, ProviderEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(array $ids): array
    {
        $builder = $this->createProviderQuery();
        $ids = array_values(array_unique($ids));

        if (empty($ids)) {
            return [];
        }

        // 仅拉取指定 ID，避免全表扫描
        $builder->whereIn('id', $ids);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = [];
        foreach ($result as $model) {
            $modelArray = (array) $model;
            $entities[$modelArray['id']] = ProviderAssembler::toEntity($modelArray);
        }

        return $entities;
    }

    public function getByCode(string $providerCode): ?ProviderEntity
    {
        $builder = $this->createProviderQuery();

        $builder->where('provider_code', $providerCode);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        if (empty($result)) {
            return null;
        }

        return ProviderAssembler::toEntity($result[0]);
    }

    /**
     * @return array{total: int, list: array<ProviderEntity>}
     */
    public function queries(ProviderQuery $query, Page $page): array
    {
        $builder = $this->createProviderQuery();

        if ($query->getCategory()) {
            $builder->where('category', $query->getCategory()->value);
        }

        if ($query->getStatus()) {
            $builder->where('status', $query->getStatus()->value);
        }

        if ($query->getProviderCode()) {
            $builder->where('provider_code', $query->getProviderCode()->value);
        }

        if ($query->getProviderType()) {
            $builder->where('provider_type', $query->getProviderType()->value);
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = ProviderAssembler::toEntity((array) $model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function getAllNonOfficialProviders(Category $category): array
    {
        // todo
        return [];
    }

    public function findById(int $id): ?ProviderEntity
    {
        $model = $this->createProviderQuery()
            ->where('id', $id)
            ->first();
        if (! $model) {
            return null;
        }
        return ProviderAssembler::toEntity($model->toArray());
    }

    public function getOfficial(?Category $serviceProviderCategory): ?ProviderEntity
    {
        $query = $this->createProviderQuery();

        if ($serviceProviderCategory) {
            $query->where('category', $serviceProviderCategory->value);
        }
        $query->where('provider_type', ProviderType::Official->value);
        $result = Db::select($query->toSql(), $query->getBindings());
        if (empty($result)) {
            return null;
        }
        return ProviderAssembler::toEntity($result[0]);
    }

    /**
     * 获取指定类别的非官方服务商 (Legacy).
     *
     * @param Category $category 服务商类别
     * @return ProviderEntity[] 非官方服务商列表
     */
    public function getNonOfficialByCategory(Category $category): array
    {
        $query = $this->createProviderQuery();
        $query->where('category', $category->value)
            ->where('provider_type', '!=', ProviderType::Official->value);

        $result = Db::select($query->toSql(), $query->getBindings());
        return ProviderAssembler::toEntities($result);
    }

    /**
     * @return ProviderEntity[]
     */
    public function getByCategory(Category $category): array
    {
        $builder = $this->createProviderQuery();
        $builder->where('category', $category->value);
        // 不排除任何服务商，包括 Official，因为模板需要所有服务商

        $result = Db::select($builder->toSql(), $builder->getBindings());
        return ProviderAssembler::toEntities($result);
    }

    public function getByCodeAndCategory(ProviderCode $providerCode, Category $category): ?ProviderEntity
    {
        $builder = $this->createProviderQuery();
        $builder->where('provider_code', $providerCode->value)
            ->where('category', $category->value);

        $result = Db::select($builder->toSql(), $builder->getBindings());
        if (empty($result)) {
            return null;
        }

        return ProviderAssembler::toEntity($result[0]);
    }

    public function getByIdWithoutOrganizationFilter(int $id): ?ProviderEntity
    {
        $builder = $this->createProviderQuery();
        $builder->where('id', $id);

        $result = Db::select($builder->toSql(), $builder->getBindings());
        if (empty($result)) {
            return null;
        }

        return ProviderAssembler::toEntity($result[0]);
    }

    public function getByIdsWithoutOrganizationFilter(array $ids): array
    {
        $builder = $this->createProviderQuery();
        $ids = array_values(array_unique($ids));

        if (empty($ids)) {
            return [];
        }

        // 仅拉取指定 ID，避免全表扫描
        $builder->whereIn('id', $ids);

        $result = Db::select($builder->toSql(), $builder->getBindings());

        $entities = [];
        foreach ($result as $model) {
            $modelArray = (array) $model;
            $entities[$modelArray['id']] = ProviderAssembler::toEntity($modelArray);
        }

        return $entities;
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderModel 查询构建器.
     */
    private function createProviderQuery(): Builder
    {
        /* @phpstan-ignore-next-line */
        return ProviderModel::query()->whereNull('deleted_at');
    }
}

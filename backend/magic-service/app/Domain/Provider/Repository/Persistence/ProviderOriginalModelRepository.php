<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderOriginalModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderOriginalModelQuery;
use App\Domain\Provider\Repository\Facade\ProviderOriginalModelRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderOriginalModelModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Provider\Assembler\ProviderOriginalModelAssembler;
use DateTime;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

class ProviderOriginalModelRepository extends AbstractModelRepository implements ProviderOriginalModelRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    /**
     * @return array{total: int, list: array<ProviderOriginalModelEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderOriginalModelQuery $query, Page $page): array
    {
        $builder = $this->createProviderOriginalModelQuery($dataIsolation);
        if ($query->getType()) {
            $builder->where('type', $query->getType()->value);
        }
        if (! is_null($query->getIds())) {
            $builder->whereIn('id', $query->getIds());
        }
        if ($query->getModelId()) {
            $builder->where('model_id', $query->getModelId());
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var ProviderOriginalModelModel $model */
        foreach ($result['list'] as $model) {
            $modelArray = $model->toArray();
            $list[] = ProviderOriginalModelAssembler::toEntity($modelArray);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function save(ProviderDataIsolation $dataIsolation, ProviderOriginalModelEntity $providerOriginalModelEntity): ProviderOriginalModelEntity
    {
        $attributes = $this->getFieldAttributes($providerOriginalModelEntity);

        if (! $providerOriginalModelEntity->getId()) {
            // 创建新记录
            $this->initializeEntityForCreation($providerOriginalModelEntity, $attributes);
            ProviderOriginalModelModel::query()->insert($attributes);
        } else {
            // 更新现有记录
            $now = new DateTime();
            $providerOriginalModelEntity->setUpdatedAt($now);
            $attributes['updated_at'] = $now->format('Y-m-d H:i:s');

            ProviderOriginalModelModel::query()
                ->where('id', $providerOriginalModelEntity->getId())
                ->update($attributes);
        }

        return $providerOriginalModelEntity;
    }

    public function delete(ProviderDataIsolation $dataIsolation, string $id): void
    {
        $builder = $this->createProviderOriginalModelQuery($dataIsolation);
        $builder->where('id', $id)->delete();
    }

    /**
     * @return array<ProviderOriginalModelEntity>
     */
    public function list(ProviderDataIsolation $dataIsolation): array
    {
        $systemType = ProviderOriginalModelType::System;

        // 第一次查询：获取系统默认模型（所有组织都可见）
        $systemBuilder = $this->createProviderOriginalModelQuery()
            ->where('type', $systemType->value);
        $systemModels = Db::select($systemBuilder->toSql(), $systemBuilder->getBindings());

        // 第二次查询：获取当前组织的自定义模型
        $organizationBuilder = $this->createProviderOriginalModelQuery($dataIsolation);
        $organizationModels = Db::select($organizationBuilder->toSql(), $organizationBuilder->getBindings());

        // 合并结果
        $allModels = array_merge($systemModels, $organizationModels);

        // 按 id 降序排序
        usort($allModels, static function (array $a, array $b) {
            return $b['id'] <=> $a['id'];
        });

        return ProviderOriginalModelAssembler::toEntities($allModels);
    }

    public function exist(ProviderDataIsolation $dataIsolation, string $modelId, ProviderOriginalModelType $type): bool
    {
        $builder = $this->createProviderOriginalModelQuery($dataIsolation);
        $builder->where('model_id', $modelId);
        $builder->where('type', $type->value);

        $result = Db::select($builder->toSql(), $builder->getBindings());
        return ! empty($result);
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderOriginalModelModel 查询构建器.
     * @param null|ProviderDataIsolation $dataIsolation 如果传入则添加组织代码过滤
     */
    private function createProviderOriginalModelQuery(?ProviderDataIsolation $dataIsolation = null): Builder
    {
        $builder = ProviderOriginalModelModel::query()->whereNull('deleted_at');

        if ($dataIsolation !== null) {
            $builder->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        }
        /* @phpstan-ignore-next-line */
        return $builder;
    }
}

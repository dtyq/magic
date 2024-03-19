<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\MCP\Factory\MCPServerFactory;
use App\Domain\MCP\Repository\Facade\MCPServerRepositoryInterface;
use App\Domain\MCP\Repository\Persistence\Model\MCPServerModel;
use App\Infrastructure\Core\ValueObject\Page;

class MCPServerRepository extends MCPAbstractRepository implements MCPServerRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPServerEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());

        /** @var null|MCPServerModel $model */
        $model = $builder->where('id', $id)->first();

        if (! $model) {
            return null;
        }

        return MCPServerFactory::createEntity($model);
    }

    /**
     * @param array<int> $ids
     * @return array<int, MCPServerEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(MCPDataIsolation $dataIsolation, array $ids): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());
        $ids = array_values(array_unique($ids));

        /** @var array<MCPServerModel> $models */
        $models = $builder->whereIn('id', $ids)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[$model->id] = MCPServerFactory::createEntity($model);
        }

        return $entities;
    }

    public function getByCode(MCPDataIsolation $dataIsolation, string $code): ?MCPServerEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());

        /** @var null|MCPServerModel $model */
        $model = $builder->where('code', $code)->first();

        if (! $model) {
            return null;
        }

        return MCPServerFactory::createEntity($model);
    }

    public function getOrgCodes(MCPDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());

        return $builder->distinct()->pluck('code')->toArray();
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPServerQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());

        if (! is_null($query->getCodes())) {
            if (empty($query->getCodes())) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('code', $query->getCodes());
        }

        if ($query->getName()) {
            $builder->where('name', 'like', '%' . $query->getName() . '%');
        }

        if ($query->getType()) {
            $builder->where('type', $query->getType()->value);
        }

        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }

        if ($query->getWithToolCount()) {
            $builder->withCount('tools');
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var MCPServerModel $model */
        foreach ($result['list'] as $model) {
            $entity = MCPServerFactory::createEntity($model);
            if ($model->getAttribute('tools_count')) {
                $entity->setToolsCount($model->getAttribute('tools_count'));
            }
            $list[] = $entity;
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function save(MCPDataIsolation $dataIsolation, MCPServerEntity $entity): MCPServerEntity
    {
        if (! $entity->getId()) {
            $model = new MCPServerModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());
            $model = $builder->where('id', $entity->getId())->first();
        }

        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function delete(MCPDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerModel::query());
        return $builder->where('code', $code)->delete() > 0;
    }
}

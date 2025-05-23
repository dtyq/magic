<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Factory\MCPServerToolFactory;
use App\Domain\MCP\Repository\Facade\MCPServerToolRepositoryInterface;
use App\Domain\MCP\Repository\Persistence\Model\MCPServerToolModel;

class MCPServerToolRepository extends MCPAbstractRepository implements MCPServerToolRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPServerToolEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());

        /** @var null|MCPServerToolModel $model */
        $model = $builder->where('id', $id)->first();

        if (! $model) {
            return null;
        }

        return MCPServerToolFactory::createEntity($model);
    }

    public function getByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): ?MCPServerToolEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());

        /** @var null|MCPServerToolModel $model */
        $model = $builder->where('mcp_server_code', $mcpServerCode)->first();

        if (! $model) {
            return null;
        }

        return MCPServerToolFactory::createEntity($model);
    }

    /**
     * @param array<string> $mcpServerCodes
     * @return array<MCPServerToolEntity>
     */
    public function getByMcpServerCodes(MCPDataIsolation $dataIsolation, array $mcpServerCodes): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());
        $mcpServerCodes = array_values(array_unique($mcpServerCodes));

        /** @var array<MCPServerToolModel> $models */
        $models = $builder->whereIn('mcp_server_code', $mcpServerCodes)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = MCPServerToolFactory::createEntity($model);
        }

        return $entities;
    }

    public function save(MCPDataIsolation $dataIsolation, MCPServerToolEntity $entity): MCPServerToolEntity
    {
        if (! $entity->getId()) {
            $model = new MCPServerToolModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());
            $model = $builder->where('id', $entity->getId())->first();
        }

        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());
        return $builder->where('id', $id)->delete() > 0;
    }

    /**
     * 根据ID和mcpServerCode联合查询工具.
     */
    public function getByIdAndMcpServerCode(MCPDataIsolation $dataIsolation, int $id, string $mcpServerCode): ?MCPServerToolEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPServerToolModel::query());

        /** @var null|MCPServerToolModel $model */
        $model = $builder->where('id', $id)
            ->where('mcp_server_code', $mcpServerCode)
            ->first();

        if (! $model) {
            return null;
        }

        return MCPServerToolFactory::createEntity($model);
    }
}

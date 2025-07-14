<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPUserSettingQuery;
use App\Domain\MCP\Factory\MCPUserSettingFactory;
use App\Domain\MCP\Repository\Facade\MCPUserSettingRepositoryInterface;
use App\Domain\MCP\Repository\Persistence\Model\MCPUserSettingModel;
use App\Infrastructure\Core\ValueObject\Page;

class MCPUserSettingRepository extends MCPAbstractRepository implements MCPUserSettingRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPUserSettingEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());

        /** @var null|MCPUserSettingModel $model */
        $model = $builder->where('id', $id)->first();

        if (! $model) {
            return null;
        }

        return MCPUserSettingFactory::createEntity($model);
    }

    /**
     * @param array<int> $ids
     * @return array<int, MCPUserSettingEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(MCPDataIsolation $dataIsolation, array $ids): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());
        $ids = array_values(array_unique($ids));

        /** @var array<MCPUserSettingModel> $models */
        $models = $builder->whereIn('id', $ids)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[$model->id] = MCPUserSettingFactory::createEntity($model);
        }

        return $entities;
    }

    public function getByUserAndMcpServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): ?MCPUserSettingEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());

        /** @var null|MCPUserSettingModel $model */
        $model = $builder->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->first();

        if (! $model) {
            return null;
        }

        return MCPUserSettingFactory::createEntity($model);
    }

    /**
     * @return array<MCPUserSettingEntity>
     */
    public function getByUserId(MCPDataIsolation $dataIsolation, string $userId): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());

        /** @var array<MCPUserSettingModel> $models */
        $models = $builder->where('user_id', $userId)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = MCPUserSettingFactory::createEntity($model);
        }

        return $entities;
    }

    /**
     * @return array<MCPUserSettingEntity>
     */
    public function getByMcpServerId(MCPDataIsolation $dataIsolation, string $mcpServerId): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());

        /** @var array<MCPUserSettingModel> $models */
        $models = $builder->where('mcp_server_id', $mcpServerId)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = MCPUserSettingFactory::createEntity($model);
        }

        return $entities;
    }

    /**
     * @return array{total: int, list: array<MCPUserSettingEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPUserSettingQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());

        if ($query->getUserId()) {
            $builder->where('user_id', $query->getUserId());
        }

        if ($query->getMcpServerId()) {
            $builder->where('mcp_server_id', $query->getMcpServerId());
        }

        if ($query->getHasOauth2AuthResult() !== null) {
            if ($query->getHasOauth2AuthResult()) {
                $builder->whereNotNull('oauth2_auth_result');
            } else {
                $builder->whereNull('oauth2_auth_result');
            }
        }

        if ($query->getHasRequireFields() !== null) {
            if ($query->getHasRequireFields()) {
                $builder->where(function ($query) {
                    $query->whereNotNull('require_fields')
                        ->where('require_fields', '!=', '[]')
                        ->where('require_fields', '!=', '{}');
                });
            } else {
                $builder->where(function ($query) {
                    $query->whereNull('require_fields')
                        ->orWhere('require_fields', '[]')
                        ->orWhere('require_fields', '{}');
                });
            }
        }

        if ($query->getHasConfiguration() !== null) {
            if ($query->getHasConfiguration()) {
                $builder->where(function ($query) {
                    $query->whereNotNull('oauth2_auth_result')
                        ->orWhere(function ($q) {
                            $q->whereNotNull('require_fields')
                                ->where('require_fields', '!=', '[]')
                                ->where('require_fields', '!=', '{}');
                        })
                        ->orWhere(function ($q) {
                            $q->whereNotNull('additional_config')
                                ->where('additional_config', '!=', '[]')
                                ->where('additional_config', '!=', '{}');
                        });
                });
            } else {
                $builder->where(function ($query) {
                    $query->whereNull('oauth2_auth_result')
                        ->where(function ($q) {
                            $q->whereNull('require_fields')
                                ->orWhere('require_fields', '[]')
                                ->orWhere('require_fields', '{}');
                        })
                        ->where(function ($q) {
                            $q->whereNull('additional_config')
                                ->orWhere('additional_config', '[]')
                                ->orWhere('additional_config', '{}');
                        });
                });
            }
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var MCPUserSettingModel $model */
        foreach ($result['list'] as $model) {
            $list[] = MCPUserSettingFactory::createEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function save(MCPDataIsolation $dataIsolation, MCPUserSettingEntity $entity): MCPUserSettingEntity
    {
        if (! $entity->getId()) {
            $model = new MCPUserSettingModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());
            $model = $builder->where('id', $entity->getId())->first();
        }

        $model->fill(MCPUserSettingFactory::createModel($entity));
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());
        return $builder->where('id', $id)->delete() > 0;
    }

    public function deleteByUserAndMcpServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): bool
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());
        return $builder->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->delete() > 0;
    }

    public function updateAdditionalConfig(MCPDataIsolation $dataIsolation, string $mcpServerId, string $additionalKey, array $additionalValue): void
    {
        $builder = $this->createBuilder($dataIsolation, MCPUserSettingModel::query());
        $model = $builder->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('mcp_server_id', $mcpServerId)
            ->first();

        if (! $model) {
            $model = new MCPUserSettingModel();
            $model->user_id = $dataIsolation->getCurrentUserId();
            $model->mcp_server_id = $mcpServerId;
            $model->organization_code = $dataIsolation->getCurrentOrganizationCode();
            $model->creator = $dataIsolation->getCurrentUserId();
            $model->modifier = $dataIsolation->getCurrentUserId();
        } else {
            $additionalConfig = $model->additional_config ?? [];
        }
        $additionalConfig[$additionalKey] = $additionalValue;

        $model->additional_config = $additionalConfig;
        $model->save();
    }
}

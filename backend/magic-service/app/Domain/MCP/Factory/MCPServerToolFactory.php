<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Factory;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\ToolOptions;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\Domain\MCP\Repository\Persistence\Model\MCPServerToolModel;

class MCPServerToolFactory
{
    /**
     * 从模型创建实体.
     */
    public static function createEntity(MCPServerToolModel $model): MCPServerToolEntity
    {
        $entity = new MCPServerToolEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setMcpServerCode($model->mcp_server_code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setSource(ToolSource::fromValue($model->source) ?? ToolSource::Unknown);
        $entity->setRelCode($model->rel_code);
        $entity->setRelVersionCode($model->rel_version_code);
        $entity->setRelInfo($model->rel_info);
        $entity->setVersion($model->version);
        $entity->setEnabled($model->enabled);
        $entity->setOptions(ToolOptions::fromArray($model->options));
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Factory;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\MCP\Repository\Persistence\Model\MCPServerModel;

class MCPServerFactory
{
    public static function createEntity(MCPServerModel $model): MCPServerEntity
    {
        $entity = new MCPServerEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setIcon($model->icon);
        $entity->setType(ServiceType::from($model->type));
        $entity->setEnabled($model->enabled);
        $entity->setExternalSseUrl($model->external_sse_url);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}

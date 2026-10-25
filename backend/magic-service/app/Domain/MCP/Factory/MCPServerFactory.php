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
        $serviceType = ServiceType::from($model->type);
        $entity->setType($serviceType);
        $entity->setEnabled($model->enabled);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        // Handle service_config field with backward compatibility for external_sse_url
        $serviceConfigData = [];
        // service_config 是 JSON cast，每次读取都会 decode，只读一次
        $rawServiceConfig = $model->service_config;

        if ($rawServiceConfig) {
            // If service_config exists, use it directly
            $entity->setServiceConfig($serviceType->createServiceConfig($rawServiceConfig));
        } else {
            // For backward compatibility, create service_config from external_sse_url if exists
            if (! empty($model->external_sse_url)
                && ($serviceType === ServiceType::ExternalSSE || $serviceType === ServiceType::ExternalStreamableHttp)) {
                $serviceConfigData['url'] = $model->external_sse_url;
            }

            // Always create a serviceConfig, even if it's empty
            $entity->setServiceConfig($serviceType->createServiceConfig($serviceConfigData));
        }

        return $entity;
    }
}

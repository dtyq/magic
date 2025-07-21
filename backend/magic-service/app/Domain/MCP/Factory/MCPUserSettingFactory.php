<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Factory;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use App\Domain\MCP\Repository\Persistence\Model\MCPUserSettingModel;

class MCPUserSettingFactory
{
    public static function createEntity(MCPUserSettingModel $model): MCPUserSettingEntity
    {
        $entity = new MCPUserSettingEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setUserId($model->user_id);
        $entity->setMcpServerId($model->mcp_server_id);
        $entity->setRequireFieldsFromArray($model->require_fields ?? []);
        $entity->setAdditionalConfig($model->additional_config ?? []);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        // Handle OAuth2 auth result
        if ($model->oauth2_auth_result) {
            $entity->setOauth2AuthResult(OAuth2AuthResult::fromArray($model->oauth2_auth_result));
        }

        return $entity;
    }

    public static function createModel(MCPUserSettingEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'organization_code' => $entity->getOrganizationCode(),
            'user_id' => $entity->getUserId(),
            'mcp_server_id' => $entity->getMcpServerId(),
            'require_fields' => $entity->getRequireFieldsAsArray(),
            'oauth2_auth_result' => $entity->getOauth2AuthResult()?->toArray(),
            'additional_config' => $entity->getAdditionalConfig(),
            'creator' => $entity->getCreator(),
            'created_at' => $entity->getCreatedAt(),
            'modifier' => $entity->getModifier(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Factory;

use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Repository\Persistence\Model\MCPAuthorizationCredentialModel;

/**
 * MCP 标准授权凭据 Entity 与 Model 转换器。
 */
class MCPAuthorizationCredentialFactory
{
    /**
     * 从数据库模型构造凭据实体。
     */
    public static function createEntity(MCPAuthorizationCredentialModel $model): MCPAuthorizationCredentialEntity
    {
        $entity = new MCPAuthorizationCredentialEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode((string) $model->organization_code);
        $entity->setUserId((string) $model->user_id);
        $entity->setMcpServerId((string) $model->mcp_server_id);
        $entity->setResource((string) $model->resource);
        $entity->setResourceHash((string) $model->resource_hash);
        $entity->setIssuer((string) $model->issuer);
        $entity->setIssuerHash((string) $model->issuer_hash);
        $entity->setRegistrationMode((string) $model->registration_mode);
        $entity->setClientId((string) $model->client_id);
        $entity->setClientSecretCiphertext($model->client_secret_ciphertext);
        $entity->setTokenEndpointAuthMethod((string) $model->token_endpoint_auth_method);
        $entity->setAccessTokenCiphertext((string) $model->access_token_ciphertext);
        $entity->setRefreshTokenCiphertext($model->refresh_token_ciphertext);
        $entity->setTokenType((string) $model->token_type);
        $entity->setScope($model->scope);
        $entity->setExpiresAt($model->expires_at);
        $entity->setRefreshTokenExpiresAt($model->refresh_token_expires_at);
        $entity->setDiscoveryMetadata($model->discovery_metadata ?? []);
        $entity->setClientMetadata($model->client_metadata ?? []);
        $entity->setCreator((string) $model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier((string) $model->modifier);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }

    /**
     * 将凭据实体转换为数据库模型属性。
     *
     * @return array<string, mixed>
     */
    public static function createModel(MCPAuthorizationCredentialEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'organization_code' => $entity->getOrganizationCode(),
            'user_id' => $entity->getUserId(),
            'mcp_server_id' => $entity->getMcpServerId(),
            'resource' => $entity->getResource(),
            'resource_hash' => $entity->getResourceHash(),
            'issuer' => $entity->getIssuer(),
            'issuer_hash' => $entity->getIssuerHash(),
            'registration_mode' => $entity->getRegistrationMode(),
            'client_id' => $entity->getClientId(),
            'client_secret_ciphertext' => $entity->getClientSecretCiphertext(),
            'token_endpoint_auth_method' => $entity->getTokenEndpointAuthMethod(),
            'access_token_ciphertext' => $entity->getAccessTokenCiphertext(),
            'refresh_token_ciphertext' => $entity->getRefreshTokenCiphertext(),
            'token_type' => $entity->getTokenType(),
            'scope' => $entity->getScope(),
            'expires_at' => $entity->getExpiresAt(),
            'refresh_token_expires_at' => $entity->getRefreshTokenExpiresAt(),
            'discovery_metadata' => $entity->getDiscoveryMetadata(),
            'client_metadata' => $entity->getClientMetadata(),
            'creator' => $entity->getCreator(),
            'created_at' => $entity->getCreatedAt(),
            'modifier' => $entity->getModifier(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }
}

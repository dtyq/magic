<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * MCP 标准授权凭据持久化模型。
 */
class MCPAuthorizationCredentialModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_mcp_authorization_credentials';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'mcp_server_id',
        'resource',
        'resource_hash',
        'issuer',
        'issuer_hash',
        'registration_mode',
        'client_id',
        'client_secret_ciphertext',
        'token_endpoint_auth_method',
        'access_token_ciphertext',
        'refresh_token_ciphertext',
        'token_type',
        'scope',
        'expires_at',
        'refresh_token_expires_at',
        'discovery_metadata',
        'client_metadata',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'discovery_metadata' => 'array',
        'client_metadata' => 'array',
        'expires_at' => 'datetime',
        'refresh_token_expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}

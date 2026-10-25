<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;

/**
 * MCP Authorization pending state 与当前服务配置的指纹。
 *
 * 只覆盖会影响授权链接或回调换票的字段，名称、图标、启用状态不参与。
 */
final class MCPAuthorizationConfigFingerprint
{
    public static function from(
        string $serviceUrl,
        MCPAuthorizationConfig $config,
        string $resource,
        string $redirectUri
    ): string {
        return hash('sha256', (string) json_encode([
            'url' => $serviceUrl,
            'resource' => $resource,
            'resource_metadata_url' => $config->getResourceMetadataUrl(),
            'authorization_server_url' => $config->getAuthorizationServerUrl(),
            'authorization_endpoint' => $config->getAuthorizationEndpoint(),
            'token_endpoint' => $config->getTokenEndpoint(),
            'registration_endpoint' => $config->getRegistrationEndpoint(),
            'registration_mode' => $config->getRegistrationMode(),
            'client_id' => $config->getClientId(),
            'client_metadata_url' => $config->getClientMetadataUrl(),
            'scope' => $config->getScope(),
            'redirect_uri' => $redirectUri,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @param array<string, mixed> $pendingState
     */
    public static function matches(array $pendingState, string $fingerprint): bool
    {
        $stored = (string) ($pendingState['config_fingerprint'] ?? '');
        return $stored !== '' && hash_equals($stored, $fingerprint);
    }
}

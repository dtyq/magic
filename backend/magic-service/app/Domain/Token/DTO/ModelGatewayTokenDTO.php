<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\DTO;

/**
 * 模型网关用户 token 对（Domain DTO）.
 * 由 Domain 层生成，供 Application/Interface 层组装响应使用。
 */
readonly class ModelGatewayTokenDTO
{
    public function __construct(
        private string $apiKey,
        private string $refreshToken,
        private string $apiKeyExpiresAt,
        private string $refreshTokenExpiresAt
    ) {
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function getRefreshToken(): string
    {
        return $this->refreshToken;
    }

    public function getApiKeyExpiresAt(): string
    {
        return $this->apiKeyExpiresAt;
    }

    public function getRefreshTokenExpiresAt(): string
    {
        return $this->refreshTokenExpiresAt;
    }

    public function toArray(): array
    {
        return [
            'api_key' => $this->apiKey,
            'refresh_token' => $this->refreshToken,
            'api_key_expires_at' => $this->apiKeyExpiresAt,
            'refresh_token_expires_at' => $this->refreshTokenExpiresAt,
        ];
    }
}

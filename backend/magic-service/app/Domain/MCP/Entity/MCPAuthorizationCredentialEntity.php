<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

/**
 * MCP 标准授权凭据实体。
 */
class MCPAuthorizationCredentialEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode = '';

    protected string $userId = '';

    protected string $mcpServerId = '';

    protected string $resource = '';

    protected string $resourceHash = '';

    protected string $issuer = '';

    protected string $issuerHash = '';

    protected string $registrationMode = 'pre_registered';

    protected string $clientId = '';

    protected ?string $clientSecretCiphertext = null;

    protected string $tokenEndpointAuthMethod = 'none';

    protected string $accessTokenCiphertext = '';

    protected ?string $refreshTokenCiphertext = null;

    protected string $tokenType = 'Bearer';

    protected ?string $scope = null;

    protected ?DateTime $expiresAt = null;

    protected ?DateTime $refreshTokenExpiresAt = null;

    /** @var array<string, mixed> */
    protected array $discoveryMetadata = [];

    /** @var array<string, mixed> */
    protected array $clientMetadata = [];

    protected string $creator = '';

    protected ?DateTime $createdAt = null;

    protected string $modifier = '';

    protected ?DateTime $updatedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getMcpServerId(): string
    {
        return $this->mcpServerId;
    }

    public function setMcpServerId(string $mcpServerId): void
    {
        $this->mcpServerId = $mcpServerId;
    }

    public function getResource(): string
    {
        return $this->resource;
    }

    public function setResource(string $resource): void
    {
        $this->resource = $resource;
        $this->resourceHash = hash('sha256', $resource);
    }

    public function getResourceHash(): string
    {
        return $this->resourceHash;
    }

    public function setResourceHash(string $resourceHash): void
    {
        $this->resourceHash = $resourceHash;
    }

    public function getIssuer(): string
    {
        return $this->issuer;
    }

    public function setIssuer(string $issuer): void
    {
        $this->issuer = $issuer;
        $this->issuerHash = hash('sha256', $issuer);
    }

    public function getIssuerHash(): string
    {
        return $this->issuerHash;
    }

    public function setIssuerHash(string $issuerHash): void
    {
        $this->issuerHash = $issuerHash;
    }

    public function getRegistrationMode(): string
    {
        return $this->registrationMode;
    }

    public function setRegistrationMode(string $mode): void
    {
        $this->registrationMode = $mode;
    }

    public function getClientId(): string
    {
        return $this->clientId;
    }

    public function setClientId(string $clientId): void
    {
        $this->clientId = $clientId;
    }

    public function getClientSecretCiphertext(): ?string
    {
        return $this->clientSecretCiphertext;
    }

    public function setClientSecretCiphertext(?string $ciphertext): void
    {
        $this->clientSecretCiphertext = $ciphertext;
    }

    public function getTokenEndpointAuthMethod(): string
    {
        return $this->tokenEndpointAuthMethod;
    }

    public function setTokenEndpointAuthMethod(string $method): void
    {
        $this->tokenEndpointAuthMethod = $method;
    }

    public function getAccessTokenCiphertext(): string
    {
        return $this->accessTokenCiphertext;
    }

    public function setAccessTokenCiphertext(string $ciphertext): void
    {
        $this->accessTokenCiphertext = $ciphertext;
    }

    public function getRefreshTokenCiphertext(): ?string
    {
        return $this->refreshTokenCiphertext;
    }

    public function setRefreshTokenCiphertext(?string $ciphertext): void
    {
        $this->refreshTokenCiphertext = $ciphertext;
    }

    public function getTokenType(): string
    {
        return $this->tokenType;
    }

    public function setTokenType(string $tokenType): void
    {
        $this->tokenType = $tokenType ?: 'Bearer';
    }

    public function getScope(): ?string
    {
        return $this->scope;
    }

    public function setScope(?string $scope): void
    {
        $this->scope = $scope;
    }

    public function getExpiresAt(): ?DateTime
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(null|DateTime|string $expiresAt): void
    {
        $this->expiresAt = is_string($expiresAt) ? new DateTime($expiresAt) : $expiresAt;
    }

    public function getRefreshTokenExpiresAt(): ?DateTime
    {
        return $this->refreshTokenExpiresAt;
    }

    public function setRefreshTokenExpiresAt(null|DateTime|string $expiresAt): void
    {
        $this->refreshTokenExpiresAt = is_string($expiresAt) ? new DateTime($expiresAt) : $expiresAt;
    }

    /**
     * 判断访问令牌是否仍然可用。
     */
    public function isAccessTokenValid(int $leewaySeconds = 30): bool
    {
        if ($this->accessTokenCiphertext === '') {
            return false;
        }
        return $this->expiresAt === null || $this->expiresAt->getTimestamp() > time() + $leewaySeconds;
    }

    /** @return array<string, mixed> */
    public function getDiscoveryMetadata(): array
    {
        return $this->discoveryMetadata;
    }

    /** @param array<string, mixed> $metadata */
    public function setDiscoveryMetadata(array $metadata): void
    {
        $this->discoveryMetadata = $metadata;
    }

    /** @return array<string, mixed> */
    public function getClientMetadata(): array
    {
        return $this->clientMetadata;
    }

    /** @param array<string, mixed> $metadata */
    public function setClientMetadata(array $metadata): void
    {
        $this->clientMetadata = $metadata;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime|string $createdAt): void
    {
        $this->createdAt = is_string($createdAt) ? new DateTime($createdAt) : $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime|string $updatedAt): void
    {
        $this->updatedAt = is_string($updatedAt) ? new DateTime($updatedAt) : $updatedAt;
    }
}

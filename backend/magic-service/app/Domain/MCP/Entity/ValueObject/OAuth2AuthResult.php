<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use DateTime;
use DateTimeInterface;
use Exception;
use InvalidArgumentException;

class OAuth2AuthResult extends AbstractValueObject
{
    protected string $accessToken = '';

    protected ?string $refreshToken = null;

    protected ?DateTime $expiresAt = null;

    protected string $tokenType = 'Bearer';

    protected ?string $scope = null;

    // Enhanced functionality for OAuth2/OpenID Connect
    protected ?string $idToken = null;

    protected ?array $userInfo = null;

    protected ?DateTime $refreshTokenExpiresAt = null;

    protected string $state = '';

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function setAccessToken(string $accessToken): self
    {
        $this->accessToken = $accessToken;
        return $this;
    }

    public function getRefreshToken(): ?string
    {
        return $this->refreshToken;
    }

    public function setRefreshToken(?string $refreshToken): self
    {
        $this->refreshToken = $refreshToken;
        return $this;
    }

    public function getExpiresAt(): ?DateTime
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(?DateTime $expiresAt): self
    {
        $this->expiresAt = $expiresAt;
        return $this;
    }

    public function setExpiresIn(int $expiresIn): self
    {
        $this->expiresAt = new DateTime();
        $this->expiresAt->modify("+{$expiresIn} seconds");
        return $this;
    }

    public function getTokenType(): string
    {
        return $this->tokenType;
    }

    public function setTokenType(string $tokenType): self
    {
        $this->tokenType = $tokenType;
        return $this;
    }

    public function getScope(): ?string
    {
        return $this->scope;
    }

    public function setScope(?string $scope): self
    {
        $this->scope = $scope;
        return $this;
    }

    /**
     * Check if the access token is expired.
     * Returns false if no access token exists or if expiresAt is null (never expires).
     */
    public function isExpired(): bool
    {
        // No access token means not authenticated, not expired
        if (empty($this->accessToken)) {
            return false;
        }

        // No expiration set means never expires
        if ($this->expiresAt === null) {
            return false;
        }

        return new DateTime() > $this->expiresAt;
    }

    /**
     * Check if the access token will expire within the given seconds.
     * Returns false if no access token exists or if expiresAt is null (never expires).
     */
    public function willExpireWithin(int $seconds): bool
    {
        // No access token means not authenticated
        if (empty($this->accessToken)) {
            return false;
        }

        // No expiration set means never expires
        if ($this->expiresAt === null) {
            return false;
        }

        $checkTime = new DateTime();
        $checkTime->modify("+{$seconds} seconds");

        return $checkTime > $this->expiresAt;
    }

    /**
     * Get remaining seconds until expiration.
     * Returns null if no access token exists or if expiresAt is null (never expires).
     */
    public function getRemainingSeconds(): ?int
    {
        // No access token means not authenticated
        if (empty($this->accessToken)) {
            return null;
        }

        // No expiration set means never expires
        if ($this->expiresAt === null) {
            return null;
        }

        $now = new DateTime();
        if ($now > $this->expiresAt) {
            return 0; // Already expired
        }

        return $this->expiresAt->getTimestamp() - $now->getTimestamp();
    }

    /**
     * Check if the access token is valid (exists and not expired).
     */
    public function isValid(): bool
    {
        return ! empty($this->accessToken) && ! $this->isExpired();
    }

    /**
     * Check if has valid access token.
     */
    public function hasAccessToken(): bool
    {
        return ! empty($this->accessToken);
    }

    /**
     * Create a new instance with updated access token.
     */
    public function withAccessToken(string $accessToken, ?int $expiresIn = null): self
    {
        $instance = clone $this;
        $instance->setAccessToken($accessToken);

        if ($expiresIn !== null) {
            $instance->setExpiresIn($expiresIn);
        }

        return $instance;
    }

    /**
     * Create a new instance with updated refresh token.
     */
    public function withRefreshToken(string $refreshToken): self
    {
        $instance = clone $this;
        $instance->setRefreshToken($refreshToken);
        return $instance;
    }

    /**
     * Convert to array representation.
     */
    public function toArray(): array
    {
        return [
            'access_token' => $this->accessToken,
            'refresh_token' => $this->refreshToken,
            'expires_at' => $this->expiresAt?->format(DateTimeInterface::ATOM),
            'token_type' => $this->tokenType,
            'scope' => $this->scope,
        ];
    }

    /**
     * Create from array representation.
     */
    public static function fromArray(array $data): self
    {
        if (empty($data['access_token'])) {
            throw new InvalidArgumentException('access_token is required');
        }

        $instance = new self();
        $instance->setAccessToken($data['access_token']);

        if (! empty($data['refresh_token'])) {
            $instance->setRefreshToken($data['refresh_token']);
        }

        if (! empty($data['expires_at'])) {
            $instance->setExpiresAt(new DateTime($data['expires_at']));
        }

        if (! empty($data['token_type'])) {
            $instance->setTokenType($data['token_type']);
        }

        if (! empty($data['scope'])) {
            $instance->setScope($data['scope']);
        }

        return $instance;
    }

    /**
     * Create from form array data with flexible field mapping.
     * Supports different field name conventions and validates input.
     */
    public static function fromFormArray(array $formData): self
    {
        // Map different possible field names for access token
        $accessToken = $formData['access_token']
            ?? $formData['accessToken']
            ?? $formData['token']
            ?? null;

        if (empty($accessToken)) {
            throw new InvalidArgumentException('access_token is required in form data');
        }

        $instance = new self();
        $instance->setAccessToken($accessToken);

        // Map refresh token fields
        $refreshToken = $formData['refresh_token']
            ?? $formData['refreshToken']
            ?? null;

        if (! empty($refreshToken)) {
            $instance->setRefreshToken($refreshToken);
        }

        // Handle expiration - can be timestamped, ISO string, or seconds from now
        $expires = $formData['expires_at']
            ?? $formData['expiresAt']
            ?? $formData['expires_in']
            ?? $formData['expiresIn']
            ?? null;

        if (! empty($expires)) {
            if (is_numeric($expires)) {
                // If numeric, treat as seconds from now
                $instance->setExpiresIn((int) $expires);
            } else {
                // Try to parse as datetime string
                try {
                    $instance->setExpiresAt(new DateTime($expires));
                } catch (Exception $e) {
                    throw new InvalidArgumentException('Invalid expires_at format: ' . $e->getMessage());
                }
            }
        }

        // Map token type fields
        $tokenType = $formData['token_type']
            ?? $formData['tokenType']
            ?? 'Bearer';

        $instance->setTokenType($tokenType);

        // Map scope fields
        $scope = $formData['scope'] ?? null;

        if (! empty($scope)) {
            // Handle scope as array or string
            if (is_array($scope)) {
                $instance->setScope(implode(' ', $scope));
            } else {
                $instance->setScope($scope);
            }
        }

        return $instance;
    }

    /**
     * Create from OAuth2 standard response.
     */
    public static function fromOAuth2Response(array $response): self
    {
        if (empty($response['access_token'])) {
            throw new InvalidArgumentException('access_token is required in OAuth2 response');
        }

        $instance = new self();
        $instance->setAccessToken($response['access_token']);

        if (! empty($response['refresh_token'])) {
            $instance->setRefreshToken($response['refresh_token']);
        }

        if (! empty($response['expires_in'])) {
            $instance->setExpiresIn((int) $response['expires_in']);
        }

        if (! empty($response['token_type'])) {
            $instance->setTokenType($response['token_type']);
        }

        if (! empty($response['scope'])) {
            $instance->setScope($response['scope']);
        }

        return $instance;
    }

    /**
     * Get authorization header value.
     */
    public function getAuthorizationHeader(): string
    {
        return $this->tokenType . ' ' . $this->accessToken;
    }

    /**
     * Check if has valid refresh token.
     */
    public function hasRefreshToken(): bool
    {
        return ! empty($this->refreshToken);
    }
}

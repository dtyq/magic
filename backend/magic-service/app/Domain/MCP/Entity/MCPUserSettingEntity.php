<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity;

use App\Domain\MCP\Entity\ValueObject\OAuth2AuthResult;
use App\Domain\MCP\Entity\ValueObject\RequireField;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class MCPUserSettingEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $userId;

    protected string $mcpServerId;

    /**
     * Required fields configuration.
     * @var RequireField[]
     */
    protected array $requireFields = [];

    /**
     * OAuth2 authentication result.
     * Stores OAuth2 tokens and related data.
     */
    protected ?OAuth2AuthResult $oauth2AuthResult = null;

    /**
     * Additional configuration data as JSON.
     * For future extensibility.
     *
     * @var array<string, mixed>
     */
    protected array $additionalConfig = [];

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

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

    /**
     * Get required fields configuration.
     */
    public function getRequireFields(): array
    {
        return $this->requireFields;
    }

    /**
     * Set required fields configuration.
     */
    public function setRequireFields(array $requireFields): void
    {
        $this->requireFields = $requireFields;
    }

    /**
     * Set required fields from array format.
     */
    public function setRequireFieldsFromArray(array $requireFields): void
    {
        $this->requireFields = [];
        foreach ($requireFields as $fieldData) {
            if (is_array($fieldData)) {
                $field = RequireField::fromArray($fieldData);
                // Only add field if it's not null (field_name is not empty)
                if ($field !== null) {
                    $this->requireFields[] = $field;
                }
            }
        }
    }

    /**
     * Set required fields from legacy key-value format.
     *
     * @param array<string, string> $keyValueArray
     */
    public function setRequireFieldsFromKeyValue(array $keyValueArray): void
    {
        $this->requireFields = [];
        foreach ($keyValueArray as $fieldName => $fieldValue) {
            // Skip if field_name is empty
            if (empty($fieldName)) {
                continue;
            }
            $field = new RequireField();
            $field->setFieldName($fieldName)->setFieldValue($fieldValue);
            $this->requireFields[] = $field;
        }
    }

    /**
     * Set a specific required field.
     */
    public function setRequireField(string $fieldName, string $fieldValue): void
    {
        // Skip if field_name is empty
        if (empty($fieldName)) {
            return;
        }

        // Find existing field
        foreach ($this->requireFields as $field) {
            if ($field->getFieldName() === $fieldName) {
                $field->setFieldValue($fieldValue);
                return;
            }
        }

        // Add new field if not found
        $field = new RequireField();
        $field->setFieldName($fieldName)->setFieldValue($fieldValue);
        $this->requireFields[] = $field;
    }

    /**
     * Get a specific required field value.
     */
    public function getRequireField(string $fieldName): ?string
    {
        // Return null if field_name is empty
        if (empty($fieldName)) {
            return null;
        }

        foreach ($this->requireFields as $field) {
            if ($field->getFieldName() === $fieldName) {
                return $field->getFieldValue();
            }
        }
        return null;
    }

    /**
     * Remove a required field.
     */
    public function removeRequireField(string $fieldName): void
    {
        // Skip if field_name is empty
        if (empty($fieldName)) {
            return;
        }

        $this->requireFields = array_filter(
            $this->requireFields,
            fn (RequireField $field) => $field->getFieldName() !== $fieldName
        );
        // Re-index array
        $this->requireFields = array_values($this->requireFields);
    }

    /**
     * Check if a required field exists.
     */
    public function hasRequireField(string $fieldName): bool
    {
        // Return false if field_name is empty
        if (empty($fieldName)) {
            return false;
        }

        foreach ($this->requireFields as $field) {
            if ($field->getFieldName() === $fieldName) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get require fields as array format.
     */
    public function getRequireFieldsAsArray(): array
    {
        return array_map(
            fn (RequireField $field) => $field->toArray(),
            $this->requireFields
        );
    }

    /**
     * Get OAuth2 authentication result.
     */
    public function getOauth2AuthResult(): ?OAuth2AuthResult
    {
        return $this->oauth2AuthResult;
    }

    /**
     * Set OAuth2 authentication result.
     */
    public function setOauth2AuthResult(?OAuth2AuthResult $oauth2AuthResult): void
    {
        $this->oauth2AuthResult = $oauth2AuthResult;
    }

    /**
     * Set OAuth2 tokens from standard OAuth2 response.
     */
    public function setOauth2TokensFromResponse(array $response): void
    {
        $this->oauth2AuthResult = OAuth2AuthResult::fromOAuth2Response($response);
    }

    /**
     * Get OAuth2 access token.
     */
    public function getOauth2AccessToken(): ?string
    {
        return $this->oauth2AuthResult?->getAccessToken();
    }

    /**
     * Get OAuth2 refresh token.
     */
    public function getOauth2RefreshToken(): ?string
    {
        return $this->oauth2AuthResult?->getRefreshToken();
    }

    /**
     * Check if OAuth2 access token is expired.
     */
    public function isOauth2TokenExpired(): bool
    {
        return $this->oauth2AuthResult?->isExpired() ?? false;
    }

    /**
     * Check if OAuth2 access token will expire within the given seconds.
     */
    public function willOauth2TokenExpireWithin(int $seconds): bool
    {
        return $this->oauth2AuthResult?->willExpireWithin($seconds) ?? false;
    }

    /**
     * Get OAuth2 authorization header value.
     */
    public function getOauth2AuthorizationHeader(): ?string
    {
        return $this->oauth2AuthResult?->getAuthorizationHeader();
    }

    /**
     * Check if has OAuth2 refresh token.
     */
    public function hasOauth2RefreshToken(): bool
    {
        return $this->oauth2AuthResult?->hasRefreshToken() ?? false;
    }

    /**
     * Get additional configuration.
     *
     * @return array<string, mixed>
     */
    public function getAdditionalConfig(): array
    {
        return $this->additionalConfig;
    }

    /**
     * Set additional configuration.
     *
     * @param array<string, mixed> $additionalConfig
     */
    public function setAdditionalConfig(array $additionalConfig): void
    {
        $this->additionalConfig = $additionalConfig;
    }

    /**
     * Set a specific additional config value.
     */
    public function setAdditionalConfigValue(string $key, mixed $value): void
    {
        $this->additionalConfig[$key] = $value;
    }

    /**
     * Get a specific additional config value.
     */
    public function getAdditionalConfigValue(string $key): mixed
    {
        return $this->additionalConfig[$key] ?? null;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Check if the entity has any configuration data.
     */
    public function hasConfiguration(): bool
    {
        return ! empty($this->requireFields)
               || $this->oauth2AuthResult !== null
               || ! empty($this->additionalConfig);
    }

    /**
     * Clear all configuration data.
     */
    public function clearConfiguration(): void
    {
        $this->requireFields = [];
        $this->oauth2AuthResult = null;
        $this->additionalConfig = [];
    }

    /**
     * Initialize entity for creation.
     */
    public function prepareForCreation(): void
    {
        $now = new DateTime();
        if (! isset($this->createdAt)) {
            $this->createdAt = $now;
        }
        if (! isset($this->updatedAt)) {
            $this->updatedAt = $now;
        }
    }

    /**
     * Convert entity to array representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'mcp_server_id' => $this->mcpServerId,
            'require_fields' => $this->getRequireFieldsAsArray(),
            'oauth2_auth_result' => $this->oauth2AuthResult?->toArray(),
            'additional_config' => $this->additionalConfig,
            'creator' => $this->creator,
            'created_at' => $this->createdAt->format('Y-m-d H:i:s'),
            'modifier' => $this->modifier,
            'updated_at' => $this->updatedAt->format('Y-m-d H:i:s'),
        ];
    }
}

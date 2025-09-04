<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowCacheEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $cacheHash;

    protected string $cachePrefix;

    protected string $cacheKey;

    protected string $scopeTag;

    protected string $cacheValue;

    protected int $ttlSeconds = 0;

    protected DateTime $expiresAt;

    protected string $organizationCode;

    protected string $creator = '';

    protected string $modifier = '';

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    public function shouldCreate(): bool
    {
        return $this->id === null;
    }

    public function refresh(string $newValue, ?int $newTtlSeconds = null): void
    {
        if ($newTtlSeconds !== null) {
            if ($newTtlSeconds < -1 || $newTtlSeconds > 4294967295) {
                ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.ttl.invalid_range', ['min' => -1, 'max' => 4294967295]);
            }
            $this->ttlSeconds = max(0, $newTtlSeconds);
        }

        $this->cacheValue = $newValue;

        $this->calculateExpiresAt();
        $this->updatedAt = new DateTime();

        $this->generateCacheHash();
    }

    public function prepareForCreation(): void
    {
        $this->validateFieldLengths();
        $this->generateCacheHash();
        $this->calculateExpiresAt();

        $this->ttlSeconds = max(0, $this->ttlSeconds);

        // Set timestamps
        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCacheHash(): string
    {
        return $this->cacheHash;
    }

    public function getCachePrefix(): string
    {
        return $this->cachePrefix;
    }

    public function getCacheKey(): string
    {
        return $this->cacheKey;
    }

    public function getScopeTag(): string
    {
        return $this->scopeTag;
    }

    public function getCacheValue(): string
    {
        return $this->cacheValue;
    }

    public function getTtlSeconds(): ?int
    {
        return $this->ttlSeconds;
    }

    public function getExpiresAt(): DateTime
    {
        return $this->expiresAt;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function isExpired(): bool
    {
        // Permanent cache (TTL = -1, 0, or null) never expires
        if ($this->isPermanent()) {
            return false;
        }

        return (new DateTime()) > $this->expiresAt;
    }

    public function setCacheHash(string $cacheHash): void
    {
        $this->cacheHash = $cacheHash;
    }

    public function setCachePrefix(string $cachePrefix): void
    {
        $this->cachePrefix = $cachePrefix;
    }

    public function setCacheKey(string $cacheKey): void
    {
        $this->cacheKey = $cacheKey;
    }

    public function setScopeTag(string $scopeTag): void
    {
        $this->scopeTag = $scopeTag;
    }

    public function setCacheValue(string $cacheValue): void
    {
        $this->cacheValue = $cacheValue;
    }

    public function setTtlSeconds(?int $ttlSeconds): void
    {
        $this->ttlSeconds = $ttlSeconds;
    }

    public function setExpiresAt(DateTime $expiresAt): void
    {
        $this->expiresAt = $expiresAt;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    /**
     * Check if this cache is permanent (never expires).
     * Permanent cache is indicated by TTL values: -1, 0, or null.
     */
    public function isPermanent(): bool
    {
        return $this->ttlSeconds === -1 || $this->ttlSeconds === 0;
    }

    private function calculateExpiresAt(): void
    {
        if ($this->isPermanent()) {
            $this->expiresAt = new DateTime('2038-01-01 00:00:00');
        } else {
            $this->expiresAt = new DateTime()->modify("+{$this->ttlSeconds} seconds");
        }
    }

    private function validateFieldLengths(): void
    {
        // Validate cache_prefix (VARCHAR 255)
        if (! empty($this->cachePrefix) && mb_strlen($this->cachePrefix) > 255) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.cache_prefix.too_long', ['max' => 255]);
        }

        // Validate cache_key (VARCHAR 255)
        if (! empty($this->cacheKey) && mb_strlen($this->cacheKey) > 255) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.cache_key.too_long', ['max' => 255]);
        }

        // Validate scope_tag (VARCHAR 10)
        if (! empty($this->scopeTag) && mb_strlen($this->scopeTag) > 10) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.scope_tag.too_long', ['max' => 10]);
        }

        // Validate organization_code (VARCHAR 64)
        if (! empty($this->organizationCode) && mb_strlen($this->organizationCode) > 64) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.organization_code.too_long', ['max' => 64]);
        }

        // Validate creator (VARCHAR 64)
        if (! empty($this->creator) && mb_strlen($this->creator) > 64) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.creator.too_long', ['max' => 64]);
        }

        // Validate modifier (VARCHAR 64)
        if (! empty($this->modifier) && mb_strlen($this->modifier) > 64) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.modifier.too_long', ['max' => 64]);
        }

        // Validate ttl_seconds (-1, 0 for permanent, 1-4294967295 for seconds)
        if ($this->ttlSeconds < -1 || $this->ttlSeconds > 4294967295) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.ttl.invalid_range', ['min' => -1, 'max' => 4294967295]);
        }

        // Validate required fields are not empty
        if (empty($this->cachePrefix)) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.cache_prefix.empty');
        }

        if (empty($this->cacheKey)) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.cache_key.empty');
        }

        if (empty($this->scopeTag)) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.scope_tag.empty');
        }

        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::CacheValidationFailed, 'flow.cache.organization_code.empty');
        }
    }

    private function generateCacheHash(): void
    {
        $this->cacheHash = md5($this->cachePrefix . '+' . $this->cacheKey);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity;

use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Infrastructure\Core\AbstractEntity;

class ProviderAssetEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected ?int $assetId = null;

    protected string $organizationCode = '';

    protected string $providerCode = '';

    protected string $projectName = '';

    protected string $providerAssetId = '';

    protected ?string $providerGroupId = null;

    protected ProviderAssetStatus $providerStatus = ProviderAssetStatus::UNVERIFIED;

    /** 本次结论的来源，决定前端文案与用量统计口径。 */
    protected ProviderReviewMode $providerReviewMode = ProviderReviewMode::VOLCENGINE;

    protected ?string $providerFailedReason = null;

    protected ?array $metadata = null;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getProviderStatus(): ProviderAssetStatus
    {
        return $this->providerStatus;
    }

    public function getProviderAssetId(): string
    {
        return $this->providerAssetId;
    }

    public function getProviderFailedReason(): ?string
    {
        return $this->providerFailedReason;
    }

    public function getProviderReviewMode(): ProviderReviewMode
    {
        return $this->providerReviewMode;
    }

    public function setProviderReviewMode(ProviderReviewMode|string $v): void
    {
        $this->providerReviewMode = is_string($v) ? ProviderReviewMode::fromValue($v) : $v;
    }

    public function setProviderFailedReason(?string $value): void
    {
        $this->providerFailedReason = $value;
    }

    public function getProviderGroupId(): ?string
    {
        return $this->providerGroupId;
    }

    public function setProviderGroupId(?string $v): void
    {
        $this->providerGroupId = $v;
    }

    public function getAssetId(): ?int
    {
        return $this->assetId;
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setAssetId(null|int|string $v): void
    {
        $this->assetId = $v === null ? null : (int) $v;
    }

    public function setOrganizationCode(string $v): void
    {
        $this->organizationCode = $v;
    }

    public function setProviderCode(string $v): void
    {
        $this->providerCode = $v;
    }

    public function setProjectName(string $v): void
    {
        $this->projectName = $v;
    }

    public function setMetadata(?array $v): void
    {
        $this->metadata = $v;
    }

    public function setId(null|int|string $v): void
    {
        $this->id = $v === null ? null : (int) $v;
    }

    public function setProviderAssetId(?string $v): void
    {
        $this->providerAssetId = (string) ($v ?? '');
    }

    public function setProviderStatus(ProviderAssetStatus|string $v): void
    {
        $this->providerStatus = is_string($v) ? ProviderAssetStatus::fromValue($v) : $v;
    }
}

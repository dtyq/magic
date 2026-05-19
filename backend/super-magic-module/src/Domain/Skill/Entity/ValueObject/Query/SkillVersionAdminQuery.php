<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

class SkillVersionAdminQuery extends AbstractQuery
{
    protected ?string $reviewStatus = null;

    protected ?string $publishStatus = null;

    /**
     * @var null|array<int, string>
     */
    protected ?array $publishTargetTypes = null;

    protected ?string $sourceType = null;

    protected ?string $version = null;

    protected ?string $packageName = null;

    protected ?string $skillName = null;

    protected ?string $organizationCode = null;

    protected ?string $startTime = null;

    protected ?string $endTime = null;

    protected string $orderBy = 'desc';

    /**
     * @var null|array<int, string>
     */
    protected ?array $excludeReviewStatuses = null;

    public function getReviewStatus(): ?string
    {
        return $this->reviewStatus;
    }

    public function setReviewStatus(?string $reviewStatus): void
    {
        $this->reviewStatus = $reviewStatus;
    }

    public function getPublishStatus(): ?string
    {
        return $this->publishStatus;
    }

    public function setPublishStatus(?string $publishStatus): void
    {
        $this->publishStatus = $publishStatus;
    }

    /**
     * @return null|array<int, string>
     */
    public function getPublishTargetTypes(): ?array
    {
        return $this->publishTargetTypes;
    }

    /**
     * @param null|array<int, string> $publishTargetTypes
     */
    public function setPublishTargetTypes(?array $publishTargetTypes): void
    {
        $this->publishTargetTypes = $publishTargetTypes;
    }

    public function getSourceType(): ?string
    {
        return $this->sourceType;
    }

    public function setSourceType(?string $sourceType): void
    {
        $this->sourceType = $sourceType;
    }

    public function getVersion(): ?string
    {
        return $this->version;
    }

    public function setVersion(?string $version): void
    {
        $this->version = $version;
    }

    public function getPackageName(): ?string
    {
        return $this->packageName;
    }

    public function setPackageName(?string $packageName): void
    {
        $this->packageName = $packageName;
    }

    public function getSkillName(): ?string
    {
        return $this->skillName;
    }

    public function setSkillName(?string $skillName): void
    {
        $this->skillName = $skillName;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getStartTime(): ?string
    {
        return $this->startTime;
    }

    public function setStartTime(?string $startTime): void
    {
        $this->startTime = $startTime;
    }

    public function getEndTime(): ?string
    {
        return $this->endTime;
    }

    public function setEndTime(?string $endTime): void
    {
        $this->endTime = $endTime;
    }

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function setOrderBy(string $orderBy): void
    {
        $this->orderBy = $orderBy;
    }

    /**
     * @return null|array<int, string>
     */
    public function getExcludeReviewStatuses(): ?array
    {
        return $this->excludeReviewStatuses;
    }

    /**
     * @param null|array<int, string> $excludeReviewStatuses
     */
    public function setExcludeReviewStatuses(?array $excludeReviewStatuses): void
    {
        $this->excludeReviewStatuses = $excludeReviewStatuses;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationStatus;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;

/**
 * 组织信息管理器.
 */
class BaseOrganizationInfoManager implements OrganizationInfoManagerInterface
{
    private ?int $organizationId = null;

    private string $organizationCode = '';

    private string $organizationName = '';

    private OrganizationType $organizationType = OrganizationType::Team;

    private OrganizationStatus $organizationStatus = OrganizationStatus::Normal;

    public function getOrganizationId(): ?int
    {
        return $this->organizationId;
    }

    public function setOrganizationId(?int $organizationId): void
    {
        $this->organizationId = $organizationId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getOrganizationName(): string
    {
        return $this->organizationName;
    }

    public function setOrganizationName(string $organizationName): void
    {
        $this->organizationName = $organizationName;
    }

    public function getOrganizationType(): OrganizationType
    {
        return $this->organizationType;
    }

    public function setOrganizationType(OrganizationType $organizationType): void
    {
        $this->organizationType = $organizationType;
    }

    public function getOrganizationStatus(): OrganizationStatus
    {
        return $this->organizationStatus;
    }

    public function setOrganizationStatus(OrganizationStatus $organizationStatus): void
    {
        $this->organizationStatus = $organizationStatus;
    }

    public function toArray(): array
    {
        return [
            'organization_id' => $this->organizationId,
            'organization_code' => $this->organizationCode,
            'organization_name' => $this->organizationName,
            'organization_type' => $this->organizationType->value,
            'organization_status' => $this->organizationStatus->value,
        ];
    }
}

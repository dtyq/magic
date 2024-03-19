<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Infrastructure\Core\AbstractDTO;

class DepartmentDetailDTO extends AbstractDTO
{
    public ?string $id = null;

    public ?string $departmentId = null;

    public ?string $parentDepartmentId = null;

    public ?string $name = null;

    public ?string $i18nName = null;

    public ?string $order = null;

    public ?string $leaderUserId = null;

    public ?string $organizationCode = null;

    public ?string $status = null;

    public ?string $path = null;

    public ?int $level = null;

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public ?string $deletedAt = null;

    public ?string $documentId = null;

    public ?int $employeeSum = null;

    /**
     * 数据库中没有此字段，偷懒写的。批量写入数据库时，toArray() 后需要手动 unset 掉。
     */
    public ?bool $hasChild = null;

    public function getHasChild(): ?bool
    {
        return $this->hasChild;
    }

    public function setHasChild(?bool $hasChild): void
    {
        $this->hasChild = $hasChild;
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): void
    {
        $this->id = $id;
    }

    public function getDepartmentId(): ?string
    {
        return $this->departmentId;
    }

    public function setDepartmentId(?string $departmentId): void
    {
        $this->departmentId = $departmentId;
    }

    public function getParentDepartmentId(): ?string
    {
        return $this->parentDepartmentId;
    }

    public function setParentDepartmentId(?string $parentDepartmentId): void
    {
        $this->parentDepartmentId = $parentDepartmentId;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getI18nName(): ?string
    {
        return $this->i18nName;
    }

    public function setI18nName(?string $i18nName): void
    {
        $this->i18nName = $i18nName;
    }

    public function getOrder(): ?string
    {
        return $this->order;
    }

    public function setOrder(?string $order): void
    {
        $this->order = $order;
    }

    public function getLeaderUserId(): ?string
    {
        return $this->leaderUserId;
    }

    public function setLeaderUserId(?string $leaderUserId): void
    {
        $this->leaderUserId = $leaderUserId;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): void
    {
        $this->status = $status;
    }

    public function getPath(): ?string
    {
        return $this->path;
    }

    public function setPath(?string $path): void
    {
        $this->path = $path;
    }

    public function getLevel(): ?int
    {
        return $this->level;
    }

    public function setLevel(?int $level): void
    {
        $this->level = $level;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getDocumentId(): ?string
    {
        return $this->documentId;
    }

    public function setDocumentId(?string $documentId): void
    {
        $this->documentId = $documentId;
    }

    public function getEmployeeSum(): ?int
    {
        return $this->employeeSum;
    }

    public function setEmployeeSum(?int $employeeSum): void
    {
        $this->employeeSum = $employeeSum;
    }
}

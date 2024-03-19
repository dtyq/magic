<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use App\Domain\Contact\Entity\ValueObject\DepartmentOption;

class MagicDepartmentEntity extends AbstractEntity
{
    protected ?string $id = null;

    protected ?string $departmentId = null;

    protected ?string $parentDepartmentId = null;

    protected ?string $name = null;

    protected ?string $i18nName = null;

    protected ?string $order = null;

    protected ?string $leaderUserId = null;

    protected ?string $organizationCode = null;

    protected ?string $status = null;

    protected ?string $path = null;

    protected ?int $level = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    protected ?string $documentId = null;

    protected ?int $employeeSum = null;

    /**
     * 数据库中没有此字段，偷懒写的。批量写入数据库时，toArray() 后需要手动 unset 掉。
     */
    protected ?bool $hasChild = null;

    protected ?DepartmentOption $option = null;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getOption(): ?DepartmentOption
    {
        return $this->option;
    }

    public function setOption(null|DepartmentOption|int $option): MagicDepartmentEntity
    {
        if (is_int($option)) {
            $option = DepartmentOption::tryFrom($option);
        }
        $this->option = $option;
        return $this;
    }

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

    public function setId(null|int|string $id): void
    {
        if (is_int($id)) {
            $id = (string) $id;
        }
        $this->id = $id;
    }

    public function getDepartmentId(): ?string
    {
        return $this->departmentId;
    }

    public function setDepartmentId(null|int|string $departmentId): void
    {
        if (is_int($departmentId)) {
            $departmentId = (string) $departmentId;
        }
        $this->departmentId = $departmentId;
    }

    public function getParentDepartmentId(): ?string
    {
        return $this->parentDepartmentId;
    }

    public function setParentDepartmentId(null|int|string $parentDepartmentId): void
    {
        if (is_int($parentDepartmentId)) {
            $parentDepartmentId = (string) $parentDepartmentId;
        }
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

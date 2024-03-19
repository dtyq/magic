<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\DTO;

use App\Domain\Contact\Entity\AbstractEntity;
use App\Domain\Contact\Entity\ValueObject\DepartmentSumType;

class DepartmentQueryDTO extends AbstractEntity
{
    protected string $query = '';

    protected array $userIds = [];

    protected string $departmentId = '';

    protected array $departmentIds = [];

    /**
     * 下一页的token, 用于分页. 暂时值为mysql的offset,后续可能为es的scroll_id,或者自行实现快照机制.
     */
    protected string $pageToken = '';

    // is_recursive 是否递归查询
    protected bool $isRecursive = false;

    // 部门成员求和类型
    protected DepartmentSumType $sumType = DepartmentSumType::DirectEmployee;

    protected int $pageSize = 100;

    public function getDepartmentIds(): array
    {
        return $this->departmentIds;
    }

    public function setDepartmentIds(array $departmentIds): self
    {
        $this->departmentIds = $departmentIds;
        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): void
    {
        $this->pageSize = $pageSize;
    }

    public function getSumType(): DepartmentSumType
    {
        return $this->sumType;
    }

    public function setSumType(DepartmentSumType $sumType): void
    {
        $this->sumType = $sumType;
    }

    public function getQuery(): string
    {
        return $this->query;
    }

    public function setQuery(string $query): void
    {
        $this->query = $query;
    }

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }

    public function getPageToken(): string
    {
        return $this->pageToken;
    }

    public function setPageToken(string $pageToken): void
    {
        $this->pageToken = $pageToken;
    }

    public function getDepartmentId(): string
    {
        return $this->departmentId;
    }

    public function setDepartmentId(string $departmentId): void
    {
        $this->departmentId = $departmentId;
    }

    public function isRecursive(): bool
    {
        return $this->isRecursive;
    }

    public function setIsRecursive(bool $isRecursive): void
    {
        $this->isRecursive = $isRecursive;
    }
}

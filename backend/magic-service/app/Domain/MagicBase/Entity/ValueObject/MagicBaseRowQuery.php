<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MagicBase\Entity\ValueObject;

readonly class MagicBaseRowQuery
{
    /**
     * @param list<array{field?: string, order?: 'asc'|'desc'|string}> $sorts
     * @param list<string> $actorDepartmentIds
     * @param list<int> $staticReadableRecordIds
     * @param array<string, string> $fieldTypes data type keyed by dynamic column_key
     * @param list<string> $columnReadScopes scopes required by filtered, sorted or relation key columns
     */
    public function __construct(
        private string $dataOrganizationCode,
        private int $projectId,
        private int $tableId,
        private MagicBaseFilterGroup $filter,
        private array $sorts,
        private int $page,
        private int $pageSize,
        private bool $includeDeleted,
        private bool $manager,
        private string $rowReadScope,
        private string $actorUserId,
        private string $actorOrganizationCode,
        private array $actorDepartmentIds,
        private array $staticReadableRecordIds,
        private array $fieldTypes,
        private bool $includeTotal,
        private array $columnReadScopes = [],
    ) {
    }

    public function getDataOrganizationCode(): string
    {
        return $this->dataOrganizationCode;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getTableId(): int
    {
        return $this->tableId;
    }

    public function getFilter(): MagicBaseFilterGroup
    {
        return $this->filter;
    }

    /**
     * @return list<array{field?: string, order?: 'asc'|'desc'|string}>
     */
    public function getSorts(): array
    {
        return $this->sorts;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function includeDeleted(): bool
    {
        return $this->includeDeleted;
    }

    public function isManager(): bool
    {
        return $this->manager;
    }

    public function getRowReadScope(): string
    {
        return $this->rowReadScope;
    }

    public function getActorUserId(): string
    {
        return $this->actorUserId;
    }

    public function getActorOrganizationCode(): string
    {
        return $this->actorOrganizationCode;
    }

    /**
     * @return list<string>
     */
    public function getActorDepartmentIds(): array
    {
        return $this->actorDepartmentIds;
    }

    /**
     * @return list<int>
     */
    public function getStaticReadableRecordIds(): array
    {
        return $this->staticReadableRecordIds;
    }

    /**
     * @return array<string, string>
     */
    public function getFieldTypes(): array
    {
        return $this->fieldTypes;
    }

    public function includeTotal(): bool
    {
        return $this->includeTotal;
    }

    /** @return list<string> */
    public function getColumnReadScopes(): array
    {
        return $this->columnReadScopes;
    }
}

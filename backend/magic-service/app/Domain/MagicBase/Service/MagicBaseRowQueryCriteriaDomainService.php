<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MagicBase\Service;

use App\Domain\MagicBase\Entity\MagicBaseColumnEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseFilterCondition;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseFilterGroup;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseRowQuery;
use App\Domain\MagicBase\Exception\MagicBaseColumnAccessDeniedException;
use App\Domain\MagicBase\Exception\MagicBaseInvalidFilterException;

readonly class MagicBaseRowQueryCriteriaDomainService
{
    public function __construct(
        private MagicBaseRowFilterDomainService $rowFilterDomainService,
    ) {
    }

    /**
     * @param array<string, mixed> $filters public query DSL or legacy field-keyed filter
     * @param list<array{field?: string, order?: 'asc'|'desc'|string}> $sorts
     * @param list<int> $staticReadableRecordIds record ids readable through static row permissions
     * @param list<string> $unboundedInFields relation fields resolved by the trusted application layer
     * @param list<string> $requiredReadableFields fields read internally when resolving relations
     */
    public function buildReadableQuery(
        string $dataOrganizationCode,
        MagicBaseTableEntity $table,
        MagicBaseAccessContext $access,
        ActorContext $actor,
        array $filters,
        array $sorts,
        int $page,
        int $pageSize,
        bool $includeDeleted = false,
        array $staticReadableRecordIds = [],
        bool $includeTotal = true,
        array $unboundedInFields = [],
        array $requiredReadableFields = [],
    ): MagicBaseRowQuery {
        $fieldTypes = $this->getFieldTypes($access);
        $filter = $this->rowFilterDomainService->parse($filters, $fieldTypes, $unboundedInFields);
        $fields = array_merge($this->getFilterFields($filter), array_column($sorts, 'field'), $requiredReadableFields);
        $columnReadScopes = $this->getColumnReadScopes($access, $actor, $fields);
        return new MagicBaseRowQuery(
            $dataOrganizationCode,
            (int) $table->getProjectId(),
            (int) $table->getId(),
            $filter,
            $sorts,
            max(1, $page),
            max(1, $pageSize),
            $includeDeleted,
            $access->isManager(),
            $this->getRowReadScope($table),
            $actor->getUserId(),
            $actor->getOrganizationCode(),
            $actor->getDepartmentIds(),
            $staticReadableRecordIds,
            $fieldTypes,
            $includeTotal,
            $columnReadScopes,
        );
    }

    private function getRowReadScope(MagicBaseTableEntity $table): string
    {
        return $table->getDynamicPermissions()->getRow()->getReadScope();
    }

    /**
     * @return array<string, string>
     */
    private function getFieldTypes(MagicBaseAccessContext $access): array
    {
        $fieldTypes = [];
        foreach ($access->getColumns()->all() as $columnKey => $column) {
            if (
                ! $column instanceof MagicBaseColumnEntity
                || ! is_string($columnKey)
                || $column->getStatus() === MagicBaseConst::STATUS_DISABLED
            ) {
                continue;
            }
            $fieldTypes[$columnKey] = $column->getDataType();
        }

        return $fieldTypes;
    }

    /** @return list<string> */
    private function getFilterFields(MagicBaseFilterGroup $filter): array
    {
        $fields = [];
        foreach ($filter->getItems() as $item) {
            if ($item instanceof MagicBaseFilterCondition) {
                $fields[] = $item->getField();
            } elseif ($item instanceof MagicBaseFilterGroup) {
                array_push($fields, ...$this->getFilterFields($item));
            }
        }
        return $fields;
    }

    /** @param list<string> $fields @return list<string> */
    private function getColumnReadScopes(MagicBaseAccessContext $access, ActorContext $actor, array $fields): array
    {
        $scopes = [];
        $permissions = new MagicBasePermissionDomainService();
        foreach (array_unique($fields) as $field) {
            if (in_array($field, ['id', 'record_id', 'organization_code', 'created_at', 'updated_at', 'created_by'], true)) {
                continue;
            }
            $column = $access->getColumns()->get($field);
            if ($column === null || $column->getStatus() === MagicBaseConst::STATUS_DISABLED) {
                throw new MagicBaseInvalidFilterException('查询字段不存在或当前用户无读取权限');
            }
            // Public scopes, explicit grants and managers do not need a per-row restriction.
            if ($permissions->canReadColumn($actor, new MagicBaseRowEntity(), $column, $access->getColumnPermissions((int) $column->getId()), $access->isManager())) {
                continue;
            }
            $scope = $column->getDynamicPermission()->getReadScope();
            $canMatch = match ($scope) {
                MagicBaseConst::SCOPE_PRIVATE_USER => $actor->getUserId() !== '',
                MagicBaseConst::SCOPE_PRIVATE_ORG => $actor->getOrganizationCode() !== '',
                MagicBaseConst::SCOPE_PRIVATE_DEPARTMENT => $actor->getDepartmentIds() !== [],
                default => false,
            };
            if (! $canMatch) {
                throw new MagicBaseColumnAccessDeniedException();
            }
            // Filter, sort, pagination and total must all operate on readable values only.
            $scopes[] = $scope;
        }
        return array_values(array_unique($scopes));
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MagicBase\Support;

use App\Application\MagicBase\DTO\MagicBaseResolvedFilter;
use App\Domain\MagicBase\Entity\MagicBaseRelationEntity;
use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\MagicBaseTableEntity;
use App\Domain\MagicBase\Entity\ValueObject\ActorContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseFormattedRow;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseTableAccessContext;
use App\Domain\MagicBase\Entity\ValueObject\SelectQuery;
use App\Domain\MagicBase\Exception\MagicBaseExceptionBuilder;
use App\Domain\MagicBase\Exception\MagicBaseInvalidFilterException;
use App\Domain\MagicBase\Exception\MagicBaseUnsupportedQueryException;
use App\Domain\MagicBase\Service\MagicBaseMetadataDomainService;
use App\Domain\MagicBase\Service\MagicBasePermissionDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowQueryCriteriaDomainService;
use App\Domain\MagicBase\Service\MagicBaseRowStorageResolverDomainService;
use App\ErrorCode\MagicBaseErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTimeInterface;
use LogicException;

readonly class MagicBaseRowQuerySupport
{
    private const DEFAULT_SYSTEM_FIELDS = [
        'id',
        'record_id',
        'organization_code',
        'created_at',
        'updated_at',
        'created_by',
    ];

    public function __construct(
        private MagicBaseMetadataDomainService $metadataDomainService,
        private MagicBaseAccessControl $accessControl,
        private MagicBaseRowStorageResolverDomainService $rowStorageResolver,
        private MagicBaseRowQueryCriteriaDomainService $rowQueryCriteriaDomainService,
        private MagicBasePermissionDomainService $permissionDomainService,
    ) {
    }

    /** Writing a row does not grant permission to read its contents or relations. */
    public function formatWrittenRow(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseTableEntity $table,
        MagicBaseRowEntity $row,
        MagicBaseAccessContext $access,
        SelectQuery $select,
        ActorContext $actor,
    ): MagicBaseFormattedRow {
        if (! $this->permissionDomainService->canReadTable($actor, $table, $access->getTablePermissions(), $access->isManager())
            || ! $this->permissionDomainService->canReadRow($actor, $row, $table, $access->getRowPermissions((int) $row->getRecordId()), $access->isManager())) {
            return new MagicBaseFormattedRow(['id' => (string) $row->getRecordId()]);
        }
        return $this->formatRow($authorization, $projectId, $table, $row, $access, $select, $actor, true);
    }

    public function formatRow(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseTableEntity $table,
        MagicBaseRowEntity $row,
        MagicBaseAccessContext $access,
        SelectQuery $select,
        ActorContext $actor,
        bool $omitDeniedRelations = false,
    ): MagicBaseFormattedRow {
        $fields = $select->getFields();
        if ($fields === []) {
            $fields = array_merge(self::DEFAULT_SYSTEM_FIELDS, $access->getColumns()->keys());
        }

        $result = [];
        foreach ($fields as $field) {
            if (! is_string($field)) {
                continue;
            }
            if (in_array($field, self::DEFAULT_SYSTEM_FIELDS, true)) {
                $result[$field] = $this->formatRootField($row, $field);
                continue;
            }
            $column = $access->getColumns()->get($field);
            // Apply the same column scopes and explicit grants to selected and default fields.
            if ($column === null || ! $this->permissionDomainService->canReadColumn(
                $actor,
                $row,
                $column,
                $access->getColumnPermissions((int) $column->getId()),
                $access->isManager(),
            )) {
                continue;
            }

            $result[$field] = $row->getData()[$field] ?? null;
        }

        foreach (array_keys($select->getRelations()) as $alias) {
            if (! is_string($alias)) {
                continue;
            }
            $relation = $this->findRelation(
                $authorization,
                $projectId,
                (int) $table->getId(),
                $alias,
                $select->getRelationSourceColumn($alias)
            );
            try {
                $related = $this->resolveRelationRows(
                    $authorization,
                    $projectId,
                    $relation,
                    $row,
                    $actor,
                    $access,
                    $select->getRelationFields($alias)
                );
            } catch (BusinessException $exception) {
                if (! $omitDeniedRelations || $exception->getCode() !== MagicBaseErrorCode::AccessDenied->value) {
                    throw $exception;
                }
                // 写入已经成功，不因响应中的关联不可读而把成功操作报告为失败。
                continue;
            }

            $result[$alias] = match ($relation->getRelationType()) {
                MagicBaseConst::RELATION_HAS_MANY => array_map(static fn (MagicBaseFormattedRow $row): array => $row->toArray(), $related),
                default => ($related[0] ?? null)?->toArray(),
            };
        }

        return new MagicBaseFormattedRow($result);
    }

    /**
     * @param list<MagicBaseRowEntity> $rows
     * @return list<MagicBaseFormattedRow>
     */
    public function formatRows(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseTableEntity $table,
        array $rows,
        MagicBaseAccessContext $access,
        SelectQuery $select,
        ActorContext $actor,
    ): array {
        $baseSelect = $select->withoutRelations();
        $formattedRows = [];
        foreach ($rows as $row) {
            $formattedRows[(int) $row->getRecordId()] = $this->formatRow($authorization, $projectId, $table, $row, $access, $baseSelect, $actor)->toArray();
        }

        foreach (array_keys($select->getRelations()) as $alias) {
            if (! is_string($alias)) {
                continue;
            }
            $relation = $this->findRelation($authorization, $projectId, (int) $table->getId(), $alias, $select->getRelationSourceColumn($alias));
            $relatedRowsByRecord = $this->resolveRelationRowsForPage(
                $authorization,
                $projectId,
                $relation,
                $rows,
                $actor,
                $access,
                $select->getRelationFields($alias)
            );
            foreach ($rows as $row) {
                $recordId = (int) $row->getRecordId();
                $relatedRows = $relatedRowsByRecord[$recordId] ?? [];
                $formattedRows[$recordId][$alias] = match ($relation->getRelationType()) {
                    MagicBaseConst::RELATION_HAS_MANY => array_map(static fn (MagicBaseFormattedRow $relatedRow): array => $relatedRow->toArray(), $relatedRows),
                    default => ($relatedRows[0] ?? null)?->toArray(),
                };
            }
        }

        return array_map(static fn (array $payload): MagicBaseFormattedRow => new MagicBaseFormattedRow($payload), array_values($formattedRows));
    }

    /**
     * @param array<string, mixed> $filters
     */
    public function resolveFiltersForRowStorage(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseTableEntity $table,
        MagicBaseAccessContext $access,
        ActorContext $actor,
        array $filters,
    ): MagicBaseResolvedFilter {
        unset($access);
        if ($this->isFilterGroupPayload($filters)) {
            return new MagicBaseResolvedFilter($filters);
        }

        $resolved = [];
        $unboundedInFields = [];
        foreach ($filters as $field => $condition) {
            if (! is_string($field) || ! is_array($condition)) {
                continue;
            }
            if (! str_contains($field, '.')) {
                $resolved[$field] = $condition;
                unset($unboundedInFields[$field]);
                continue;
            }

            [$relationName, $relationField] = explode('.', $field, 2);
            $relation = $this->findRelation($authorization, $projectId, (int) $table->getId(), $relationName);
            $sourceValues = $this->resolveRelationFilterValues($authorization, $projectId, $relation, $relationField, $condition, $actor);
            $resolved[$relation->getSourceColumnKey()] = [
                'in' => $sourceValues,
            ];
            $unboundedInFields[$relation->getSourceColumnKey()] = true;
        }

        return new MagicBaseResolvedFilter($resolved, array_keys($unboundedInFields));
    }

    /**
     * @param list<array{field?: string, order?: 'asc'|'desc'|string}> $sorts
     */
    public function assertSortableByRowStorage(array $sorts): void
    {
        foreach ($sorts as $sort) {
            $field = (string) ($sort['field'] ?? '');
            if ($field === '' || ! str_contains($field, '.')) {
                continue;
            }
            $suggestion = 'denormalize relation field into source table, for example customer_name, then sort by customer_name';
            $message = sprintf(
                '暂不支持关联字段排序: %s。原因: 当前行存储查询只在主表执行，无法直接按关联表字段排序。建议: 在主表冗余 customer_name 字段，并改用 customer_name 排序。',
                $field
            );
            throw new MagicBaseUnsupportedQueryException($message, [
                'field' => $field,
                'reason' => 'relation_sort_not_supported',
                'suggestion' => $suggestion,
            ]);
        }
    }

    public function readFieldValue(MagicBaseRowEntity $row, string $field): mixed
    {
        return match ($field) {
            'id', 'record_id' => (string) $row->getRecordId(),
            'organization_code' => $row->getOrganizationCode(),
            'created_at' => $this->formatDatetime($row->getCreatedAt()),
            'updated_at' => $this->formatDatetime($row->getUpdatedAt()),
            'created_by' => $row->getCreatedBy(),
            default => $row->getData()[$field] ?? null,
        };
    }

    public function getRowOrFail(MagicUserAuthorization $authorization, int $projectId, int $tableId, int $recordId): MagicBaseRowEntity
    {
        $row = $this->rowStorageResolver->getRow($authorization->getOrganizationCode(), $projectId, $tableId, $recordId);
        if ($row === null || $row->getDeleted()) {
            $this->notFound('记录');
        }
        return $row;
    }

    /**
     * @param array<string, mixed> $filter
     */
    private function isFilterGroupPayload(array $filter): bool
    {
        return is_string($filter['logic'] ?? null);
    }

    /**
     * @param list<MagicBaseRowEntity> $rows
     * @param list<string> $selectedFields
     * @return array<int, list<MagicBaseFormattedRow>>
     */
    private function resolveRelationRowsForPage(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseRelationEntity $relation,
        array $rows,
        ActorContext $actor,
        MagicBaseAccessContext $sourceAccess,
        array $selectedFields,
    ): array {
        $sourceValuesByRecord = [];
        $sourceValues = [];
        foreach ($rows as $row) {
            if (! $this->canReadRelationSource($sourceAccess, $actor, $row, $relation)) {
                continue;
            }
            $sourceValue = $this->readFieldValue($row, $relation->getSourceColumnKey());
            if ($sourceValue === null || $sourceValue === '') {
                continue;
            }
            $sourceValuesByRecord[(int) $row->getRecordId()] = $sourceValue;
            $sourceValues[] = $sourceValue;
        }
        $sourceValues = array_values(array_unique($sourceValues, SORT_REGULAR));
        if ($sourceValues === []) {
            return [];
        }

        $targetContext = $this->loadTargetContext($authorization, $projectId, (int) $relation->getTargetTableId());
        $query = $this->rowQueryCriteriaDomainService->buildReadableQuery(
            $authorization->getOrganizationCode(),
            $targetContext->getTable(),
            $targetContext->getAccess(),
            $targetContext->getActor(),
            [$relation->getTargetColumnKey() => ['in' => $sourceValues]],
            [],
            1,
            MagicBaseConst::ROW_STORAGE_SEARCH_SIZE,
            false,
            $this->accessControl->getStaticReadableRecordIds($targetContext),
        );
        $targetRows = $this->rowStorageResolver->queryRows($query)->getRows()->all();
        $targetRowsByValue = [];
        foreach ($targetRows as $targetRow) {
            if (! $targetRow instanceof MagicBaseRowEntity) {
                continue;
            }
            $targetValue = $this->readFieldValue($targetRow, $relation->getTargetColumnKey());
            if ($targetValue === null || $targetValue === '') {
                continue;
            }
            $targetRowsByValue[$this->normalizeRelationValueKey($targetValue)][] = $this->formatRow(
                $authorization,
                $projectId,
                $targetContext->getTable(),
                $targetRow,
                $targetContext->getAccess(),
                new SelectQuery(['fields' => $selectedFields, 'relations' => []]),
                $targetContext->getActor(),
            );
        }

        $matched = [];
        foreach ($sourceValuesByRecord as $recordId => $sourceValue) {
            $matched[$recordId] = $targetRowsByValue[$this->normalizeRelationValueKey($sourceValue)] ?? [];
        }

        return $matched;
    }

    /**
     * @param list<string> $selectedFields
     * @return list<MagicBaseFormattedRow>
     */
    private function resolveRelationRows(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseRelationEntity $relation,
        MagicBaseRowEntity $row,
        ActorContext $actor,
        MagicBaseAccessContext $sourceAccess,
        array $selectedFields,
    ): array {
        if (! $this->canReadRelationSource($sourceAccess, $actor, $row, $relation)) {
            return [];
        }
        $sourceValue = $this->readFieldValue($row, $relation->getSourceColumnKey());
        if ($sourceValue === null || $sourceValue === '') {
            return [];
        }

        $targetContext = $this->loadTargetContext($authorization, $projectId, (int) $relation->getTargetTableId());
        $query = $this->rowQueryCriteriaDomainService->buildReadableQuery(
            $authorization->getOrganizationCode(),
            $targetContext->getTable(),
            $targetContext->getAccess(),
            $targetContext->getActor(),
            [$relation->getTargetColumnKey() => ['eq' => $sourceValue]],
            [],
            1,
            MagicBaseConst::ROW_STORAGE_SEARCH_SIZE,
            false,
            $this->accessControl->getStaticReadableRecordIds($targetContext),
        );

        $matched = [];
        foreach ($this->rowStorageResolver->queryRows($query)->getRows() as $targetRow) {
            if (! $targetRow instanceof MagicBaseRowEntity) {
                continue;
            }
            $matched[] = $this->formatRow(
                $authorization,
                $projectId,
                $targetContext->getTable(),
                $targetRow,
                $targetContext->getAccess(),
                new SelectQuery(['fields' => $selectedFields, 'relations' => []]),
                $targetContext->getActor(),
            );
        }

        return $matched;
    }

    /**
     * @param array<string, mixed> $condition
     * @return list<mixed>
     */
    private function resolveRelationFilterValues(
        MagicUserAuthorization $authorization,
        int $projectId,
        MagicBaseRelationEntity $relation,
        string $relationField,
        array $condition,
        ActorContext $actor,
    ): array {
        unset($actor);
        if (! array_key_exists('eq', $condition)) {
            throw new MagicBaseInvalidFilterException('关联字段筛选暂时只支持 eq', [
                'field' => $relationField,
                'reason' => 'relation_operator_not_supported',
            ]);
        }

        $targetContext = $this->loadTargetContext($authorization, $projectId, (int) $relation->getTargetTableId());
        $query = $this->rowQueryCriteriaDomainService->buildReadableQuery(
            $authorization->getOrganizationCode(),
            $targetContext->getTable(),
            $targetContext->getAccess(),
            $targetContext->getActor(),
            [$relationField => ['eq' => $condition['eq']]],
            [],
            1,
            MagicBaseConst::ROW_STORAGE_SEARCH_SIZE,
            false,
            $this->accessControl->getStaticReadableRecordIds($targetContext),
            requiredReadableFields: [$relation->getTargetColumnKey()],
        );

        $values = [];
        foreach ($this->rowStorageResolver->queryRows($query)->getRows() as $targetRow) {
            if (! $targetRow instanceof MagicBaseRowEntity) {
                continue;
            }
            $targetValue = $this->readFieldValue($targetRow, $relation->getTargetColumnKey());
            if ($targetValue === null || $targetValue === '') {
                continue;
            }
            $values[] = $targetValue;
        }

        return array_values(array_unique($values, SORT_REGULAR));
    }

    private function canReadRelationSource(
        MagicBaseAccessContext $access,
        ActorContext $actor,
        MagicBaseRowEntity $row,
        MagicBaseRelationEntity $relation,
    ): bool {
        $field = $relation->getSourceColumnKey();
        if (in_array($field, self::DEFAULT_SYSTEM_FIELDS, true)) {
            return true;
        }
        $column = $access->getColumns()->get($field);
        return $column !== null && $column->getStatus() !== MagicBaseConst::STATUS_DISABLED
            && $this->permissionDomainService->canReadColumn(
                $actor,
                $row,
                $column,
                $access->getColumnPermissions((int) $column->getId()),
                $access->isManager(),
            );
    }

    private function loadTargetContext(MagicUserAuthorization $authorization, int $projectId, int $tableId): MagicBaseTableAccessContext
    {
        return $this->accessControl->requireReadableTable($authorization, $projectId, $tableId);
    }

    private function normalizeRelationValueKey(mixed $value): string
    {
        return is_scalar($value) || $value === null ? (string) $value : md5(json_encode($value) ?: '');
    }

    private function findRelation(
        MagicUserAuthorization $authorization,
        int $projectId,
        int $sourceTableId,
        string $relationName,
        ?string $sourceColumn = null,
    ): MagicBaseRelationEntity {
        foreach ($this->metadataDomainService->listRelations($authorization->getOrganizationCode(), $projectId) as $relation) {
            if (! $relation instanceof MagicBaseRelationEntity || (int) $relation->getSourceTableId() !== $sourceTableId) {
                continue;
            }
            $nameMatched = $relation->getRelationName() === $relationName;
            $columnMatched = $sourceColumn === null || $sourceColumn === '' || $relation->getSourceColumnKey() === $sourceColumn;
            if ($nameMatched && $columnMatched) {
                return $relation;
            }
        }

        $this->notFound('关系');
        throw new LogicException('Unreachable');
    }

    private function formatRootField(MagicBaseRowEntity $row, string $field): mixed
    {
        return match ($field) {
            'id', 'record_id' => (string) $row->getRecordId(),
            'organization_code' => $row->getOrganizationCode(),
            'created_at' => $this->formatDatetime($row->getCreatedAt()),
            'updated_at' => $this->formatDatetime($row->getUpdatedAt()),
            'created_by' => $row->getCreatedBy(),
            default => null,
        };
    }

    private function formatDatetime(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d H:i:s');
        }
        return is_string($value) ? $value : null;
    }

    private function notFound(string $label): void
    {
        MagicBaseExceptionBuilder::resourceNotFound($label);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MagicBase\Repository\Persistence\Storage\MongoDB;

use App\Domain\MagicBase\Entity\MagicBaseRowEntity;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseConst;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseEntityCollection;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseRowQuery;
use App\Domain\MagicBase\Entity\ValueObject\MagicBaseRowQueryResult;
use App\Domain\MagicBase\Exception\MagicBaseExceptionBuilder;
use App\Domain\MagicBase\Repository\Facade\MagicBaseRowQueryRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use LogicException;
use MongoDB\Model\BSONArray;
use MongoDB\Model\BSONDocument;
use Throwable;

readonly class MagicBaseMongoRowQueryRepository implements MagicBaseRowQueryRepositoryInterface
{
    public function __construct(
        private MagicBaseMongoClient $client,
        private MagicBaseMongoCollectionRouter $router,
        private MagicBaseMongoQueryCompiler $queryCompiler,
    ) {
    }

    public function getRow(string $dataOrganizationCode, int $projectId, int $tableId, int $recordId): ?MagicBaseRowEntity
    {
        $route = $this->router->route($dataOrganizationCode, $projectId);
        try {
            $document = $this->client->collection($route->getMongoCollection())->findOne([
                'data_organization_code' => $dataOrganizationCode,
                'project_id' => $projectId,
                'table_id' => $tableId,
                'record_id' => $recordId,
            ], [
                'maxTimeMS' => $this->client->queryTimeoutMs(),
            ]);
        } catch (Throwable $exception) {
            $this->logQueryFailure('MongoDB row storage read failed.', $exception, [
                'collection' => $route->getMongoCollection(),
            ]);
            MagicBaseExceptionBuilder::storageUnavailable('MongoDB row storage read failed.');
            throw new LogicException('Unreachable');
        }

        return $document === null ? null : new MagicBaseRowEntity($this->fromDocument($document));
    }

    public function queryRows(MagicBaseRowQuery $query): MagicBaseRowQueryResult
    {
        $route = $this->router->route($query->getDataOrganizationCode(), $query->getProjectId());
        $filter = $this->buildFilter($query);
        $options = [
            'sort' => $this->buildSort($query),
            'skip' => ($query->getPage() - 1) * $query->getPageSize(),
            'limit' => $query->getPageSize() + ($query->includeTotal() ? 0 : 1),
            'maxTimeMS' => $this->client->queryTimeoutMs(),
        ];

        try {
            $collection = $this->client->collection($route->getMongoCollection());
            $total = $query->includeTotal()
                ? $collection->countDocuments($filter, ['maxTimeMS' => $this->client->queryTimeoutMs()])
                : 0;
            $cursor = $collection->find($filter, $options);
        } catch (Throwable $exception) {
            $this->logQueryFailure('MongoDB row storage query failed.', $exception, [
                'collection' => $route->getMongoCollection(),
            ]);
            MagicBaseExceptionBuilder::storageUnavailable('MongoDB row storage query failed.');
            throw new LogicException('Unreachable');
        }

        $entities = [];
        foreach ($cursor as $document) {
            $entities[] = new MagicBaseRowEntity($this->fromDocument($document));
        }

        $hasMore = $query->includeTotal()
            ? (($query->getPage() - 1) * $query->getPageSize()) + count($entities) < $total
            : count($entities) > $query->getPageSize();
        if (! $query->includeTotal() && $hasMore) {
            array_pop($entities);
        }

        return new MagicBaseRowQueryResult(new MagicBaseEntityCollection($entities), (int) $total, $hasMore);
    }

    public function listRows(string $dataOrganizationCode, int $projectId, int $tableId, bool $includeDeleted = false): MagicBaseEntityCollection
    {
        $route = $this->router->route($dataOrganizationCode, $projectId);
        $filter = [
            'data_organization_code' => $dataOrganizationCode,
            'project_id' => $projectId,
            'table_id' => $tableId,
        ];
        if (! $includeDeleted) {
            $filter['deleted'] = false;
        }

        try {
            $cursor = $this->client->collection($route->getMongoCollection())->find($filter, [
                'sort' => ['record_id' => 1],
                'limit' => MagicBaseConst::ROW_STORAGE_SEARCH_SIZE,
                'maxTimeMS' => $this->client->queryTimeoutMs(),
            ]);
        } catch (Throwable $exception) {
            $this->logQueryFailure('MongoDB row storage list failed.', $exception, [
                'collection' => $route->getMongoCollection(),
            ]);
            MagicBaseExceptionBuilder::storageUnavailable('MongoDB row storage list failed.');
            throw new LogicException('Unreachable');
        }

        $entities = [];
        foreach ($cursor as $document) {
            $entities[] = new MagicBaseRowEntity($this->fromDocument($document));
        }

        return new MagicBaseEntityCollection($entities);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildFilter(MagicBaseRowQuery $query): array
    {
        $filter = [
            'data_organization_code' => $query->getDataOrganizationCode(),
            'project_id' => $query->getProjectId(),
            'table_id' => $query->getTableId(),
        ];
        if (! $query->includeDeleted()) {
            $filter['deleted'] = false;
        }

        $permissionFilter = $this->buildPermissionFilter($query);
        if ($permissionFilter !== null) {
            $filter = ['$and' => [$filter, $permissionFilter]];
        }

        foreach ($query->getColumnReadScopes() as $scope) {
            $columnFilter = $this->buildDynamicScopeFilter($query, $scope);
            if ($columnFilter !== []) {
                $filter = ['$and' => [$filter, $columnFilter ?? ['record_id' => ['$in' => []]]]];
            }
        }

        $fieldFilter = $this->queryCompiler->compileFilter($query->getFilter());
        if ($fieldFilter !== []) {
            $filter = ['$and' => [$filter, $fieldFilter]];
        }

        return $filter;
    }

    /**
     * @return null|array<string, mixed>
     */
    private function buildPermissionFilter(MagicBaseRowQuery $query): ?array
    {
        if ($query->isManager()) {
            return null;
        }

        $or = [];
        $dynamicScope = $this->buildDynamicScopeFilter($query);
        if ($dynamicScope === []) {
            return null;
        }
        if ($dynamicScope !== null) {
            $or[] = $dynamicScope;
        }
        if ($query->getStaticReadableRecordIds() !== []) {
            $or[] = ['record_id' => ['$in' => $query->getStaticReadableRecordIds()]];
        }

        return $or === [] ? ['record_id' => ['$in' => []]] : ['$or' => $or];
    }

    /**
     * @return null|array<string, mixed>
     */
    private function buildDynamicScopeFilter(MagicBaseRowQuery $query, ?string $scope = null): ?array
    {
        return match ($scope ?? $query->getRowReadScope()) {
            MagicBaseConst::SCOPE_PUBLIC => [],
            MagicBaseConst::SCOPE_PRIVATE_USER => $query->getActorUserId() === ''
                ? ['record_id' => ['$in' => []]]
                : ['created_by' => $query->getActorUserId()],
            MagicBaseConst::SCOPE_PRIVATE_DEPARTMENT => $query->getActorDepartmentIds() === []
                ? ['record_id' => ['$in' => []]]
                : ['owner_department_ids' => ['$in' => $query->getActorDepartmentIds()]],
            MagicBaseConst::SCOPE_PRIVATE_ORG => $query->getActorOrganizationCode() === ''
                ? ['record_id' => ['$in' => []]]
                : ['organization_code' => $query->getActorOrganizationCode()],
            default => null,
        };
    }

    /**
     * @return array<string, int>
     */
    private function buildSort(MagicBaseRowQuery $query): array
    {
        $sort = [];
        foreach ($query->getSorts() as $item) {
            $field = (string) ($item['field'] ?? '');
            if ($field === '') {
                continue;
            }
            $sort[$this->queryCompiler->fieldPath($field)] = strtolower((string) ($item['order'] ?? 'asc')) === 'desc' ? -1 : 1;
        }

        $sort['record_id'] ??= 1;
        return $sort;
    }

    /**
     * @param array<string, mixed>|BSONDocument $document
     * @return array<string, mixed>
     */
    private function fromDocument(array|BSONDocument $document): array
    {
        $payload = $document instanceof BSONDocument ? $document->getArrayCopy() : $document;
        unset($payload['_id']);

        return $this->normalizeValue($payload);
    }

    private function normalizeValue(mixed $value): mixed
    {
        if ($value instanceof BSONDocument || $value instanceof BSONArray) {
            $value = $value->getArrayCopy();
        }
        if (! is_array($value)) {
            return $value;
        }

        $normalized = [];
        foreach ($value as $key => $item) {
            $normalized[$key] = $this->normalizeValue($item);
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $context
     */
    private function logQueryFailure(string $message, Throwable $exception, array $context = []): void
    {
        di(LoggerFactory::class)->get(static::class)->error($message, $context + [
            'exception' => $exception::class,
            'message' => $this->sanitizeExceptionMessage($exception->getMessage()),
        ]);
    }

    private function sanitizeExceptionMessage(string $message): string
    {
        return (string) preg_replace('/mongodb(\+srv)?:\/\/\S+/i', 'mongodb$1://[redacted]', $message);
    }
}

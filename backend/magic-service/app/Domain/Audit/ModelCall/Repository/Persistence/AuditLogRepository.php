<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence;

use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditLogRepositoryInterface;
use App\Domain\Audit\ModelCall\Repository\Persistence\Model\AuditLogModel;
use App\Domain\ModelGateway\Repository\Persistence\AbstractRepository;
use App\Infrastructure\Core\AbstractEntity;
use Hyperf\Database\Exception\QueryException;
use Hyperf\Database\Model\Builder;

class AuditLogRepository extends AbstractRepository implements AuditLogRepositoryInterface
{
    public function create(AuditLogEntity $entity): void
    {
        $model = new AuditLogModel();
        $model->fill($this->getAttributesForAuditPersist($entity));
        $model->save();
    }

    public function createOrUpdateAuditByEventId(AuditLogEntity $entity): void
    {
        $eventId = trim((string) ($entity->getEventId() ?? ''));
        if ($eventId === '') {
            $this->create($entity);

            return;
        }

        $values = $this->getAttributesForAuditPersist($entity);
        unset($values['id'], $values['points']);

        try {
            AuditLogModel::query()->updateOrCreate(
                ['event_id' => $eventId],
                $values
            );
        } catch (QueryException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                throw $e;
            }
            AuditLogModel::query()->updateOrCreate(
                ['event_id' => $eventId],
                $values
            );
        }
    }

    public function recordPointsByEventId(string $eventId, int $points): void
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            return;
        }

        try {
            AuditLogModel::query()->updateOrCreate(
                ['event_id' => $eventId],
                ['points' => $points]
            );
        } catch (QueryException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                throw $e;
            }
            AuditLogModel::query()->where('event_id', $eventId)->update(['points' => $points]);
        }
    }

    public function queries(
        int $pageSize,
        array $filters = [],
        string $currentOrganizationCode = '',
        bool $isOfficialOrganization = false,
        ?string $cursorId = null,
        string $direction = 'next'
    ): array {
        $builder = AuditLogModel::query();
        $organizationCode = $this->resolveOrganizationCodeFilter(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        if ($organizationCode !== null) {
            $builder->where('organization_code', $organizationCode);
        }

        if (! empty($filters['type'])) {
            $builder->where('type', (string) $filters['type']);
        } else {
            $builder->where('type', '!=', AuditType::EMBEDDING->value);
        }
        if (! empty($filters['status'])) {
            $builder->where('status', (string) $filters['status']);
        }
        if (! empty($filters['product_code'])) {
            $builder->where('product_code', (string) $filters['product_code']);
        }
        if (! empty($filters['model_version'])) {
            $builder->where('model_version', (string) $filters['model_version']);
        }
        if (! empty($filters['provider_name'])) {
            $builder->where('provider_name', (string) $filters['provider_name']);
        }
        if (! empty($filters['user_id'])) {
            $builder->where('user_id', (string) $filters['user_id']);
        }
        if (! empty($filters['access_scope'])) {
            $builder->where('access_scope', (string) $filters['access_scope']);
        }
        if (! empty($filters['magic_topic_id'])) {
            $builder->where('magic_topic_id', (string) $filters['magic_topic_id']);
        }
        if (! empty($filters['request_id'])) {
            $builder->where('request_id', (string) $filters['request_id']);
        }
        if (! empty($filters['event_id'])) {
            $builder->where('event_id', (string) $filters['event_id']);
        }
        if (! empty($filters['start_operation_time'])) {
            $builder->where('operation_time', '>=', (int) $filters['start_operation_time']);
        }
        if (! empty($filters['end_operation_time'])) {
            $builder->where('operation_time', '<=', (int) $filters['end_operation_time']);
        }

        return $this->queryByCursor($builder, $pageSize, $cursorId, $direction);
    }

    public function statistics(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): array {
        $organizationCode = $this->resolveOrganizationCodeFilter(
            $filters,
            $currentOrganizationCode,
            $isOfficialOrganization
        );

        return $this->fetchStatisticsInOnePass($filters, $organizationCode);
    }

    /**
     * 组装写库属性：排除 points；无值不写 event_id（兼容历史 INSERT）.
     *
     * @return array<string, mixed>
     */
    protected function getAttributesForAuditPersist(AbstractEntity $entity): array
    {
        $attributes = $this->getAttributes($entity);
        unset($attributes['points']);
        $eventId = $attributes['event_id'] ?? null;
        if ($eventId === null || $eventId === '') {
            unset($attributes['event_id']);
        }

        return $attributes;
    }

    /**
     * 游标分页：基于主键 id 的范围查询，避免 COUNT + OFFSET 的性能问题.
     *
     * @return array{list: array, next_cursor_id: ?string, prev_cursor_id: ?string, has_more: bool}
     */
    private function queryByCursor(
        Builder $builder,
        int $pageSize,
        ?string $cursorId,
        string $direction
    ): array {
        $isPrev = $direction === 'prev';

        if ($cursorId !== null && $cursorId !== '') {
            $builder->where('id', $isPrev ? '>' : '<', $cursorId);
        }

        $builder->orderBy('id', $isPrev ? 'asc' : 'desc')
            ->limit($pageSize + 1);

        $rawList = $builder->get();
        $list = method_exists($rawList, 'toArray') ? $rawList->toArray() : (array) $rawList;

        $hasMore = count($list) > $pageSize;
        if ($hasMore) {
            // prev 方向多取的哨兵位于 ASC 结果最前面（id 最小），应丢弃第一条
            // next 方向多取的哨兵位于 DESC 结果最后面（id 最小），array_pop 即可
            if ($isPrev) {
                array_shift($list);
            } else {
                array_pop($list);
            }
        }

        // prev 方向是 ASC 取的，结果需要反转回 DESC 顺序
        if ($isPrev) {
            $list = array_reverse($list);
        }

        $list = $this->formatList($list);

        $nextCursorId = null;
        $prevCursorId = null;
        if ($list !== []) {
            $lastItem = end($list);
            $firstItem = reset($list);
            $nextCursorId = $lastItem['id'] ?? null;
            $prevCursorId = $firstItem['id'] ?? null;
        }

        return [
            'list' => $list,
            'next_cursor_id' => $nextCursorId,
            'prev_cursor_id' => $prevCursorId,
            'has_more' => $hasMore,
        ];
    }

    /**
     * 普通组织始终强制当前组织过滤；官方组织可选按 organization_code 过滤，不传则看全量.
     */
    private function resolveOrganizationCodeFilter(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): ?string {
        if (! $isOfficialOrganization) {
            return $currentOrganizationCode;
        }

        $organizationCode = trim((string) ($filters['organization_code'] ?? ''));
        if ($organizationCode === '') {
            return null;
        }

        return $organizationCode;
    }

    /**
     * @param array<int, array<string, mixed>> $list
     * @return array<int, array<string, mixed>>
     */
    private function formatList(array $list): array
    {
        foreach ($list as &$item) {
            $item['id'] = isset($item['id']) ? (string) $item['id'] : '';
            $item['user_id'] = (string) ($item['user_id'] ?? '');
            $item['organization_code'] = (string) ($item['organization_code'] ?? '');
            $item['operation_time'] = (int) ($item['operation_time'] ?? 0);
            $item['all_latency'] = (int) ($item['all_latency'] ?? 0);
            $item['first_response_latency'] = (int) ($item['first_response_latency'] ?? 0);
            $item['usage'] = is_array($item['usage'] ?? null) ? $item['usage'] : [];
            $item['detail_info'] = is_array($item['detail_info'] ?? null) ? $item['detail_info'] : null;
            $item['access_scope'] = (string) ($item['access_scope'] ?? '');
            $item['magic_topic_id'] = (string) ($item['magic_topic_id'] ?? '');
            $item['request_id'] = (string) ($item['request_id'] ?? '');
            $item['event_id'] = (string) ($item['event_id'] ?? '');
            $item['points'] = array_key_exists('points', $item) && $item['points'] !== null ? (int) $item['points'] : null;
            $item['access_token_name'] = (string) ($item['access_token_name'] ?? '');
            $item['model_version'] = (string) ($item['model_version'] ?? '');
            $item['provider_name'] = (string) ($item['provider_name'] ?? '');
        }

        return $list;
    }

    private function applyStatisticsFilters(
        $builder,
        array $filters,
        ?string $organizationCode
    ): void {
        if ($organizationCode !== null) {
            $builder->where('organization_code', $organizationCode);
        }

        $builder->where('operation_time', '>=', (int) $filters['start_operation_time']);
        $builder->where('operation_time', '<=', (int) $filters['end_operation_time']);

        $builder->whereNotIn('type', [AuditType::SEARCH->value, AuditType::WEB_SCRAPE->value]);

        if (! empty($filters['service_provider_config_id'])) {
            $builder->where('service_provider_config_id', (int) $filters['service_provider_config_id']);
        }
        if (! empty($filters['product_code'])) {
            $builder->where('product_code', (string) $filters['product_code']);
        }
        if (! empty($filters['access_scope'])) {
            $builder->where('access_scope', (string) $filters['access_scope']);
        }
    }

    /**
     * 一次扫表同时产出 summary / trend / breakdown 所需的全部原始数据。
     * 分组粒度：(时间桶, service_provider_config_id, product_code)，
     * 应用层再按维度做二次聚合，避免同一 WHERE 扫表三次。
     *
     * @return array{summary: array, trend: array, breakdown: array}
     */
    private function fetchStatisticsInOnePass(array $filters, ?string $organizationCode): array
    {
        $startMs = (int) $filters['start_operation_time'];
        $endMs = (int) $filters['end_operation_time'];
        $deltaMs = $endMs - $startMs;
        $isHourly = $deltaMs <= 86400000;

        $builder = AuditLogModel::query();
        $this->applyStatisticsFilters($builder, $filters, $organizationCode);

        $bucketExpr = $isHourly
            ? 'FLOOR(operation_time / 3600000) * 3600000'
            : "DATE_FORMAT(FROM_UNIXTIME(operation_time / 1000), '%Y-%m-%d')";

        $rows = $builder->selectRaw(
            "{$bucketExpr} as bucket_key,
             CAST(service_provider_config_id AS CHAR) as service_provider_config_id,
             product_code,
             COUNT(*) as cnt,
             SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as err_cnt,
             SUM(CAST(JSON_EXTRACT(`usage`, '$.prompt_tokens') AS UNSIGNED)) as input_tokens,
             SUM(CAST(JSON_EXTRACT(`usage`, '$.completion_tokens') AS UNSIGNED)) as output_tokens,
             SUM(COALESCE(
                 CAST(JSON_EXTRACT(`usage`, '$.total_tokens') AS UNSIGNED),
                 CAST(JSON_EXTRACT(`usage`, '$.prompt_tokens') AS UNSIGNED) + CAST(JSON_EXTRACT(`usage`, '$.completion_tokens') AS UNSIGNED),
                 0
             )) as total_tokens",
            [AuditStatus::FAIL->value]
        )
            ->groupBy('bucket_key', 'service_provider_config_id', 'product_code')
            ->get()
            ->toArray();

        $summaryTotal = 0;
        $summaryError = 0;
        $summaryInputTokens = 0;
        $summaryOutputTokens = 0;
        $summaryTotalTokens = 0;

        $trendMap = [];
        $breakdownMap = [];

        foreach ($rows as $r) {
            $r = (array) $r;
            $cnt = (int) ($r['cnt'] ?? 0);
            $errCnt = (int) ($r['err_cnt'] ?? 0);
            $inTok = (int) ($r['input_tokens'] ?? 0);
            $outTok = (int) ($r['output_tokens'] ?? 0);
            $totTok = (int) ($r['total_tokens'] ?? 0);

            $summaryTotal += $cnt;
            $summaryError += $errCnt;
            $summaryInputTokens += $inTok;
            $summaryOutputTokens += $outTok;
            $summaryTotalTokens += $totTok;

            $bucketKey = $isHourly ? (int) $r['bucket_key'] : (string) $r['bucket_key'];
            if (! isset($trendMap[$bucketKey])) {
                $trendMap[$bucketKey] = ['requests' => 0, 'errors' => 0];
            }
            $trendMap[$bucketKey]['requests'] += $cnt;
            $trendMap[$bucketKey]['errors'] += $errCnt;

            $bKey = ($r['service_provider_config_id'] ?? '') . '||' . ($r['product_code'] ?? '');
            if (! isset($breakdownMap[$bKey])) {
                $breakdownMap[$bKey] = [
                    'service_provider_config_id' => (string) ($r['service_provider_config_id'] ?? ''),
                    'product_code' => (string) ($r['product_code'] ?? ''),
                    'total_requests' => 0,
                    'error_requests' => 0,
                ];
            }
            $breakdownMap[$bKey]['total_requests'] += $cnt;
            $breakdownMap[$bKey]['error_requests'] += $errCnt;
        }

        $breakdown = array_values($breakdownMap);
        usort($breakdown, function (array $a, array $b) {
            return $b['total_requests'] <=> $a['total_requests']
                ?: $a['service_provider_config_id'] <=> $b['service_provider_config_id']
                ?: $a['product_code'] <=> $b['product_code'];
        });

        if ($isHourly) {
            $trendRows = [];
            foreach ($trendMap as $ms => $v) {
                $trendRows[] = ['bucket_ms' => $ms, 'requests' => $v['requests'], 'errors' => $v['errors']];
            }
        } else {
            $trendRows = [];
            foreach ($trendMap as $day => $v) {
                $trendRows[] = ['bucket_day' => $day, 'requests' => $v['requests'], 'errors' => $v['errors']];
            }
        }

        return [
            'summary' => [
                'total' => $summaryTotal,
                'error' => $summaryError,
                'input_tokens' => $summaryInputTokens,
                'output_tokens' => $summaryOutputTokens,
                'total_tokens' => $summaryTotalTokens,
            ],
            'trend' => [
                'bucket_type' => $isHourly ? 'hour' : 'day',
                'rows' => $trendRows,
                'start_ms' => $startMs,
                'end_ms' => $endMs,
            ],
            'breakdown' => $breakdown,
        ];
    }
}

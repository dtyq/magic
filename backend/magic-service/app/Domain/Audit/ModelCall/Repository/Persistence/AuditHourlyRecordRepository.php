<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence;

use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Repository\Facade\AuditHourlyRecordRepositoryInterface;
use App\Domain\Audit\ModelCall\Repository\Persistence\Model\AuditHourlyRecordModel;
use App\Domain\Audit\ModelCall\Repository\Persistence\Model\AuditLogModel;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

final class AuditHourlyRecordRepository implements AuditHourlyRecordRepositoryInterface
{
    use AuditStatisticsQuery;

    public function deleteDate(string $statDate): void
    {
        AuditHourlyRecordModel::query()->where('stat_date', $statDate)->delete();
    }

    public function insertHour(string $statDate, string $bucketStartAt, int $startMs, int $endMs): void
    {
        $rows = AuditLogModel::query()
            ->where('operation_time', '>=', $startMs)
            ->where('operation_time', '<', $endMs)
            ->whereNotIn('type', [
                AuditType::SEARCH->value,
                AuditType::WEB_SCRAPE->value,
                AuditType::SLIDES_TEMPLATE->value,
            ])
            ->selectRaw(
                "organization_code,
                 COALESCE(access_scope, '') as access_scope,
                 COALESCE(service_provider_config_id, 0) as service_provider_config_id,
                 COALESCE(product_code, '') as product_code,
                 COUNT(*) as request_count,
                 SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as error_count,
                 " . $this->usageTokenSumSql(),
                [AuditStatus::FAIL->value]
            )
            ->groupBy(
                'organization_code',
                Db::raw("COALESCE(access_scope, '')"),
                Db::raw('COALESCE(service_provider_config_id, 0)'),
                Db::raw("COALESCE(product_code, '')"),
            )
            ->get()
            ->toArray();

        if ($rows === []) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $payload = [];
        foreach ($rows as $row) {
            $payload[] = [
                'stat_date' => $statDate,
                'bucket_start_at' => $bucketStartAt,
                'organization_code' => (string) ($row['organization_code'] ?? ''),
                'access_scope' => (string) ($row['access_scope'] ?? ''),
                'service_provider_config_id' => (int) ($row['service_provider_config_id'] ?? 0),
                'product_code' => (string) ($row['product_code'] ?? ''),
                'request_count' => (int) ($row['request_count'] ?? 0),
                'error_count' => (int) ($row['error_count'] ?? 0),
                'input_tokens' => (int) ($row['input_tokens'] ?? 0),
                'output_tokens' => (int) ($row['output_tokens'] ?? 0),
                'total_tokens' => (int) ($row['total_tokens'] ?? 0),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($payload, 100) as $chunk) {
            AuditHourlyRecordModel::query()->insert($chunk);
        }
    }

    public function summarizeDate(string $statDate): array
    {
        $row = AuditHourlyRecordModel::query()
            ->where('stat_date', $statDate)
            ->selectRaw('COALESCE(SUM(request_count), 0) as request_count, COUNT(*) as row_count')
            ->first();

        return [
            'request_count' => (int) ($row->request_count ?? 0),
            'row_count' => (int) ($row->row_count ?? 0),
        ];
    }

    public function trend(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization,
        bool $byHour
    ): array {
        $builder = $this->createStatisticsBuilder($filters, $currentOrganizationCode, $isOfficialOrganization);
        $bucketColumn = $byHour ? 'bucket_start_at' : 'stat_date';
        $bucketAlias = $byHour ? 'bucket_start_at' : 'bucket_day';

        return $builder
            ->selectRaw(
                $bucketColumn . ' as ' . $bucketAlias . ',
                 SUM(request_count) as requests,
                 SUM(error_count) as errors,
                 SUM(input_tokens) as input_tokens,
                 SUM(output_tokens) as output_tokens,
                 SUM(total_tokens) as total_tokens'
            )
            ->groupBy($bucketColumn)
            ->orderBy($bucketColumn)
            ->get()
            ->toArray();
    }

    public function breakdown(array $filters, string $currentOrganizationCode, bool $isOfficialOrganization): array
    {
        $rows = $this->createStatisticsBuilder($filters, $currentOrganizationCode, $isOfficialOrganization)
            ->selectRaw(
                'service_provider_config_id,
                 product_code,
                 SUM(request_count) as total_requests,
                 SUM(error_count) as error_requests'
            )
            ->groupBy('service_provider_config_id', 'product_code')
            ->orderByDesc('total_requests')
            ->orderBy('service_provider_config_id')
            ->orderBy('product_code')
            ->get()
            ->toArray();

        foreach ($rows as &$row) {
            if ((string) ($row['service_provider_config_id'] ?? '') === '0') {
                $row['service_provider_config_id'] = '';
            }
        }
        unset($row);

        return $rows;
    }

    private function createStatisticsBuilder(
        array $filters,
        string $currentOrganizationCode,
        bool $isOfficialOrganization
    ): Builder {
        $builder = AuditHourlyRecordModel::query()
            ->where('bucket_start_at', '>=', (string) $filters['start_bucket_at'])
            ->where('bucket_start_at', '<', (string) $filters['end_bucket_at']);

        $organizationCode = $isOfficialOrganization
            ? trim((string) ($filters['organization_code'] ?? ''))
            : $currentOrganizationCode;
        if ($organizationCode !== '') {
            $builder->where('organization_code', $organizationCode);
        }
        $this->applyServiceProviderConfigFilter($builder, $filters);
        $this->applyIndexedPrefixLike($builder, 'product_code', $filters);
        if (! empty($filters['access_scope'])) {
            $builder->where('access_scope', (string) $filters['access_scope']);
        }

        return $builder;
    }
}

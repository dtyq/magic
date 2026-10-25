<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Repository\Persistence;

use Hyperf\Database\Model\Builder;

/**
 * 明细表与小时表共用的 usage JSON 聚合、服务商 whereIn.
 */
trait AuditStatisticsQuery
{
    private function usageTokenSumSql(): string
    {
        return "SUM(COALESCE(CAST(JSON_EXTRACT(`usage`, '$.prompt_tokens') AS UNSIGNED), 0)) as input_tokens,
                 SUM(COALESCE(CAST(JSON_EXTRACT(`usage`, '$.completion_tokens') AS UNSIGNED), 0)) as output_tokens,
                 SUM(COALESCE(
                      CAST(JSON_EXTRACT(`usage`, '$.total_tokens') AS UNSIGNED),
                      COALESCE(CAST(JSON_EXTRACT(`usage`, '$.prompt_tokens') AS UNSIGNED), 0)
                          + COALESCE(CAST(JSON_EXTRACT(`usage`, '$.completion_tokens') AS UNSIGNED), 0),
                      0
                  )) as total_tokens";
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function applyServiceProviderConfigFilter(Builder $builder, array $filters): void
    {
        if (! array_key_exists('service_provider_config_ids', $filters)) {
            return;
        }

        $rawConfigIds = $filters['service_provider_config_ids'];
        $configIds = is_array($rawConfigIds) ? array_values(array_unique(array_filter(
            array_map('intval', $rawConfigIds),
            static fn (int $id): bool => $id > 0
        ))) : [];
        if ($configIds === []) {
            $builder->whereRaw('1 = 0');
            return;
        }
        $builder->whereIn('service_provider_config_id', $configIds);
    }

    /**
     * 有 btree 索引的字符串模糊查询只用前缀 `value%`，才能走索引.
     *
     * @param array<string, mixed> $filters
     */
    private function applyIndexedPrefixLike(Builder $builder, string $column, array $filters): void
    {
        $keyword = trim((string) ($filters[$column] ?? ''));
        if ($keyword === '') {
            return;
        }
        $builder->where($column, 'like', addcslashes($keyword, '%_') . '%');
    }
}

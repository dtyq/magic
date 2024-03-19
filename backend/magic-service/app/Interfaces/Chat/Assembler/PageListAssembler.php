<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

// 分页组织器
class PageListAssembler
{
    public static function pageByMysql(array $data, int $currentOffset = 0, int $currentLimit = 0, ?int $maxRecords = null): array
    {
        if ($currentLimit === 0) {
            // 不限制条数，所以没有下一页
            $hasMore = false;
        } elseif ($maxRecords !== null) {
            // 如果知道总记录数，则直接比较
            $hasMore = ($currentOffset + $currentLimit) < $maxRecords;
        } else {
            // 如果不知道总记录数，当前结果集不为空则有下一页
            $hasMore = empty($data) ? false : true;
        }
        $nextPageToken = $hasMore ? (string) ($currentOffset + $currentLimit) : '';

        return [
            'items' => $data,
            'has_more' => (bool) $nextPageToken,
            'page_token' => $nextPageToken,
        ];
    }

    public static function pageByElasticSearch(array $data, string $requestPageToken, bool $hasMore = false): array
    {
        return [
            'items' => $data,
            'has_more' => $hasMore,
            'page_token' => $requestPageToken,
        ];
    }
}

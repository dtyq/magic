<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Support;

/**
 * 审计 detail_info 固定骨架：模型类与工具类键名一致、便于查询与对账.
 *
 * - 模型类：TEXT / EMBEDDING / IMAGE（stream 仅对话类有意义，其余传 null）
 * - 工具类：SEARCH / WEB_SCRAPE（target 统一承载检索关键词或抓取 URL）
 */
final class AuditDetailInfo
{
    /**
     * @param array<string, mixed> $extras 非空时写入 extras 子键，避免污染固定字段
     */
    public static function forModel(
        string $appId,
        string $sourceId,
        string $providerModelId,
        ?bool $stream,
        array $extras = []
    ): array {
        $detail = [
            'app_id' => $appId,
            'source_id' => $sourceId,
            'provider_model_id' => $providerModelId,
            'stream' => $stream,
        ];
        if ($extras !== []) {
            $detail['extras'] = $extras;
        }

        return $detail;
    }

    /**
     * @param array<string, mixed> $extras 非空时写入 extras 子键
     */
    public static function forTool(
        string $appId,
        string $sourceId,
        string $engine,
        string $target,
        array $extras = []
    ): array {
        $detail = [
            'app_id' => $appId,
            'source_id' => $sourceId,
            'engine' => $engine,
            'target' => $target,
        ];
        if ($extras !== []) {
            $detail['extras'] = $extras;
        }

        return $detail;
    }
}

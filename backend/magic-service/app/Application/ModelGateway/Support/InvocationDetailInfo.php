<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Support;

/**
 * 模型网关侧 invocation 详情结构（与审计落库 detail_info 键名一致，便于下游投影）.
 */
final class InvocationDetailInfo
{
    /**
     * @param array<string, mixed> $extras 非空时写入 extras 子键，避免污染固定字段
     */
    public static function forModel(
        string $appId,
        string $sourceId,
        string $providerModelId,
        array $extras = []
    ): array {
        $detail = [
            'app_id' => $appId,
            'source_id' => $sourceId,
            'provider_model_id' => $providerModelId,
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

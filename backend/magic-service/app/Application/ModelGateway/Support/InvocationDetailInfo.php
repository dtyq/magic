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
     * 失败原因文案最大字符数（多字节安全），防止异常 message 过长撑爆 JSON / packet。
     */
    public const MAX_FAILURE_REASON_LENGTH = 8192;

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

    /**
     * 将失败原因写入 extras（含截断），失败审计路径应始终带该键，无文案则为空串。
     *
     * @param array<string, mixed> $extras
     * @return array<string, mixed>
     */
    public static function withFailureReason(array $extras, string $reason): array
    {
        $extras['failure_reason'] = self::truncateFailureReason($reason);

        return $extras;
    }

    public static function truncateFailureReason(string $reason): string
    {
        if (mb_strlen($reason, 'UTF-8') <= self::MAX_FAILURE_REASON_LENGTH) {
            return $reason;
        }

        return mb_substr($reason, 0, self::MAX_FAILURE_REASON_LENGTH, 'UTF-8');
    }
}

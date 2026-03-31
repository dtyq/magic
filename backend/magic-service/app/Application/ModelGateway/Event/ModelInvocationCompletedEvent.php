<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event;

/**
 * 模型网关领域内「一次模型相关调用已在业务上结束」的事实。
 * 不含审计域类型；审计侧在 Listener 中映射落库。
 */
final class ModelInvocationCompletedEvent
{
    public function __construct(
        public array $userInfo,
        public string $ip,
        /** 调用类别，取值与现网能力分类字符串一致（如 TEXT、IMAGE） */
        public string $invocationCategory,
        public string $productCode,
        public string $accessToken,
        public float $startTime,
        public int $latencyMs,
        /** 业务结果：success / failure */
        public string $outcome,
        public array $usage = [],
        public ?array $detailInfo = null,
        public array $businessParams = [],
        public string $sourceMarker = '',
    ) {
    }
}

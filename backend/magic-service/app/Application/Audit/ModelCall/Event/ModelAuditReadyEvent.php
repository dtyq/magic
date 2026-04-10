<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event;

use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;

/**
 * 审计域内部统一事件：所有触发源经 Bridge 组装后统一 dispatch 此事件，
 * 由 ModelAuditPersistSubscriber 异步消费并一次性 INSERT。
 */
final class ModelAuditReadyEvent
{
    public function __construct(
        public readonly string $type,
        public readonly string $productCode,
        public readonly string $status,
        public readonly string $ak,
        public readonly int $operationTime,
        public readonly int $allLatency,
        public readonly array $userInfo = [],
        public readonly array $usage = [],
        public readonly ?array $detailInfo = null,
        public readonly array $businessParams = [],
        public readonly ModelAuditAccessScope $accessScope = ModelAuditAccessScope::Magic,
        /** 首次响应延时（TTFT），仅流式有值，单位毫秒 */
        public readonly int $firstResponseLatency = 0,
        /** 与 businessParams.event_id 一致，供 MQ/计费关联 */
        public readonly string $eventId = '',
    ) {
    }
}

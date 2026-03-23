<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event;

class AuditLogEvent
{
    public function __construct(
        public string $ip,
        public string $type,
        public string $productCode,
        public string $status,
        public string $ak,
        public int $operationTime,
        public int $allLatency,
        public array $userInfo = [],
        public array $usage = [],
        public ?array $detailInfo = null,
        // 仅用于事件链路透传的上下文，不直接落库.
        public array $businessParams = [],
    ) {
    }

    public function getBusinessParam(string $key, mixed $default = null): mixed
    {
        return $this->businessParams[$key] ?? $default;
    }
}

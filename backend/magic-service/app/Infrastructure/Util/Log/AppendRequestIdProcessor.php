<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log;

use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Engine\Coroutine;
use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;
use Throwable;

class AppendRequestIdProcessor implements ProcessorInterface
{
    public function __invoke(LogRecord $record): LogRecord
    {
        $context = $record->context;

        try {
            $coroutineId = Coroutine::id();
        } catch (Throwable $e) {
            // 当协程上下文未初始化时，返回 -1 作为标识
            $coroutineId = -1;
        }

        try {
            $requestId = CoContext::getOrSetRequestId();
            $traceId = CoContext::getTraceId();
        } catch (Throwable $e) {
            // 当上下文不可用时，使用空值
            $requestId = '';
            $traceId = '';
        }

        $context['system_info'] = [
            'request_id' => $requestId,
            'coroutine_id' => $coroutineId,
            'trace_id' => $traceId,
        ];

        return $record->with(context: $context);
    }
}

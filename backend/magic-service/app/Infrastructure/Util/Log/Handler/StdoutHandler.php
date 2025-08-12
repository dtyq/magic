<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Handler;

use Hyperf\Codec\Json;
use Hyperf\Contract\StdoutLoggerInterface;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

class StdoutHandler extends AbstractProcessingHandler
{
    private StdoutLoggerInterface $logger;

    public function __construct($level = Level::Debug, bool $bubble = true)
    {
        parent::__construct($level, $bubble);
        $this->logger = \Hyperf\Support\make(StdoutLogger::class, ['minLevel' => $level]);
    }

    protected function write(LogRecord $record): void
    {
        $context = $record->context;
        $systemInfo = $context['system_info'] ?? [];
        if ($systemInfo) {
            unset($context['system_info']);
        }

        // Pre-allocate string buffer for better memory performance
        $parts = [];

        // Add system info prefixes
        if ($systemInfo) {
            $requestId = $systemInfo['request_id'] ?? '';
            $coroutineId = $systemInfo['coroutine_id'] ?? '';
            $traceId = $systemInfo['trace_id'] ?? '';

            if (! empty($requestId)) {
                $parts[] = "[{$requestId}]";
            }
            if (! empty($coroutineId)) {
                $parts[] = "[{$coroutineId}]";
            }
            if (! empty($traceId)) {
                $parts[] = "[{$traceId}]";
            }
        }

        // Add timestamp, channel, and message
        $parts[] = '[' . $record->datetime->format('Y-m-d H:i:s') . ']';
        $parts[] = '[' . $record->channel . ']';
        $parts[] = '[' . $record->message . ']';

        // Add context if present (avoid encoding empty arrays)
        if (! empty($context)) {
            $parts[] = Json::encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        // Join once instead of multiple concatenations
        $formatted = implode('', $parts);
        $level = strtolower($record->level->getName());

        call_user_func([$this->logger, $level], $formatted);
    }
}

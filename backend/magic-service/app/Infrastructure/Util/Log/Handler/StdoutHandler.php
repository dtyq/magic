<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Handler;

use App\Infrastructure\Util\Environment\EnvironmentUtil;
use Hyperf\Codec\Json;
use Hyperf\Contract\StdoutLoggerInterface;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

class StdoutHandler extends AbstractProcessingHandler
{
    /**
     * Production log size guard (bytes).
     *
     * Note: use byte-based operations only (strlen/isset/substring) to avoid CPU-heavy
     * multibyte processing in coroutine environment.
     */
    private const int PROD_MAX_LOG_BYTES = 1024;

    /**
     * Rules for production log suppression keyed by channel and optional message keyword.
     */
    private const array PROD_DROP_RULES = [
        ['channel' => 'Dtyq\AsyncEvent\Kernel\Utils\Locker'],
        ['channel' => 'ModelGatewayMapper', 'message_contains' => 'SseStreamProcessingCheckpoint'],
        ['channel' => 'ModelGatewayMapper', 'message_contains' => 'StreamProcessingStartedWithSseClient'],
        ['channel' => 'ModelGatewayMapper', 'message_contains' => 'FirstChunkReceivedFromSseClient'],
        ['channel' => 'ModelGatewayMapper', 'message_contains' => 'LastChunkReceivedFromSseClient'],
        ['channel' => 'ModelGatewayMapper', 'message_contains' => 'SseClientStreamCompleted'],
        ['channel_contains' => 'ConsumptionStrategyFactory'],
        ['channel_contains' => 'PointConsumptionAppService'],
    ];

    /**
     * Channel name for SQL logs (Monolog channel field).
     */
    private const string CHANNEL_SQL = 'sql';

    private StdoutLoggerInterface $logger;

    public function __construct($level = Level::Debug, bool $bubble = true)
    {
        parent::__construct($level, $bubble);
        $this->logger = \Hyperf\Support\make(StdoutLogger::class, ['minLevel' => $level]);
    }

    protected function write(LogRecord $record): void
    {
        // Production filters and size guards
        if (EnvironmentUtil::isProd()) {
            $record = $this->applyProductionGuards($record);
            if ($record === null) {
                return;
            }
        }

        // Suppress SQL logs in production environment
        if ($this->shouldDropSql($record)) {
            return;
        }

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

        // Final production line-length guard: truncate > 1KB without expensive scanning.
        if (EnvironmentUtil::isProd()) {
            $formatted = $this->truncateBytes($formatted, self::PROD_MAX_LOG_BYTES, 'line');
        }

        $level = strtolower($record->level->getName());

        call_user_func([$this->logger, $level], $formatted);
    }

    /**
     * Apply production environment guards to log records.
     *
     * This method performs two operations:
     * 1. Checks if the log should be suppressed entirely (returns null)
     * 2. Truncates overly long messages to prevent excessive log output
     *
     * @param LogRecord $record The log record to process
     * @return null|LogRecord Returns null if the log should be suppressed, otherwise returns the processed record
     */
    private function applyProductionGuards(LogRecord $record): ?LogRecord
    {
        if ($this->shouldSuppress($record)) {
            return null;
        }

        // Guard individual message length early (bytes) to avoid producing giant formatted line
        // Truncate Monolog message field if too long (business log text)
        if (isset($record->message[self::PROD_MAX_LOG_BYTES])) {
            $trimmed = $this->truncateBytes($record->message, self::PROD_MAX_LOG_BYTES, 'message');
            $record = $record->with(message: $trimmed);
        }

        return $record;
    }

    /**
     * Drop SQL logs in production to reduce noise.
     */
    private function shouldDropSql(LogRecord $record): bool
    {
        // channel 是 Monolog 的内置字段，这里约定 'sql' 表示 SQL 相关日志
        return $record->channel === self::CHANNEL_SQL && EnvironmentUtil::isProd();
    }

    /**
     * Byte-based truncation with short suffix.
     */
    private function truncateBytes(string $payload, int $limit, string $label): string
    {
        if (! isset($payload[$limit])) {
            return $payload;
        }

        $originalBytes = strlen($payload);

        return substr($payload, 0, $limit)
            . '...[TRUNCATED ' . $label . ' bytes=' . $originalBytes . ' limit=' . $limit . ']';
    }

    /**
     * Check if a log record should be suppressed in production environment.
     *
     * Evaluates the log record against PROD_DROP_RULES to determine if it matches
     * any suppression criteria. Rules can match by exact channel name, channel substring,
     * or message content substring.
     *
     * @param LogRecord $record The log record to evaluate
     * @return bool Returns true if the log should be suppressed, false otherwise
     */
    private function shouldSuppress(LogRecord $record): bool
    {
        $channel = $record->channel;
        $message = $record->message;
        foreach (self::PROD_DROP_RULES as $rule) {
            if (isset($rule['channel']) && $channel !== $rule['channel']) {
                continue;
            }
            if (isset($rule['channel_contains']) && ! str_contains($channel, $rule['channel_contains'])) {
                continue;
            }
            if (isset($rule['message_contains']) && ! str_contains($message, $rule['message_contains'])) {
                continue;
            }
            return true;
        }

        return false;
    }
}

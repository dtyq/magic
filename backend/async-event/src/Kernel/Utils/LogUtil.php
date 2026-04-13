<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Utils;

use Hyperf\Context\ApplicationContext;
use Psr\Log\LoggerInterface;
use Throwable;

class LogUtil
{
    public static function dump(int $recordId, string $listenerName, string $eventName, ?Throwable $exception = null, array $context = []): void
    {
        $container = ApplicationContext::getContainer();
        $logger = $container->get(LoggerInterface::class);
        if ($exception) {
            $logger->error('ListenerFail', array_merge([
                'record_id' => $recordId,
                'event_name' => $eventName,
                'listener_name' => $listenerName,
                'exception' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ], $context));
        } else {
            $logLevel = $recordId === 0 ? 'debug' : 'info';
            $logger->{$logLevel}('ListenerSuccess', array_merge([
                'record_id' => $recordId,
                'event_name' => $eventName,
                'listener_name' => $listenerName,
            ], $context));
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel;

use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\AsyncEvent\Kernel\Event\AsyncEventRetryMaxEvent;
use Dtyq\AsyncEvent\Kernel\Service\AsyncEventService;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

class AsyncEventRetry
{
    public static function retry(int $id): void
    {
        $asyncEventService = ApplicationContext::getContainer()->get(AsyncEventService::class);

        try {
            $record = $asyncEventService->getById($id);
            $listener = \Hyperf\Support\make($record->listener);
            if ($listener instanceof ListenerInterface) {
                $listener->process(unserialize($record->args));
                $asyncEventService->complete($record->id);
            }
        } catch (Throwable $throwable) {
            $asyncEventService->retry($id);
            $logger = ApplicationContext::getContainer()->get(StdoutLoggerInterface::class);
            $logger->error(sprintf('Async event retry failed, id: %d, [exception]%s [trace]%s', $id, $throwable->getMessage(), $throwable->getTraceAsString()));
            if (isset($record)) {
                if (($record->retry_times + 1) >= \Hyperf\Config\config('async_event.retry.times', 3)) {
                    $asyncEventService->fail($id);
                    AsyncEventUtil::dispatch(new AsyncEventRetryMaxEvent($record));
                }
            }
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Executor;

use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\AsyncEvent\Kernel\Event\AsyncEventRetryMaxEvent;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Dtyq\AsyncEvent\Kernel\Service\AsyncEventService;
use Dtyq\AsyncEvent\Kernel\Utils\ContextDataUtil;
use Dtyq\AsyncEvent\Kernel\Utils\Locker;
use Dtyq\AsyncEvent\Kernel\Utils\LogUtil;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class AsyncListenerExecutor
{
    private Locker $locker;

    private AsyncEventService $asyncEventService;

    private LoggerInterface $logger;

    public function __construct(
        ContainerInterface $container,
    ) {
        $this->locker = $container->get(Locker::class);
        $this->asyncEventService = $container->get(AsyncEventService::class);
        $this->logger = $container->get(LoggerInterface::class);
    }

    public function runWithId(int $id): void
    {
        $this->locker->get(function () use ($id) {
            $record = $this->asyncEventService->getById($id);
            if (! $record) {
                return;
            }

            // Restore context data before executing listener
            $this->restoreContextData($record);

            $exception = null;
            try {
                $listener = \Hyperf\Support\make($record->listener);
                if ($listener instanceof ListenerInterface) {
                    $listener->process(unserialize($record->args));
                    $this->asyncEventService->delete($record->id);
                }
            } catch (Throwable $throwable) {
                $exception = $throwable;
                $this->asyncEventService->markAsExecuting($record->id);
            } finally {
                LogUtil::dump($id, $record->listener, $record->event, $exception);
            }
        }, 'async_event_run_' . $id);
    }

    public function run(AsyncEventModel $asyncEventModel, object $event, callable $listener): void
    {
        $this->locker->get(function () use ($asyncEventModel, $listener, $event) {
            // Restore context data before executing listener
            $this->restoreContextData($asyncEventModel);

            $exception = null;
            try {
                $listener($event);
                $this->asyncEventService->delete($asyncEventModel->id);
            } catch (Throwable $exception) {
                $this->asyncEventService->markAsExecuting($asyncEventModel->id);
            } finally {
                LogUtil::dump($asyncEventModel->id, $asyncEventModel->listener, $asyncEventModel->event, $exception);
            }
        }, "async_event_run_{$asyncEventModel->id}");
    }

    public function retry(int $id): void
    {
        $this->locker->get(function () use ($id) {
            $record = $this->asyncEventService->getById($id);
            if (! $record) {
                return;
            }

            // Restore context data before executing listener (important for retry)
            $this->restoreContextData($record);

            $exception = null;
            try {
                $listener = \Hyperf\Support\make($record->listener);
                if ($listener instanceof ListenerInterface) {
                    $listener->process(unserialize($record->args));
                    $this->asyncEventService->delete($record->id);
                }
            } catch (Throwable $throwable) {
                $exception = $throwable;
                $this->asyncEventService->retry($record->id);
                $this->logger->notice('AsyncEventRetryFailed', [
                    'id' => $id,
                    'exception' => $throwable->getMessage(),
                    'trace' => $throwable->getTraceAsString(),
                ]);
                if (($record->retry_times + 1) >= \Hyperf\Config\config('async_event.retry.times', 3)) {
                    $this->asyncEventService->fail($id);
                    AsyncEventUtil::dispatch(new AsyncEventRetryMaxEvent($record));
                }
            } finally {
                LogUtil::dump($id, $record->listener, $record->event, $exception);
            }
        }, 'async_event_run_' . $id);
    }

    private function restoreContextData(AsyncEventModel $record): void
    {
        if (empty($record->context_data)) {
            return;
        }

        if (is_array($record->context_data)) {
            ContextDataUtil::setContextData($record->context_data);
        }
    }
}

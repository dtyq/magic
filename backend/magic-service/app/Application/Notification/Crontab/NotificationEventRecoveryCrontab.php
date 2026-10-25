<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Crontab;

use App\Application\Notification\Event\NotificationEventConsumeRequested;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Re-dispatches accepted notification events that were not triggered or whose
 * consumer lease expired. The event table remains the source of truth and
 * the consumer still performs the CAS lease claim and idempotent write.
 */
#[Crontab(
    rule: '* * * * *',
    name: 'NotificationEventRecoveryCrontab',
    singleton: true,
    mutexExpires: 55,
    onOneServer: true,
    callback: 'execute',
    memo: '恢复站内信未触发或租约超时事件',
)]
final readonly class NotificationEventRecoveryCrontab
{
    public function __construct(
        private NotificationEventRepositoryInterface $events,
        private EventDispatcherInterface $dispatcher,
        private LoggerInterface $logger,
        private ConfigInterface $config,
    ) {
    }

    public function execute(): void
    {
        try {
            $batchSize = max(1, (int) $this->config->get('notification.recovery_batch_size', 100));
            $events = $this->events->listRecoverable(date('Y-m-d H:i:s'), $batchSize);
            foreach ($events as $event) {
                $this->dispatcher->dispatch(new NotificationEventConsumeRequested($event->getEventId()));
            }
            if ($events !== []) {
                $this->logger->info('Notification event recovery dispatched', [
                    'count' => count($events),
                    'batch_size' => $batchSize,
                ]);
            }
        } catch (Throwable $throwable) {
            $this->logger->error('Notification event recovery failed', [
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}

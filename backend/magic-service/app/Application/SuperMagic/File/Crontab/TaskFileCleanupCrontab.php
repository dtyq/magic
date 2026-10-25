<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Crontab;

use App\Domain\SuperMagic\File\Service\TaskFileCleanupDomainService;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[Crontab(
    rule: '* * * * *',
    name: 'TaskFileCleanupCrontab',
    singleton: true,
    mutexExpires: 55,
    onOneServer: true,
    callback: 'execute',
    memo: 'Super Magic task file physical cleanup',
    enable: false
)]
class TaskFileCleanupCrontab
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileCleanupDomainService $cleanupService,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function execute(): void
    {
        $lockKey = 'TaskFileCleanupCrontab-global';
        $lockOwner = 'TaskFileCleanupCrontab-' . gethostname() . '-' . getmypid();
        if (! $this->locker->mutexLock($lockKey, $lockOwner, 55)) {
            return;
        }

        try {
            for ($batch = 0; $batch < 20; ++$batch) {
                $stats = $this->cleanupService->processPendingRecords(50);
                if ($stats['claimed'] === 0) {
                    break;
                }
                $this->logger->info('Task file cleanup batch completed', $stats + ['batch' => $batch + 1]);
            }
        } catch (Throwable $e) {
            $this->logger->error('Task file cleanup crontab failed', ['error' => $e->getMessage()]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }
}

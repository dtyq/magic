<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Crontab;

use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Keep a bounded replay window for every MagicFS file tree.
 *
 * The repository compacts one file tree at a time in short transactions. A
 * stale client cursor is deliberately expired and the client invalidates its
 * resident directories; no full-tree rebuild is hidden in this maintenance
 * task.
 */
#[Crontab(
    rule: '17 * * * *',
    name: 'MagicFSFileTreeChangeJournalCompactionCrontab',
    singleton: true,
    mutexExpires: 3600,
    onOneServer: true,
    callback: 'execute',
    memo: 'Compact the bounded MagicFS durable file-tree change journal',
)]
readonly class MagicFSFileTreeChangeJournalCompactionCrontab
{
    private const KEEP_REVISIONS = 100000;

    private const BATCH_SIZE = 1000;

    private const LOCK_KEY = 'magicfs_file_tree_change_journal_compaction_crontab_lock';

    private const LOCK_EXPIRE = 3600;

    private LoggerInterface $logger;

    public function __construct(
        private TaskFileRepositoryInterface $taskFileRepository,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function execute(): void
    {
        $owner = IdGenerator::getUniqueId32();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_EXPIRE)) {
            return;
        }

        try {
            $result = $this->taskFileRepository->compactFileTreeChangeJournal(
                self::KEEP_REVISIONS,
                self::BATCH_SIZE,
            );
            $this->logger->info('MagicFS file-tree change journal compaction completed', $result);
        } catch (Throwable $e) {
            $this->logger->error('MagicFS file-tree change journal compaction failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }
}

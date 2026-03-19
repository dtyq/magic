<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\Crontab;

use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Domain\RecycleBin\Service\RecycleBinDomainService;
use Hyperf\Crontab\Annotation\Crontab;
use Throwable;

/**
 * 回收站过期记录清理定时任务.
 * 每天凌晨3点执行，自动清理超过保留期的回收站记录.
 */
#[Crontab(
    rule: '0 3 * * *',
    name: 'RecycleBinCleanupCrontab',
    singleton: true,
    mutexExpires: 3600,
    onOneServer: true,
    callback: 'execute',
    memo: '回收站过期记录清理定时任务'
)]
readonly class RecycleBinCleanupCrontab
{
    use HasLogger;

    /**
     * 单批次处理的记录数量上限.
     */
    private const BATCH_SIZE = 1000;

    public function __construct(
        private RecycleBinDomainService $recycleBinDomainService
    ) {
    }

    /**
     * 执行清理任务.
     */
    public function execute(): void
    {
        $startTime = microtime(true);
        $this->logger->info('回收站过期记录清理任务开始');

        try {
            // 查询过期记录 ID
            $expiredIds = $this->recycleBinDomainService->findExpiredRecordIds(self::BATCH_SIZE);

            if (empty($expiredIds)) {
                $this->logger->info('回收站过期记录清理任务完成：无过期记录');
                return;
            }

            // 调用系统彻底删除（不校验用户权限）
            $result = $this->recycleBinDomainService->permanentDeleteBySystem($expiredIds);

            $successCount = count($expiredIds) - count($result['failed']);
            $failedCount = count($result['failed']);
            $elapsedTime = round((microtime(true) - $startTime) * 1000, 2);

            $this->logger->info('回收站过期记录清理任务完成', [
                'total' => count($expiredIds),
                'success' => $successCount,
                'failed' => $failedCount,
                'elapsed_ms' => $elapsedTime,
            ]);

            // 如果有失败记录，记录详细信息
            if ($failedCount > 0) {
                $this->logger->warning('回收站过期记录清理部分失败', [
                    'failed_items' => $result['failed'],
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('回收站过期记录清理任务失败', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}

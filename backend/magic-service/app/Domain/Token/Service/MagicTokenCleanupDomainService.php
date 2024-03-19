<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Service;

use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

readonly class MagicTokenCleanupDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private MagicTokenRepositoryInterface $magicTokenRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('MagicTokenCleanup');
    }

    /**
     * 循环批量清理过期 token。
     */
    public function cleanupExpiredTokens(int $batchSize = 500, int $maxBatches = 20): array
    {
        $batchSize = max(1, $batchSize);
        $maxBatches = max(1, $maxBatches);

        $stats = [
            'batch_size' => $batchSize,
            'max_batches' => $maxBatches,
            'batches_executed' => 0,
            'total_deleted' => 0,
            'completed' => true,
        ];

        try {
            for ($batch = 0; $batch < $maxBatches; ++$batch) {
                $deleted = $this->magicTokenRepository->deleteExpiredTokens($batchSize);

                if ($deleted === 0) {
                    break;
                }

                ++$stats['batches_executed'];
                $stats['total_deleted'] += $deleted;

                $this->logger->info('Magic token cleanup batch completed', [
                    'batch' => $stats['batches_executed'],
                    'deleted' => $deleted,
                ]);

                if ($deleted < $batchSize) {
                    break;
                }

                // 当达到最大批次数仍然存在数据，标记需要再次运行
                if ($batch + 1 === $maxBatches) {
                    $stats['completed'] = false;
                }
            }
        } catch (Throwable $throwable) {
            $stats['completed'] = false;
            $stats['error'] = $throwable->getMessage();
            $this->logger->error('Magic token cleanup failed', [
                'error' => $throwable->getMessage(),
            ]);
        }

        return $stats;
    }
}

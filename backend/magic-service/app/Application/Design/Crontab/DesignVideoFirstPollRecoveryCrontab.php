<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Crontab;

use App\Application\Design\Service\DesignVideoFirstPollRecoveryAppService;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\Log\LoggerInterface;
use Throwable;

#[Crontab(
    rule: '* * * * *',
    name: 'DesignVideoFirstPollRecoveryCrontab',
    singleton: true,
    onOneServer: true,
    mutexExpires: 55,
    callback: 'execute',
    memo: '恢复设计视频任务首个 poll 消息'
)]
readonly class DesignVideoFirstPollRecoveryCrontab
{
    public function __construct(
        private DesignVideoFirstPollRecoveryAppService $recoveryAppService,
        private LoggerInterface $logger,
    ) {
    }

    public function execute(): void
    {
        try {
            $this->recoveryAppService->recover();
        } catch (Throwable $throwable) {
            $this->logger->error('design video first poll recovery crontab failed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        }
    }
}

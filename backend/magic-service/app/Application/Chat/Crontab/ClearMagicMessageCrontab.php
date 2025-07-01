<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Crontab;

use Carbon\Carbon;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\Log\LoggerInterface;

// #[Crontab(rule: '*/1 * * * *', name: 'ClearMagicMessageCrontab', singleton: true, mutexExpires: 600, onOneServer: true, callback: 'execute', memo: '清理magicMessage')]
readonly class ClearMagicMessageCrontab
{
    public function __construct(
        private LoggerInterface $logger,
    ) {
    }

    public function execute(): void
    {
        $this->logger->info('ClearMagicMessageCrontab start');
        $time = Carbon::now()->subMinutes(30)->toDateTimeString();
        $this->clearMagicMessage($time);
        $this->logger->info('ClearMagicMessageCrontab success');
    }

    public function clearMagicMessage(string $time): void
    {
        // 录音功能已移除，此方法保留为空实现，可根据需要添加其他清理逻辑
        $this->logger->info(sprintf('ClearMagicMessageCrontab time: %s - recording functionality removed', $time));
    }
}

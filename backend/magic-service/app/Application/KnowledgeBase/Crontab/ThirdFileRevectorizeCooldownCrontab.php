<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Crontab;

use App\Application\KnowledgeBase\Service\ThirdFileRevectorizeCooldownAppService;
use Hyperf\Crontab\Annotation\Crontab;
use Psr\Log\LoggerInterface;
use Throwable;

#[Crontab(
    rule: '* * * * *',
    name: 'ThirdFileRevectorizeCooldownCrontab',
    singleton: true,
    mutexExpires: 55,
    onOneServer: true,
    callback: 'execute',
    memo: '派发冷却结束的第三方文件向量化通知',
)]
class ThirdFileRevectorizeCooldownCrontab
{
    public function __construct(
        private readonly ThirdFileRevectorizeCooldownAppService $service,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function execute(): void
    {
        try {
            $dispatched = $this->service->dispatchDue();
            if ($dispatched > 0) {
                $this->logger->info('Third-file revectorize cooldown tasks dispatched', [
                    'dispatched' => $dispatched,
                ]);
            }
        } catch (Throwable $throwable) {
            $this->logger->error('Third-file revectorize cooldown crontab failed', [
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}

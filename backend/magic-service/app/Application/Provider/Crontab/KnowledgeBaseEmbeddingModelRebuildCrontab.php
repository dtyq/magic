<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Crontab;

use App\Application\Provider\Service\KnowledgeBaseEmbeddingModelAbilityAppService;
use App\Infrastructure\Core\Traits\HasLogger;
use Hyperf\Crontab\Annotation\Crontab;
use Throwable;

#[Crontab(
    rule: '*/5 * * * *',
    name: 'KnowledgeBaseEmbeddingModelRebuildCrontab',
    singleton: true,
    mutexExpires: 300,
    onOneServer: true,
    callback: 'execute',
    memo: '知识库嵌入模型切换重建补偿'
)]
class KnowledgeBaseEmbeddingModelRebuildCrontab
{
    use HasLogger;

    public function __construct(
        private readonly KnowledgeBaseEmbeddingModelAbilityAppService $abilityAppService,
    ) {
    }

    public function execute(): void
    {
        try {
            $result = $this->abilityAppService->reconcilePendingRebuilds();
            if (($result['status'] ?? '') !== 'idle') {
                $this->logger->info('Knowledge base embedding model rebuild reconcile finished', $result);
            }
        } catch (Throwable $throwable) {
            $this->logger->error('Knowledge base embedding model rebuild crontab failed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\Service\MagicSeqDomainService;
use Throwable;

/**
 * 聊天消息相关.
 */
class MagicSeqAppService extends AbstractAppService
{
    public function __construct(protected MagicSeqDomainService $magicSeqDomainService)
    {
    }

    /**
     * 消息推送
     * @throws Throwable
     */
    public function pushSeq(string $seqId): void
    {
        $this->magicSeqDomainService->pushSeq($seqId);
    }
}

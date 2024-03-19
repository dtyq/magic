<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event\Agent;

use App\Domain\Chat\DTO\Agent\SenderExtraDTO;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Core\AbstractEvent;

/**
 * 用户给agent发了消息.
 */
class UserCallAgentEvent extends AbstractEvent
{
    public function __construct(
        public AccountEntity $agentAccountEntity,
        public MagicUserEntity $agentUserEntity,
        public AccountEntity $senderAccountEntity,
        public MagicUserEntity $senderUserEntity,
        public MagicSeqEntity $seqEntity,
        public ?MagicMessageEntity $messageEntity,
        public SenderExtraDTO $senderExtraDTO,
    ) {
    }
}

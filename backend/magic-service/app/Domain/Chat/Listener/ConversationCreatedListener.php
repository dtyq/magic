<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Listener;

use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Event\ConversationCreatedEvent;
use App\Domain\Chat\Service\MagicTopicDomainService;
use Hyperf\Event\Contract\ListenerInterface;

class ConversationCreatedListener implements ListenerInterface
{
    public function listen(): array
    {
        return [
            ConversationCreatedEvent::class,
        ];
    }

    /**
     * 处理会话创建事件.
     */
    public function process(object $event): void
    {
        if (! $event instanceof ConversationCreatedEvent) {
            return;
        }

        $conversation = $event->getConversation();

        // 仅为AI会话自动创建话题
        if ($conversation->getReceiveType() === ConversationType::Ai) {
            $topicDomainService = di(MagicTopicDomainService::class);
            $topicDomainService->agentSendMessageGetTopicId($conversation, 0);
        }
    }
}

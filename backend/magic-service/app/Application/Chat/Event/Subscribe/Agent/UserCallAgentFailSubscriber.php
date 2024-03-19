<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Event\Agent\UserCallAgentFailEvent;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Hyperf\Context\ApplicationContext;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Throwable;

use function Hyperf\Translation\__;

#[Listener]
class UserCallAgentFailSubscriber implements ListenerInterface
{
    public function __construct(
    ) {
    }

    public function listen(): array
    {
        return [
            UserCallAgentFailEvent::class,
        ];
    }

    public function process(object $event): void
    {
        /** @var UserCallAgentFailEvent $event */
        if (! $event instanceof UserCallAgentFailEvent) {
            return;
        }
        try {
            $seqEntity = $event->seqEntity;
            // 助理在自己的会话窗口，发一条国际化的失败提醒
            $conversationId = $seqEntity->getConversationId();
            $messageStruct = [
                'content' => __('chat.agent.user_call_agent_fail_notice'),
            ];
            // 消息防重
            $appMessageId = 'system-' . IdGenerator::getUniqueId32();
            $seqDTO = new MagicSeqEntity();
            // 表明引用关系
            $seqDTO->setReferMessageId($seqEntity->getMessageId());
            $seqDTO->setConversationId($conversationId);
            $messageInterface = MessageAssembler::getMessageStructByArray(ChatMessageType::Text->getName(), $messageStruct);
            $seqDTO->setContent($messageInterface);
            $seqDTO->setSeqType($messageInterface->getMessageTypeEnum());
            // 原样输出扩展参数
            $seqDTO->setExtra($seqEntity->getExtra());

            // 原样输出扩展参数,但是要排除 编辑消息选项
            $seqExtra = $seqEntity->getExtra()?->getExtraCanCopyData();
            $seqDTO->setExtra($seqExtra);
            di(MagicChatMessageAppService::class)->aiSendMessage($seqDTO, $appMessageId, doNotParseReferMessageId: true);
        } catch (Throwable $throwable) {
            $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
            $logger->error('UserCallAgentEventError', [
                'message' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
                'code' => $throwable->getCode(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\DTO\Message\ChatMessage\AIImageCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\ImageConvertHighCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Service\MagicChatDomainService;

use function di;

class AbstractAIImageAppService extends AbstractAppService
{
    protected function getReferContentForAIImage(string $referMessageId): ?MessageInterface
    {
        $magicChatDomainService = di(MagicChatDomainService::class);
        // 获取消息
        $referSeq = $magicChatDomainService->getSeqMessageByIds([$referMessageId])[0] ?? [];
        // 假如消息有引用，获取引用消息
        if (! empty($referSeq['refer_message_id'])) {
            $referSeq = $magicChatDomainService->getSeqMessageByIds([$referSeq['refer_message_id']])[0] ?? [];
        }
        // 获取引用消息文本内容
        $referMessage = $magicChatDomainService->getMessageByMagicMessageId($referSeq['magic_message_id'] ?? '');
        return $referMessage?->getContent();
    }

    protected function getReferTextByContentForAIImage(MessageInterface $content): ?string
    {
        if ($content instanceof AIImageCardMessage || $content instanceof ImageConvertHighCardMessage) {
            return $content->getReferText();
        }
        if ($content instanceof TextMessage) {
            return $content->getContent();
        }
        if ($content instanceof RichTextMessage) {
            return $content->getTextContent();
        }
        return null;
    }
}

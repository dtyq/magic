<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Chat;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamOptions;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use HyperfTest\Cases\BaseTest;
use Throwable;

/**
 * @internal
 */
class MagicMessageTest extends BaseTest
{
    /**
     * 测试ai往群里发消息.
     * @throws Throwable
     */
    public function testAgentSendMessage()
    {
        $appMessageId = IdGenerator::getUniqueId32();
        $receiveSeqDTO = new MagicSeqEntity();
        $messageContent = new TextMessage();
        $messageContent->setContent('测试消息');
        $receiveSeqDTO->setContent($messageContent);
        $receiveSeqDTO->setSeqType(ChatMessageType::Text);
        $receiveSeqDTO->setReferMessageId('');
        $groupId = '732608035268567040';
        $aiUserId = 'usi_054efed931890913cf7c0acfdc9e5831';
        di(MagicChatMessageAppService::class)->agentSendMessage($receiveSeqDTO, $aiUserId, $groupId, $appMessageId, receiverType: ConversationType::Group);
        $this->assertTrue(true);
    }

    /**
     * 测试模拟用户给agent 发消息.
     * @throws Throwable
     */
    public function testUserSendMessageToAgent()
    {
        $appMessageId = IdGenerator::getUniqueId32();
        $receiveSeqDTO = new MagicSeqEntity();
        $messageContent = new TextMessage();
        $messageContent->setContent('测试消息123123123213');
        $receiveSeqDTO->setContent($messageContent);
        $receiveSeqDTO->setSeqType(ChatMessageType::Text);
        $receiveSeqDTO->setReferMessageId('');
        $senderUserId = 'usi_3715ce50bc02d7e72ba7891649b7f1da';
        $receiveUserId = 'usi_155aa8a654422fae6672e5c9faf1f48e';
        di(MagicChatMessageAppService::class)->userSendMessageToAgent($receiveSeqDTO, $senderUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::Ai);
        $this->assertTrue(true);
    }

    /*
    * 测试 ai 流式消息发送.
     * @throws Throwable
     */
    public function testAgentStreamSendMessage()
    {
        $receiveUserId = 'usi_7839078ce6af2d3249b82e7aaed643b8';
        $aiUserId = 'usi_8e4bde5582491a6cabfe0d0ba8b7ae8e';
        $chatAppService = di(MagicChatMessageAppService::class);
        // 将多段流式消息，通过此 id 关联起来
        // ai 搜索卡片消息的多段响应，已经将 app_message_id 作为关联 id，流式响应需要另外的 id 来做关联
        $appMessageId = IdGenerator::getUniqueId32();
        $streamOptions = (new StreamOptions())->setStream(true)->setStreamAppMessageId($appMessageId)->setStatus(StreamMessageStatus::Start);
        $messageContent = new TextMessage();
        $messageContent->setContent('hello world');
        $messageContent->setStreamOptions($streamOptions);
        $receiveSeqDTO = (new MagicSeqEntity())
            ->setSeqType(ChatMessageType::Text)
            ->setReferMessageId('')
            ->setContent($messageContent);
        $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        for ($i = 0; $i < 2; ++$i) {
            $streamOptions->setStatus(StreamMessageStatus::Processing);
            $messageContent->setStreamOptions($streamOptions);
            $messageContent->setContent((string) $i);
            $receiveSeqDTO->setContent($messageContent);
            $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        }
        // 发送结束
        $streamOptions->setStatus(StreamMessageStatus::Completed);
        $messageContent->setContent('end');
        $messageContent->setStreamOptions($streamOptions);
        $receiveSeqDTO->setContent($messageContent);
        $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        $this->assertTrue(true);
    }
}

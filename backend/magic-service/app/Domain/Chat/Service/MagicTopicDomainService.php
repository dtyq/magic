<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\Message\ControlMessage\TopicCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicDeleteMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicUpdateMessage;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\DbConnection\Db;
use Throwable;

use function Hyperf\Translation\__;

/**
 * 处理消息流(seq)相关.
 */
class MagicTopicDomainService extends AbstractDomainService
{
    public function getMagicApiAccessToken(string $modelName)
    {
        $magicFlowAIModelEntity = $this->magicFlowAIModelRepository->getByName(FlowDataIsolation::create(), $modelName);
        if ($magicFlowAIModelEntity === null) {
            return '';
        }
        return $magicFlowAIModelEntity->getActualImplementationConfig()['access_token'] ?? '';
    }

    /**
     * 客户端主动操作后,分发此操作给接收方.
     * 注意此时的消息结构(各种id等)都是发起方的值.
     * @throws Throwable
     */
    public function dispatchMQTopicOperation(MagicSeqEntity $senderSeqEntity): ?MagicSeqEntity
    {
        Db::beginTransaction();
        try {
            $controlMessageType = $senderSeqEntity->getSeqType();
            $receiveTopicEntity = null;
            $receiveConversationEntity = null;
            switch ($controlMessageType) {
                case ControlMessageType::CreateTopic:
                    # 为对方创建一个新的话题
                    /** @var TopicCreateMessage $senderTopicCreateMessage */
                    $senderTopicCreateMessage = $senderSeqEntity->getContent();
                    $conversationId = $senderTopicCreateMessage->getConversationId();
                    // 会话双发的话题 id 保持一致
                    $topicId = $senderTopicCreateMessage->getId();
                    $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($conversationId);
                    if ($receiveConversationEntity === null) {
                        return null;
                    }
                    $receiveTopicDTO = new MagicTopicEntity();
                    $receiveTopicDTO->setTopicId($topicId);
                    $receiveTopicDTO->setConversationId($receiveConversationEntity->getId());
                    // 查询收件方的话题是否存在
                    $receiveTopicEntity = $this->magicChatTopicRepository->getTopicEntity($receiveTopicDTO);
                    // 如果不存在，为收件方创建话题
                    if ($receiveTopicEntity === null) {
                        $receiveTopicEntity = $this->createReceiveTopic($topicId, senderConversationId: $conversationId);
                    }
                    break;
                case ControlMessageType::UpdateTopic:
                    // 更新对方的话题
                    /** @var TopicUpdateMessage $senderTopicUpdateMessage */
                    $senderTopicUpdateMessage = $senderSeqEntity->getContent();
                    $receiveTopicEntity = $this->magicChatTopicRepository->getPrivateChatReceiveTopicEntity(
                        $senderTopicUpdateMessage->getId(),
                        $senderTopicUpdateMessage->getConversationId()
                    );
                    if ($receiveTopicEntity === null) {
                        return null;
                    }
                    $receiveTopicEntity->setName($senderTopicUpdateMessage->getName());
                    $receiveTopicEntity->setDescription($senderTopicUpdateMessage->getDescription());
                    $receiveTopicEntity = $this->magicChatTopicRepository->updateTopic($receiveTopicEntity);
                    break;
                case ControlMessageType::DeleteTopic:
                    // 删除双方的话题
                    /** @var TopicDeleteMessage $senderTopicDeleteMessage */
                    $senderTopicDeleteMessage = $senderSeqEntity->getContent();
                    $receiveTopicEntity = $this->magicChatTopicRepository->getPrivateChatReceiveTopicEntity(
                        $senderTopicDeleteMessage->getId(),
                        $senderTopicDeleteMessage->getConversationId()
                    );
                    if ($receiveTopicEntity === null) {
                        return null;
                    }
                    $this->magicChatTopicRepository->deleteTopic($receiveTopicEntity);
                    break;
                default:
                    break;
            }
            if ($receiveTopicEntity && $receiveConversationEntity === null) {
                $receiveConversationEntity = $this->magicConversationRepository->getConversationById($receiveTopicEntity->getConversationId());
            }
            if ($receiveTopicEntity && $receiveConversationEntity) {
                // 获取收件方的 magic_id
                $receiveUserId = $receiveConversationEntity->getUserId();
                $receiveUserEntity = $this->magicUserRepository->getUserById($receiveUserId);
                if (! $receiveUserEntity?->getMagicId()) {
                    return null;
                }
                $senderSeqEntity = SeqAssembler::generateTopicChangeSeqEntity($senderSeqEntity, $receiveTopicEntity, $receiveUserEntity);
                // 为收件方生成一个seq,告知收件方,话题有变动
                $receiveSeqEntity = $this->magicSeqRepository->createSequence($senderSeqEntity->toArray());
            }
            return $receiveSeqEntity ?? null;
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        } finally {
            if (! isset($exception)) {
                Db::commit();
            }
        }
    }

    /**
     * 主动操作话题.
     * @return string 会话id
     * @throws Throwable
     */
    public function clientOperateTopic(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): string
    {
        $messageTypeEnum = $messageDTO->getMessageType();
        if (! in_array(
            $messageTypeEnum,
            [
                ControlMessageType::CreateTopic,
                ControlMessageType::UpdateTopic,
                ControlMessageType::DeleteTopic,
            ],
            true
        )) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        $seqContent = [];
        switch ($messageTypeEnum) {
            case ControlMessageType::CreateTopic:
                /** @var TopicCreateMessage $messageStruct */
                $messageStruct = $messageDTO->getContent();
                // 判断会话是否存在,是否属于当前用户
                $this->checkAndGetSelfConversation($messageStruct->getConversationId(), $dataIsolation);
                // todo 话题名称创建时允许为空,后续 ai 总结话题名称,推送给客户端
                $topicEntity = $this->userCreateTopicHandler($messageStruct, $dataIsolation);
                break;
            case ControlMessageType::UpdateTopic:
                /** @var TopicUpdateMessage $messageStruct */
                $messageStruct = $messageDTO->getContent();
                $topicEntity = $this->updateTopic($messageStruct, $dataIsolation);
                break;
            case ControlMessageType::DeleteTopic:
                /** @var TopicDeleteMessage $messageStruct */
                $messageStruct = $messageDTO->getContent();
                $topicDTO = new MagicTopicEntity();
                $topicDTO->setTopicId($messageStruct->getId());
                $topicDTO->setConversationId($messageStruct->getConversationId());
                $this->checkTopicBelong($topicDTO, $dataIsolation);
                $this->magicChatTopicRepository->deleteTopic($topicDTO);
                $seqContent = [
                    'id' => $messageStruct->getId(),
                    'conversation_id' => $messageStruct->getConversationId(),
                ];
                break;
            default:
                break;
        }
        if (isset($topicEntity)) {
            $seqContent = [
                'conversation_id' => $topicEntity->getConversationId(),
                'description' => $topicEntity->getDescription(),
                'id' => $topicEntity->getTopicId(),
                'name' => $topicEntity->getName(),
            ];
        }
        // 回写进控制消息中,便于客户端处理
        $contentChange = MessageAssembler::getControlMessageStruct($messageDTO->getMessageType(), $seqContent);
        $messageDTO->setContent($contentChange);
        $messageDTO->setMessageType($contentChange->getMessageTypeEnum());
        return $seqContent['conversation_id'] ?? '';
    }

    /**
     * 根据收件方或者发件方的会话 id + 话题 id，为收件方创建一个新的话题.
     */
    public function createReceiveTopic(string $topicId, string $senderConversationId = '', string $receiveConversationId = ''): ?MagicTopicEntity
    {
        // 为消息接收方创建话题
        if ($senderConversationId) {
            $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($senderConversationId);
        }
        if ($receiveConversationId) {
            $receiveConversationEntity = $this->magicConversationRepository->getConversationById($receiveConversationId);
        }
        if (! isset($receiveConversationEntity)) {
            return null;
        }
        $receiveTopicDTO = new MagicTopicEntity();
        $receiveTopicDTO->setTopicId($topicId);
        $receiveTopicDTO->setName('');
        $receiveTopicDTO->setConversationId($receiveConversationEntity->getId());
        $receiveTopicDTO->setOrganizationCode($receiveConversationEntity->getUserOrganizationCode());
        $receiveTopicDTO->setDescription('');
        // 为收件方创建一个新的话题
        return $this->magicChatTopicRepository->createTopic($receiveTopicDTO);
    }

    // 更新话题
    public function updateTopic(TopicUpdateMessage $messageStruct, DataIsolation $dataIsolation): MagicTopicEntity
    {
        $topicDTO = new MagicTopicEntity();
        $topicDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $topicDTO->setTopicId($messageStruct->getId());
        $topicDTO->setConversationId($messageStruct->getConversationId());
        $topicDTO->setName($messageStruct->getName());
        $topicDTO->setDescription($messageStruct->getDescription());
        $this->checkTopicBelong($topicDTO, $dataIsolation);
        return $this->magicChatTopicRepository->updateTopic($topicDTO);
    }

    /**
     * agent 发送消息时获取话题 id.
     * @param int $getType todo 0:默认话题 1:最近的话题 2:智能确定话题，暂时只支持默认话题 3 新增话题
     * @throws Throwable
     */
    public function agentSendMessageGetTopicId(MagicConversationEntity $senderConversationEntity, int $getType): string
    {
        Db::beginTransaction();
        try {
            if (in_array($senderConversationEntity->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)) {
                $receiverIdentity = new MagicConversationEntity();
                $receiverIdentity->setUserId($senderConversationEntity->getReceiveId());
                $receiverIdentity->setReceiveId($senderConversationEntity->getUserId());
                $receiverIdentity = $this->parsePrivateChatConversationReceiveType($receiverIdentity);
                $receiver = $this->magicConversationRepository->getConversationByIdentity($receiverIdentity);
                // The receiver side continues to suppress ConversationCreatedEvent.
                $receiver ??= $this->magicConversationRepository->addConversation($receiverIdentity);
            } else {
                $receiver = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($senderConversationEntity->getId());
                if ($receiver === null) {
                    ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
                }
            }
            $conversations = $this->lockConversationPair($senderConversationEntity->getId(), $receiver->getId());
            $defaultTopicId = null;
            if ($getType !== 3) {
                foreach ($conversations as $conversation) {
                    // Empty objects may not initialize ConversationExtra.defaultTopicId.
                    $topicId = $conversation->getExtra()?->toArray()['default_topic_id'] ?? '';
                    $topic = $topicId === '' ? null : $this->magicChatTopicRepository->getTopicForConversationForUpdate($conversation->getId(), $topicId);
                    if ($topic === null || ($defaultTopicId !== null && $defaultTopicId !== $topicId)) {
                        $defaultTopicId = null;
                        break;
                    }
                    $defaultTopicId = $topicId;
                }
            }
            if ($defaultTopicId === null) {
                $defaultTopicId = $this->insertConversationTopicPair($conversations);
                foreach ($conversations as $conversation) {
                    $this->magicConversationRepository->updateDefaultTopicId($conversation->getId(), $defaultTopicId);
                }
            }
            Db::commit();
            return $defaultTopicId;
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        }
    }

    /** Insert the two IM rows without locking or changing conversation defaults. */
    public function createConversationTopicPair(string $senderConversationId, string $receiverConversationId): string
    {
        $this->requireTopicTransaction();
        $sender = $this->magicConversationRepository->getConversationById($senderConversationId);
        $receiver = $this->magicConversationRepository->getConversationById($receiverConversationId);
        $this->validateConversationPair($sender, $receiver);
        return $this->insertConversationTopicPair([$sender, $receiver]);
    }

    /** Caller must commit immediately after this method. */
    public function setConversationDefaultTopicPair(string $senderConversationId, string $receiverConversationId, string $topicId): void
    {
        $conversations = $this->lockConversationPair($senderConversationId, $receiverConversationId);
        foreach ($conversations as $conversation) {
            $topic = $this->magicChatTopicRepository->getTopicForConversationForUpdate($conversation->getId(), $topicId);
            if ($topic === null || $topic->getOrganizationCode() !== $conversation->getUserOrganizationCode()) {
                ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
            }
        }
        foreach ($conversations as $conversation) {
            $this->magicConversationRepository->updateDefaultTopicId($conversation->getId(), $topicId);
        }
    }

    /** @return array<string, MagicConversationEntity> */
    private function lockConversationPair(string $senderConversationId, string $receiverConversationId): array
    {
        $this->requireTopicTransaction();
        $conversations = $this->magicConversationRepository->getConversationsByIdsForUpdate([$senderConversationId, $receiverConversationId]);
        $this->validateConversationPair($conversations[$senderConversationId] ?? null, $conversations[$receiverConversationId] ?? null);
        return $conversations;
    }

    private function validateConversationPair(?MagicConversationEntity $sender, ?MagicConversationEntity $receiver): void
    {
        if ($sender === null || $receiver === null || $sender->getId() === $receiver->getId()
            || $sender->getUserId() !== $receiver->getReceiveId() || $sender->getReceiveId() !== $receiver->getUserId()
            || $sender->getUserOrganizationCode() !== $receiver->getReceiveOrganizationCode()
            || $sender->getReceiveOrganizationCode() !== $receiver->getUserOrganizationCode()
            || ! in_array($sender->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)
            || ! in_array($receiver->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话对不存在或身份不匹配');
        }
    }

    /** @param MagicConversationEntity[] $conversations */
    private function insertConversationTopicPair(array $conversations): string
    {
        $topicId = (string) IdGenerator::getSnowId();
        foreach ($conversations as $conversation) {
            $topic = new MagicTopicEntity();
            $topic->setConversationId($conversation->getId());
            $topic->setTopicId($topicId);
            $topic->setOrganizationCode($conversation->getUserOrganizationCode());
            $topic->setName(__('chat.topic.system_default_topic'));
            $topic->setDescription('');
            $this->magicChatTopicRepository->createTopic($topic);
        }
        return $topicId;
    }

    private function requireTopicTransaction(): void
    {
        if (Db::connection()->transactionLevel() < 1) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '话题创建及默认话题更新必须在事务内执行');
        }
    }

    private function checkTopicBelong(MagicTopicEntity $topicDTO, DataIsolation $dataIsolation): void
    {
        // 判断话题id所属的会话id是否是当前用户的
        $topicEntity = $this->magicChatTopicRepository->getTopicEntity($topicDTO);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
        }
        $this->checkAndGetSelfConversation($topicEntity->getConversationId(), $dataIsolation);
    }
}

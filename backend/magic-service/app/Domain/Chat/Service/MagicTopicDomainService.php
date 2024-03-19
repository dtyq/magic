<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\Message\ControlMessage\TopicCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicDeleteMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicUpdateMessage;
use App\Domain\Chat\Entity\Items\ConversationExtra;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Codec\Json;
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
        $receiverConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($senderConversationEntity->getId());
        // 为收件方创建会话，但是不再触发 ConversationCreatedEvent 事件，避免事件循环
        if (($receiverConversationEntity === null) && in_array($senderConversationEntity->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)) {
            $conversationDTO = new MagicConversationEntity();
            $conversationDTO->setUserId($senderConversationEntity->getReceiveId());
            $conversationDTO->setReceiveId($senderConversationEntity->getUserId());
            # 创建会话窗口
            $conversationDTO = $this->parsePrivateChatConversationReceiveType($conversationDTO);
            # 准备生成一个会话窗口
            $receiverConversationEntity = $this->magicConversationRepository->addConversation($conversationDTO);
        }
        $senderTopicId = $this->checkDefaultTopicExist($senderConversationEntity);
        $receiverTopicId = $this->checkDefaultTopicExist($receiverConversationEntity);
        $defaultTopicId = $senderTopicId;
        // 如果 $getType 为新增话题，则默认创建话题，而不是默认话题
        if ($getType === 3) {
            $senderTopicId = '';
        }
        // 收发双方只要有一个的默认话题不存在,或者不在同一个默认话题，就需要创建
        if (empty($senderTopicId) || empty($receiverTopicId) || $senderTopicId !== $receiverTopicId) {
            Db::beginTransaction();
            try {
                // 为收发双方同时创建一个默认话题
                $defaultTopicId = (string) IdGenerator::getSnowId();
                $this->createAndUpdateDefaultTopic($senderConversationEntity, $defaultTopicId);
                $this->createAndUpdateDefaultTopic($receiverConversationEntity, $defaultTopicId);
                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        }
        return $defaultTopicId;
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

    /**
     * 检查默认话题是否存在.
     */
    private function checkDefaultTopicExist(MagicConversationEntity $conversationEntity): ?string
    {
        // 判断有没有默认话题的标签
        $topicId = $conversationEntity->getExtra()?->getDefaultTopicId();
        if (empty($topicId)) {
            return null;
        }
        // 判断默认话题被删了没有
        $topicEntities = $this->magicChatTopicRepository->getTopicsByConversationId($conversationEntity->getId(), [$topicId]);
        return ($topicEntities[0] ?? null)?->getTopicId();
    }

    /**
     * 创建并更新默认话题.
     */
    private function createAndUpdateDefaultTopic(MagicConversationEntity $conversationEntity, string $defaultTopicId): void
    {
        $topicDTO = new MagicTopicEntity();
        $topicDTO->setConversationId($conversationEntity->getId());
        $topicDTO->setTopicId($defaultTopicId);
        $topicDTO->setOrganizationCode($conversationEntity->getUserOrganizationCode());
        $topicDTO->setName(__('chat.topic.system_default_topic'));
        $topicDTO->setDescription('');
        $this->magicChatTopicRepository->createTopic($topicDTO);
        // 将默认话题id回写进会话窗口
        $senderConversationExtra = $conversationEntity->getExtra();
        if ($senderConversationExtra === null) {
            $senderConversationExtra = new ConversationExtra();
        }
        $senderConversationExtra->setDefaultTopicId($defaultTopicId);
        $this->magicConversationRepository->updateConversationById($conversationEntity->getId(), [
            'extra' => Json::encode($senderConversationExtra->toArray()),
        ]);
    }
}

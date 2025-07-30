<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\Agent\SenderExtraDTO;
use App\Domain\Chat\DTO\Message\ControlMessage\AddFriendMessage;
use App\Domain\Chat\DTO\Request\Common\ControlRequestData;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use App\Domain\Chat\Event\Agent\UserCallAgentFailEvent;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Coroutine\Coroutine;
use RuntimeException;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 处理消息流(seq)相关.
 */
class MagicSeqDomainService extends AbstractDomainService
{
    /**
     * 消息推送. 对已经生成的seq,推送给seq的拥有者.
     * @throws Throwable
     */
    public function pushSeq(string $seqId): void
    {
        $seqEntity = null;
        // 查seq,失败延迟后重试3次
        retry(3, function () use ($seqId, &$seqEntity) {
            $seqEntity = $this->magicSeqRepository->getSeqByMessageId($seqId);
            if ($seqEntity === null) {
                // 可能是事务还未提交,mq已经消费,延迟重试
                ExceptionBuilder::throw(ChatErrorCode::SEQ_NOT_FOUND);
            }
        }, 100);
        if ($seqEntity === null) {
            $this->logger->error('messagePush seq not found:{seq_id} ', ['seq_id' => $seqId]);
            return;
        }
        $this->setRequestId($seqEntity->getAppMessageId());
        $this->logger->info(sprintf('messagePush 准备开始推送 seq:%s seqEntity:%s ', $seqId, Json::encode($seqEntity->toArray())));
        // 判断消息类型,是控制消息,还是聊天消息
        $seqUserEntity = $this->magicUserRepository->getUserByAccountAndOrganization($seqEntity->getObjectId(), $seqEntity->getOrganizationCode());
        if ($seqUserEntity === null) {
            $this->logger->error('messagePush magic_id:{magic_id} user not found', ['magic_id' => $seqEntity->getObjectId()]);
            return;
        }

        if ($seqEntity->getSeqType() instanceof ControlMessageType) {
            // 推送控制消息. 控制消息一般没有 messageEntity (聊天消息实体)
            $this->pushControlSeq($seqEntity, $seqUserEntity);
        } else {
            $messageEntity = $this->magicMessageRepository->getMessageByMagicMessageId($seqEntity->getMagicMessageId());
            if ($messageEntity === null) {
                $this->logger->error('messagePush magic_message_id:{magic_message_id} message not found', ['magic_message_id' => $seqEntity->getMagicMessageId()]);
                return;
            }
            // 以下是聊天消息推送
            $this->pushChatSeq($seqEntity, $seqUserEntity, $messageEntity);
        }
    }

    /**
     * 对已经生成的seq,推送给seq的拥有者.
     */
    public function pushControlSeq(MagicSeqEntity $seqEntity, MagicUserEntity $seqUserEntity, ?MagicMessageEntity $messageEntity = null): void
    {
        // 有些控制消息,不仅控制自己的设备,还需要控制对方的设备
        // 控制消息推送. todo:待优化,合并推送已读的控制消息
        if ($seqEntity->getObjectType() === ConversationType::User && ($seqEntity->getSeqType() instanceof ControlMessageType)) {
            SocketIOUtil::sendSequenceId($seqEntity);
        }

        if ($seqEntity->getObjectType() === ConversationType::Ai && ($seqEntity->getSeqType() instanceof ControlMessageType)) {
            // 如果是给AI的需要触发flow流程的控制消息，触发flow流程
            $agentUserEntity = $seqUserEntity; // 此时的 seqUserEntity 是 AI
            $agentAccountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($agentUserEntity->getMagicId());
            if ($agentAccountEntity === null) {
                $this->logger->error('UserCallAgentEventError magic_id:{magic_id} ai not found', ['magic_id' => $agentUserEntity->getMagicId()]);
                return;
            }
            $senderUserEntity = null; // （人类）发送方的 user_entity
            if ($seqEntity->getConversationId()) {
                // 这里的会话窗口是 ai自己的，那么对方是人类（也可能是另一个 ai，如果存在 ai 互撩的话）
                $conversationEntity = $this->magicConversationRepository->getConversationById($seqEntity->getConversationId());
                if ($conversationEntity === null) {
                    $this->logger->error('UserCallAgentEventError magic_conversation_id:{magic_conversation_id} conversation not found', ['magic_conversation_id' => $seqEntity->getConversationId()]);
                    return;
                }
                $senderUserEntity = $this->magicUserRepository->getUserById($conversationEntity->getReceiveId());
            } elseif ($seqEntity->getSeqType() === ControlMessageType::AddFriendSuccess) {
                // 因为加好友没有会话窗口，所以需要根据消息的发送id查出对方的 user_entity
                /** @var AddFriendMessage $seqContent */
                $seqContent = $seqEntity->getContent();
                $senderUserEntity = $this->magicUserRepository->getUserById($seqContent->getUserId());
            }
            if ($senderUserEntity) {
                $this->userCallFlow($agentAccountEntity, $agentUserEntity, $senderUserEntity, $seqEntity);
            }
        }
    }

    /**
     * 对已经生成的seq,推送给seq的拥有者.
     * @throws Throwable
     */
    public function pushChatSeq(MagicSeqEntity $selfSeqEntity, MagicUserEntity $userEntity, MagicMessageEntity $messageEntity): void
    {
        // 如果序列号归属于 ai,且发件人是 ai,不需要推送
        if ($selfSeqEntity->getObjectType() === ConversationType::Ai && $messageEntity->getSenderType() === ConversationType::Ai) {
            $this->logger->error(sprintf('UserCallAgentEventError seq:%s 序列号归属于 ai,且发件人是 ai,不需要推送', Json::encode($selfSeqEntity->toArray())));
            return;
        }
        $receiveConversationType = $selfSeqEntity->getObjectType();
        $magicId = $selfSeqEntity->getObjectId();
        switch ($receiveConversationType) {
            case ConversationType::Ai:
                $aiAccountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($magicId);
                if ($aiAccountEntity === null) {
                    $this->logger->error('UserCallAgentEventError magic_id:{magic_id} ai not found', ['magic_id' => $magicId]);
                    return;
                }
                $senderUserEntity = $this->magicUserRepository->getUserById($messageEntity->getSenderId());
                // 消息发送者没有找到
                if ($senderUserEntity === null || empty($selfSeqEntity->getSenderMessageId())) {
                    $this->logger->error('UserCallAgentEventError magic_message_id:{magic_message_id} sender_message_id not found', ['magic_message_id' => $selfSeqEntity->getMagicMessageId()]);
                    return;
                }
                $messageSenderMagicId = $this->magicUserRepository->getUserById($messageEntity->getSenderId())?->getMagicId();
                if ($magicId === $messageSenderMagicId) {
                    // ai 自己发的消息,不能再触发流程调用!
                    $this->logger->error('UserCallAgentEventError magic_id:{magic_id} ai can not call flow', ['magic_id' => $magicId]);
                    return;
                }
                try {
                    # ai 发送已读回执
                    $this->aiSendReadStatusChangeReceipt($selfSeqEntity, $userEntity);
                    # 调用 flow
                    // todo 可以做 优化flow响应成功率: 同步等待flow执行,细致判断,对于本seq_id,上次flow的响应是否超时,如果是,直接丢弃,不再发给flow
                    $this->userCallFlow($aiAccountEntity, $userEntity, $senderUserEntity, $selfSeqEntity);
                } catch (Throwable $throwable) {
                    $this->logger->error('UserCallAgentEventError', [
                        'message' => $throwable->getMessage(),
                        'file' => $throwable->getFile(),
                        'line' => $throwable->getLine(),
                        'code' => $throwable->getCode(),
                        'trace' => $throwable->getTraceAsString(),
                    ]);
                    throw $throwable;
                }
                break;
            case ConversationType::User:
                // todo 一定要做! 发布订阅用rabbitmq实现,不再用redis的pub/sub. 同时,推送后需要客户端返回ack,然后更新seq的状态
                // todo 一定要做! 只推seq_id,发布订阅收到seq_id后,再去数据库查seq详情,再推给客户端
                $pushData = SeqAssembler::getClientSeqStruct($selfSeqEntity, $messageEntity)->toArray();
                // 不打印敏感信息
                $pushLogData = [
                    'magic_id' => $pushData['seq']['magic_id'],
                    'seq_id' => $pushData['seq']['seq_id'],
                    'message_id' => $pushData['seq']['message_id'],
                    'refer_message_id' => $pushData['seq']['refer_message_id'],
                    'sender_message_id' => $pushData['seq']['sender_message_id'],
                    'conversation_id' => $pushData['seq']['conversation_id'],
                    'organization_code' => $pushData['seq']['organization_code'],
                    'magic_message_id' => $selfSeqEntity->getMagicMessageId(),
                    'app_message_id' => $selfSeqEntity->getAppMessageId(),
                    'topic_id' => $pushData['seq']['message']['topic_id'] ?? '',
                    'sender_id' => $pushData['seq']['message']['sender_id'] ?? '',
                    'message_type' => $pushData['seq']['message']['type'] ?? '',
                ];
                $this->logger->info(sprintf('messagePush to:"%s" pushData:"%s"', $magicId, Json::encode($pushLogData)));
                SocketIOUtil::sendSequenceId($selfSeqEntity);
                break;
            case ConversationType::Group:
                throw new RuntimeException('To be implemented');
            case ConversationType::System:
                throw new RuntimeException('To be implemented');
            case ConversationType::CloudDocument:
                throw new RuntimeException('To be implemented');
            case ConversationType::MultidimensionalTable:
                throw new RuntimeException('To be implemented');
            case ConversationType::Topic:
                throw new RuntimeException('To be implemented');
            case ConversationType::App:
                throw new RuntimeException('To be implemented');
        }
    }

    /**
     * Get seq entity list by magic_message_id.
     * A magic_message_id will create seq entities for both sender and receiver.
     *
     * @param string $magicMessageId The magic_message_id
     * @return MagicSeqEntity[] Array of seq entities
     */
    public function getSeqEntitiesByMagicMessageId(string $magicMessageId): array
    {
        if (empty($magicMessageId)) {
            return [];
        }

        $seqList = $this->magicSeqRepository->getBothSeqListByMagicMessageId($magicMessageId);

        $seqEntities = [];
        foreach ($seqList as $seqData) {
            $seqEntities[] = SeqAssembler::getSeqEntity($seqData);
        }

        return $seqEntities;
    }

    /**
     * Get the minimum seq_id record for the same user (object_id) based on magic_message_id
     * Used to find the original message when there are multiple edited versions.
     */
    public function getSelfMinSeqIdByMagicMessageId(MagicSeqEntity $magicSeqEntity): ?MagicSeqEntity
    {
        // Get all seq records with minimum seq_id for each user
        $seqList = $this->magicSeqRepository->getMinSeqListByMagicMessageId($magicSeqEntity->getMagicMessageId());

        if (empty($seqList)) {
            return null;
        }

        // Find the record belonging to the same user (object_id)
        $targetObjectId = $magicSeqEntity->getObjectId();
        foreach ($seqList as $seqData) {
            if ($seqData['object_id'] === $targetObjectId) {
                // Convert array data to MagicSeqEntity object
                return SeqAssembler::getSeqEntity($seqData);
            }
        }

        return null;
    }

    private function setRequestId(string $appMsgId): void
    {
        // 使用 app_msg_id 做 request_id
        $requestId = empty($appMsgId) ? IdGenerator::getSnowId() : $appMsgId;
        CoContext::setRequestId((string) $requestId);
    }

    /**
     * 发送已读回执.
     */
    private function aiSendReadStatusChangeReceipt(MagicSeqEntity $selfSeqEntity, MagicUserEntity $userEntity): void
    {
        $userAuth = new MagicUserAuthorization();
        $userAuth->setId($userEntity->getUserId());
        $userAuth->setOrganizationCode($selfSeqEntity->getOrganizationCode());
        // 消息的type和content抽象出来
        $messageDTO = $this->getControlMessageDTO($userAuth, $selfSeqEntity);
        // 根据消息类型,分发到对应的处理模块
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentOrganizationCode($userAuth->getOrganizationCode());
        $dataIsolation->setCurrentUserId($userAuth->getId());
        $dataIsolation->setUserType(UserType::Ai);
        try {
            $this->clientOperateMessageStatus($messageDTO, $dataIsolation);
        } catch (Throwable $exception) {
            $this->logger->error(sprintf(
                'UserCallAgentEventError aiSendReadStatusChangeReceipt error file:%s line:%s message:%s trace:%s',
                $exception->getFile(),
                $exception->getLine(),
                $exception->getMessage(),
                $exception->getTraceAsString()
            ));
        }
    }

    private function getControlMessageDTO(MagicUserAuthorization $userAuth, MagicSeqEntity $selfSeqEntity): MagicMessageEntity
    {
        $messageTypeString = ControlMessageType::SeenMessages->getName();
        $ControlRequestData = new ControlRequestData(
            [
                'message' => [
                    'type' => $messageTypeString,
                    $messageTypeString => [
                        'refer_message_ids' => [$selfSeqEntity->getSeqId()],
                    ],
                    'app_message_id' => IdGenerator::getUniqueId32(),
                ],
                'refer_message_id' => $selfSeqEntity->getSeqId(),
            ]
        );
        $content = $ControlRequestData->getMessage()->getMagicMessage();
        $messageType = $ControlRequestData->getMessage()->getMagicMessage()->getMessageTypeEnum();
        // 控制消息的接收方,需要根据控制消息的类型再确定,因此不在此处处理
        $time = date('Y-m-d H:i:s');
        $messageDTO = new MagicMessageEntity();
        $messageDTO->setSenderId($userAuth->getId());
        $messageDTO->setSenderType(ConversationType::Ai);
        $messageDTO->setSenderOrganizationCode($userAuth->getOrganizationCode());
        $messageDTO->setAppMessageId(IdGenerator::getUniqueId32());
        // 消息的type和content抽象出来
        $messageDTO->setContent($content);
        $messageDTO->setMessageType($messageType);
        $messageDTO->setSendTime($time);
        $messageDTO->setCreatedAt($time);
        $messageDTO->setUpdatedAt($time);
        $messageDTO->setDeletedAt(null);
        return $messageDTO;
    }

    /**
     * 协程调用magic flow,处理用户发来的消息.
     */
    private function userCallFlow(AccountEntity $agentAccountEntity, MagicUserEntity $agentUserEntity, MagicUserEntity $senderUserEntity, MagicSeqEntity $seqEntity): void
    {
        if (empty($agentAccountEntity->getAiCode())) {
            ExceptionBuilder::throw(ChatErrorCode::AI_NOT_FOUND);
        }
        // 获取messageEntity
        $messageEntity = $this->magicMessageRepository->getMessageByMagicMessageId($seqEntity->getMagicMessageId());

        // 只有聊天消息和已读回执才触发flow
        $messageType = $messageEntity?->getMessageType();
        if ($messageType instanceof ChatMessageType || $seqEntity->canTriggerFlow()) {
            // 获取用户的真名
            $senderAccountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($senderUserEntity->getMagicId());
            // 开协程了，复制 requestId
            $requestId = CoContext::getRequestId();
            // 协程透传语言
            $language = di(TranslatorInterface::class)->getLocale();

            $this->logger->info('userCallFlow language: ' . $language);
            // 调用flow可能很耗时,不能让客户端一直等待
            Coroutine::create(function () use (
                $agentAccountEntity,
                $agentUserEntity,
                $senderAccountEntity,
                $senderUserEntity,
                $seqEntity,
                $messageEntity,
                $requestId,
                $language
            ) {
                $requestId = empty($requestId) ? $seqEntity->getAppMessageId() : $requestId;
                CoContext::setRequestId($requestId);
                di(TranslatorInterface::class)->setLocale($language);
                $this->logger->info('Coroutine  create userCallFlow language: ' . di(TranslatorInterface::class)->getLocale());
                try {
                    // 触发事件
                    event_dispatch(new UserCallAgentEvent(
                        $agentAccountEntity,
                        $agentUserEntity,
                        $senderAccountEntity,
                        $senderUserEntity,
                        $seqEntity,
                        $messageEntity,
                        (new SenderExtraDTO())->setMagicEnvId($seqEntity->getExtra()?->getMagicEnvId())
                    ));
                } catch (Throwable $throwable) {
                    $this->logger->error('UserCallAgentEventError', [
                        'message' => $throwable->getMessage(),
                        'file' => $throwable->getFile(),
                        'line' => $throwable->getLine(),
                        'code' => $throwable->getCode(),
                        'trace' => $throwable->getTraceAsString(),
                    ]);
                    // 回一条国际化的报错消息
                    event_dispatch(new UserCallAgentFailEvent($seqEntity));
                }
            });
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Application\Chat\Event\Publish\MessageDispatchPublisher;
use App\Application\Chat\Event\Publish\MessagePushPublisher;
use App\Domain\Chat\DTO\Message\ControlMessage\MessageRevoked;
use App\Domain\Chat\DTO\Message\ControlMessage\MessagesSeen;
use App\Domain\Chat\DTO\Message\ControlMessage\TopicCreateMessage;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\MagicTopicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessagePriority;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Event\Seq\SeqCreatedEvent;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatFileRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatMessageVersionsRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicChatTopicRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicFriendRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicStreamMessageRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\MagicContactIdMappingRepository;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserIdRelationRepositoryInterface;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Domain\Group\Repository\Facade\MagicGroupRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\EnvironmentRepositoryInterface;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationsEnvironmentRepositoryInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Locker\RedisLocker;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Amqp\Producer;
use Hyperf\Cache\Driver\MemoryDriver;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\SocketIOServer\SocketIO;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Coroutine\co;

abstract class AbstractDomainService
{
    protected readonly MemoryDriver $memoryDriver;

    public function __construct(
        protected MagicUserRepositoryInterface $magicUserRepository,
        protected MagicMessageRepositoryInterface $magicMessageRepository,
        protected MagicChatSeqRepositoryInterface $magicSeqRepository,
        protected MagicAccountRepositoryInterface $magicAccountRepository,
        protected IdGeneratorInterface $idGenerator,
        protected SocketIO $socketIO,
        protected MagicChatConversationRepositoryInterface $magicConversationRepository,
        protected RedisLocker $redisLocker,
        protected Producer $producer,
        protected Redis $redis,
        protected MagicChatTopicRepositoryInterface $magicChatTopicRepository,
        protected MagicGroupRepositoryInterface $magicGroupRepository,
        protected MagicChatFileRepositoryInterface $magicFileRepository,
        protected LoggerInterface $logger,
        protected MagicStreamMessageRepositoryInterface $magicStreamMessageRepository,
        protected readonly MagicUserRepositoryInterface $userRepository,
        protected readonly MagicFriendRepositoryInterface $friendRepository,
        protected readonly MagicAccountRepositoryInterface $accountRepository,
        protected readonly MagicUserIdRelationRepositoryInterface $userIdRelationRepository,
        protected readonly MagicContactIdMappingRepositoryInterface $contactThirdPlatformIdMappingRepository,
        protected readonly MagicContactIdMappingRepository $contactIdMappingRepository,
        protected readonly OrganizationsEnvironmentRepositoryInterface $magicOrganizationsEnvironmentRepository,
        protected readonly MagicTokenRepositoryInterface $magicTokenRepository,
        protected readonly LockerInterface $locker,
        protected readonly EnvironmentRepositoryInterface $magicEnvironmentsRepository,
        protected readonly MagicFlowAIModelRepositoryInterface $magicFlowAIModelRepository,
        protected readonly CloudFileRepositoryInterface $cloudFileRepository,
        protected readonly MagicChatMessageVersionsRepositoryInterface $magicChatMessageVersionsRepository,
        protected ContainerInterface $container
    ) {
        try {
            $this->logger = $this->container->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
        $this->memoryDriver = new MemoryDriver($container, [
            'prefix' => 'magic-chat:',
            'skip_cache_results' => [null, '', []],
            // 1GB
            'size' => 1024 * 1024 * 1024,
            'throw_when_size_exceeded' => true,
        ], );
    }

    /**
     * 消息分发模块.
     * 将发件方的消息投递到mq中,用于后续按消息优先级,投递到收件方的消息流中.
     */
    public function dispatchSeq(SeqCreatedEvent $seqCreatedEvent): void
    {
        // 降低响应延迟,尽快给客户端返回响应.
        $controlMessageCreatedMq = new MessageDispatchPublisher($seqCreatedEvent);
        if (! $this->producer->produce($controlMessageCreatedMq)) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_SEND_FAILED);
        }
        $this->logger->info('DispatchMessage message:{message}', ['message' => Json::encode($seqCreatedEvent)]);
    }

    public function getMessageByMagicMessageId(string $magicMessageId): ?MagicMessageEntity
    {
        return $this->magicMessageRepository->getMessageByMagicMessageId($magicMessageId);
    }

    public function getSeqContent(MagicMessageEntity $messageEntity): array
    {
        // 节约存储空间,聊天消息在seq表不存具体内容,只存消息id
        if ($messageEntity->getMessageType() instanceof ControlMessageType) {
            $content = $messageEntity->getContent()->toArray();
        } else {
            $content = [];
        }
        return $content;
    }

    /**
     * 通知收件方有新消息(收件方可能是自己,或者是chat对象).
     * @todo 考虑对 seqIds 合并同类项,减少push次数,减轻网络/mq/服务器压力
     */
    public function pushControlSequence(MagicSeqEntity $seqEntity): SeqCreatedEvent
    {
        $seqCreatedEvent = $this->getControlSeqCreatedEvent($seqEntity);
        // 投递消息
        $seqCreatedPublisher = new MessagePushPublisher($seqCreatedEvent);
        if (! $this->producer->produce($seqCreatedPublisher)) {
            $this->logger->error(sprintf(
                'pushMessage seqType:%s failed message:%s',
                Json::encode($seqCreatedEvent),
                $seqEntity->getSeqType()->getName()
            ));
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_DELIVERY_FAILED);
        }
        $this->logger->info('pushMessage message:' . Json::encode($seqCreatedEvent));
        return $seqCreatedEvent;
    }

    /**
     * 批量推送消息.
     * 将多个 seq_id 合并为一条 mq 消息进行推送
     */
    public function batchPushSeq(array $seqIds, MessagePriority $messagePriority): void
    {
        $seqCreatedEvent = new SeqCreatedEvent($seqIds);
        $seqCreatedEvent->setPriority($messagePriority);
        $seqCreatedPublisher = new MessagePushPublisher($seqCreatedEvent);
        if (! $this->producer->produce($seqCreatedPublisher)) {
            $this->logger->error(sprintf('batchDispatchSeq failed seqIds:%s  message:%s', Json::encode($seqIds), Json::encode($seqCreatedEvent)));
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_DELIVERY_FAILED);
        }
    }

    /**
     * 批量分发消息:提高性能,合并多个 seq_id 为一条消息,减少消息推送次数.
     */
    public function batchDispatchSeq(array $seqIds, MessagePriority $messagePriority): void
    {
        $seqCreatedEvent = new SeqCreatedEvent($seqIds);
        $seqCreatedEvent->setPriority($messagePriority);
        $seqCreatedPublisher = new MessageDispatchPublisher($seqCreatedEvent);
        if (! $this->producer->produce($seqCreatedPublisher)) {
            $this->logger->error(sprintf('batchDispatchSeq failed seqIds:%s  message:%s', Json::encode($seqIds), Json::encode($seqCreatedEvent)));
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_DELIVERY_FAILED);
        }
    }

    public function getControlSeqCreatedEvent(MagicSeqEntity $seqEntity): SeqCreatedEvent
    {
        $messagePriority = $this->getControlMessagePriority($seqEntity);
        $seqCreatedEvent = new SeqCreatedEvent([$seqEntity->getSeqId()]);
        $seqCreatedEvent->setPriority($messagePriority);
        return $seqCreatedEvent;
    }

    /**
     * 生成发件方的控制消息序列.(控制的是非聊天消息).
     * 由于存在序列号合并/删除的场景,所以不需要保证序列号的连续性.
     */
    public function generateSenderSequenceByControlMessage(MagicMessageEntity $messageDTO, string $conversationId = ''): MagicSeqEntity
    {
        $time = date('Y-m-d H:i:s');
        // 节约存储空间,聊天消息在seq表不存具体内容,只存消息id
        $content = $this->getSeqContent($messageDTO);
        $seqId = (string) IdGenerator::getSnowId();
        $senderAccountId = $this->getAccountId($messageDTO->getSenderId());
        $seqData = [
            'id' => $seqId,
            'organization_code' => $messageDTO->getSenderOrganizationCode(),
            'object_type' => $messageDTO->getSenderType()->value,
            'object_id' => $senderAccountId,
            'seq_id' => $seqId,
            'seq_type' => $messageDTO->getMessageType()->getName(),
            'content' => $content,
            'receive_list' => '',
            'magic_message_id' => '', // 控制消息不能有 magic_message_id
            'message_id' => $seqId,
            'refer_message_id' => '',
            'sender_message_id' => '',
            'conversation_id' => $conversationId,
            'status' => MagicMessageStatus::Read->value, // 发送方自己的消息,默认已读
            'created_at' => $time,
            'updated_at' => $time,
            'app_message_id' => $messageDTO->getAppMessageId(),
        ];
        return $this->magicSeqRepository->createSequence($seqData);
    }

    /**
     * 生成发件方的控制消息序列.(不是控制聊天消息).
     * 由于存在序列号合并/删除的场景,所以不需要保证序列号的连续性.
     */
    public function generateReceiveSequenceByControlMessage(MagicMessageEntity $messageDTO, MagicConversationEntity $receiveConversationEntity): MagicSeqEntity
    {
        $time = date('Y-m-d H:i:s');
        // 获取收件方的会话实体
        $receiveUserEntity = $this->magicUserRepository->getUserById($receiveConversationEntity->getUserId());
        if ($receiveUserEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }
        // 节约存储空间,聊天消息在seq表不存具体内容,只存消息id
        $content = $this->getSeqContent($messageDTO);
        $seqId = (string) IdGenerator::getSnowId();
        $receiverAccountId = $receiveUserEntity->getMagicId();
        $seqData = [
            'id' => $seqId,
            'organization_code' => $receiveConversationEntity->getUserOrganizationCode(),
            'object_type' => $receiveUserEntity->getUserType()->value,
            'object_id' => $receiverAccountId,
            'seq_id' => $seqId,
            'seq_type' => $messageDTO->getMessageType()->getName(),
            'content' => $content,
            'receive_list' => '',
            'magic_message_id' => '',
            'message_id' => $seqId,
            'refer_message_id' => '',
            'sender_message_id' => '',
            'conversation_id' => $receiveConversationEntity->getId(),
            'status' => MagicMessageStatus::Read->value, // 控制消息不需要已读回执
            'created_at' => $time,
            'updated_at' => $time,
            'app_message_id' => $messageDTO->getAppMessageId(),
        ];
        return $this->magicSeqRepository->createSequence($seqData);
    }

    /**
     * 系统稳定性保障模块之一:消息优先级的确定
     * 优先级规则:
     * 1.私聊/100人以内的群聊,优先级最高
     * 2.系统应用消息,高优先级
     * 3.api消息(第三方调用生成)/100~1000人群聊,中优先级
     * 4.控制消息/1000人以上的群聊,最低优先级.
     * 5.部分控制消息与聊天强相关的,可以把优先级提到高. 比如会话窗口的创建.
     */
    public function getControlMessagePriority(MagicSeqEntity $seqEntity, ?int $receiveUserCount = 1): MessagePriority
    {
        $messagePriority = MessagePriority::Low;
        // 部分控制消息与聊天强相关的,可以把优先级提到高. 比如私聊和人数小于100的已读回执
        $seqType = $seqEntity->getSeqType();
        if (! in_array($seqType, ControlMessageType::getMessageStatusChangeType(), true)) {
            return $messagePriority;
        }
        $conversationEntity = $this->magicConversationRepository->getConversationById($seqEntity->getConversationId());
        if (! isset($conversationEntity)) {
            return $messagePriority;
        }

        if (in_array($conversationEntity->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)) {
            // 私聊消息的已读回执,优先级最高
            $messagePriority = MessagePriority::High;
        } elseif ($receiveUserCount <= 100 && $seqEntity->getSeqType() === ControlMessageType::SeenMessages) {
            // 100人以内的群聊,优先级最高
            $messagePriority = MessagePriority::High;
        }
        return $messagePriority;
    }

    /**
     * 客户端 已读/已查看/撤回/编辑消息.
     * @throws Throwable
     */
    public function clientOperateMessageStatus(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): array
    {
        $messageType = $messageDTO->getMessageType();
        $batchResponse = [];
        // 每条消息发出时,就会在消息体中记录所有的接收方,以便后续的消息状态变更
        switch ($messageType) {
            case ControlMessageType::SeenMessages:
                /** @var MessagesSeen $messageStruct */
                $messageStruct = $messageDTO->getContent();
                $referMessageIds = $messageStruct->getReferMessageIds();
                // 获取每条消息的最终状态
                $messageStatusSeqEntities = $this->getReceiveMessageLatestReadStatus($referMessageIds, $dataIsolation);
                $userMessageStatusChangeSeqEntities = [];
                $needUpdateStatusSeqIds = [];
                foreach ($messageStatusSeqEntities as $messageStatusSeqEntity) {
                    if ($messageStatusSeqEntity->getSeqType() instanceof ChatMessageType && $messageStatusSeqEntity->getStatus() === MagicMessageStatus::Unread) {
                        $userMessageStatusChangeSeqEntities[] = SeqAssembler::generateReceiveStatusChangeSeqEntity(
                            $messageStatusSeqEntity,
                            ControlMessageType::SeenMessages
                        );
                        $needUpdateStatusSeqIds[] = $messageStatusSeqEntity->getId();
                    }
                }
                if (! empty($userMessageStatusChangeSeqEntities)) {
                    Db::beginTransaction();
                    try {
                        // 批量给自己生成状态变更的消息流序列
                        $this->magicSeqRepository->batchCreateSeq($userMessageStatusChangeSeqEntities);
                        // 更改数据库中消息的状态，避免新设备登录时显示未读
                        if (! empty($needUpdateStatusSeqIds)) {
                            $this->magicSeqRepository->batchUpdateSeqStatus($needUpdateStatusSeqIds, MagicMessageStatus::Seen);
                        }
                        $messagePriority = $this->getControlMessagePriority($userMessageStatusChangeSeqEntities[0], count($userMessageStatusChangeSeqEntities));
                        // 异步将生成的消息流通知用户的其他设备.
                        $seqIds = array_column($userMessageStatusChangeSeqEntities, 'id');
                        // 批量分发已读消息,给消息发送者
                        $this->batchDispatchSeq($seqIds, $messagePriority);
                        Db::commit();
                        $this->logger->info(sprintf('batchDispatchSeq 成功 seqIds:%s  $messagePriority:%s', Json::encode($seqIds), Json::encode($messagePriority)));
                    } catch (Throwable $exception) {
                        Db::rollBack();
                        throw $exception;
                    }
                    // 批量推送给自己的其他设备,让其他设备显示已读,不再重复发送回执
                    $this->batchPushSeq($seqIds, $messagePriority);
                }

                // 幂等,获取 refer_message_ids 的实时状态,及时响应客户端
                // 获取每条消息的最终状态
                $messageStatusSeqEntities = $this->getReceiveMessageLatestReadStatus($referMessageIds, $dataIsolation);
                foreach ($messageStatusSeqEntities as $userSeqEntity) {
                    // 格式化响应结构
                    $batchResponse[] = SeqAssembler::getClientSeqStruct($userSeqEntity, $messageDTO)->toArray();
                }
                break;
            case ControlMessageType::ReadMessage:
                // 如果消息的发送者不是人类,不用处理
                $messageEntity = $this->magicMessageRepository->getMessageByMagicMessageId($messageDTO->getMagicMessageId());
                if ($messageEntity === null || $messageEntity->getSenderType() !== ConversationType::User) {
                    return [];
                }
                break;
            case ControlMessageType::RevokeMessage:
                /** @var MessageRevoked $messageStruct */
                $messageStruct = $messageDTO->getContent();
                if (empty($messageStruct->getReferMessageId())) {
                    ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
                }
                $userEntity = $this->magicUserRepository->getUserById($dataIsolation->getCurrentUserId());
                if ($userEntity === null) {
                    ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
                }
                // 并发锁
                $mutexLockKey = 'chat:revoke_message:' . $messageStruct->getReferMessageId();
                $this->redisLocker->mutexLock($mutexLockKey, $messageStruct->getReferMessageId());
                try {
                    // 只能撤回自己发出的消息
                    $userSeqEntity = $this->magicSeqRepository->getSeqByMessageId($messageStruct->getReferMessageId());
                    if ($userSeqEntity === null || $userSeqEntity->getObjectId() !== $userEntity->getMagicId()) {
                        ExceptionBuilder::throw(ChatErrorCode::MESSAGE_NOT_FOUND);
                    }
                    // 查询消息是否已被撤回
                    $userRevokedSeqEntity = $this->magicSeqRepository->getMessageRevokedSeq(
                        $messageStruct->getReferMessageId(),
                        $userEntity,
                        ControlMessageType::RevokeMessage
                    );
                    if ($userRevokedSeqEntity === null) {
                        $userRevokedSeqEntity = SeqAssembler::generateReceiveStatusChangeSeqEntity(
                            $userSeqEntity,
                            ControlMessageType::RevokeMessage
                        );
                        Db::beginTransaction();
                        try {
                            // 修改原始 seq，标记已撤回
                            $this->magicSeqRepository->batchUpdateSeqStatus([$userSeqEntity->getId()], MagicMessageStatus::Revoked);
                            // 批量给自己生成状态变更的消息流序列
                            $this->magicSeqRepository->batchCreateSeq([$userRevokedSeqEntity]);
                            $messagePriority = $this->getControlMessagePriority($userRevokedSeqEntity);
                            // 更改数据库中消息的状态，避免新设备登录时显示未读
                            $this->magicSeqRepository->batchUpdateSeqStatus([$messageStruct->getReferMessageId()], MagicMessageStatus::Revoked);
                            // 异步将生成的消息流通知用户的其他设备.
                            $seqIds = [$userRevokedSeqEntity->getId()];
                            // 批量分发已读消息,给消息发送者
                            $this->batchDispatchSeq($seqIds, $messagePriority);
                            Db::commit();
                            $this->logger->info(sprintf('batchDispatchSeq 成功 seqIds:%s  $messagePriority:%s', Json::encode($seqIds), Json::encode($messagePriority)));
                        } catch (Throwable $exception) {
                            Db::rollBack();
                            throw $exception;
                        }
                        // 批量推送给自己的其他设备,让其他设备显示已读,不再重复发送回执
                        $this->batchPushSeq($seqIds, $messagePriority);
                    }
                    // 幂等,获取 refer_message_ids 的实时状态,及时响应客户端
                    // 格式化响应结构
                    $batchResponse[] = SeqAssembler::getClientSeqStruct($userRevokedSeqEntity, $messageDTO)->toArray();
                } finally {
                    // 释放锁
                    $this->redisLocker->release($mutexLockKey, $messageStruct->getReferMessageId());
                }
                break;
            default:
                ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        return $batchResponse;
    }

    /**
     * @param MagicSeqEntity[] $seqListCreateDTO
     */
    public function batchPushControlSeqList(array $seqListCreateDTO): void
    {
        $userSeqEntity = $seqListCreateDTO[array_key_first($seqListCreateDTO)];
        // 将这些 seq_id 合并为一条 mq 消息进行推送/消费
        $seqIds = [];
        foreach ($seqListCreateDTO as $seqEntity) {
            $seqIds[] = $seqEntity->getId();
        }
        $receiveUserCount = count($seqIds);
        $messagePriority = $this->getControlMessagePriority($userSeqEntity, $receiveUserCount);
        co(function () use ($seqIds, $messagePriority) {
            $this->batchPushSeq($seqIds, $messagePriority);
        });
    }

    public function getSeqEntityByMessageId(string $messageId): ?MagicSeqEntity
    {
        return $this->magicSeqRepository->getSeqByMessageId($messageId);
    }

    /**
     * 避免 seq 表承载太多功能,加太多索引,因此将话题的消息单独写入到 topic_messages 表中.
     */
    public function createTopicMessage(MagicSeqEntity $seqEntity, ?string $topicId = null): ?MagicTopicMessageEntity
    {
        if ($topicId === null) {
            $topicId = $seqEntity->getExtra()?->getTopicId();
        }
        if (empty($topicId)) {
            return null;
        }
        // 如果是编辑消息，不写入
        if (! empty($seqEntity->getExtra()?->getEditMessageOptions()?->getMagicMessageId())) {
            return null;
        }
        // 检查话题是否存在
        $topicDTO = new MagicTopicEntity();
        $topicDTO->setTopicId($topicId);
        $topicDTO->setConversationId($seqEntity->getConversationId());
        $topicEntity = $this->magicChatTopicRepository->getTopicEntity($topicDTO);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
        }
        $topicMessageDTO = new MagicTopicMessageEntity();
        $topicMessageDTO->setTopicId($topicId);
        $topicMessageDTO->setSeqId($seqEntity->getSeqId());
        $topicMessageDTO->setConversationId($seqEntity->getConversationId());
        $topicMessageDTO->setOrganizationCode($seqEntity->getOrganizationCode());
        $topicMessageDTO->setCreatedAt($seqEntity->getCreatedAt());
        $topicMessageDTO->setUpdatedAt($seqEntity->getUpdatedAt());
        $this->magicChatTopicRepository->createTopicMessage($topicMessageDTO);
        return $topicMessageDTO;
    }

    /**
     * 用户主动创建了话题的处理。
     * @throws Throwable
     */
    public function userCreateTopicHandler(TopicCreateMessage $messageStruct, DataIsolation $dataIsolation): MagicTopicEntity
    {
        Db::beginTransaction();
        try {
            $conversationId = $messageStruct->getConversationId();
            // 为消息发送方创建话题
            $topicDTO = new MagicTopicEntity();
            $topicDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $topicDTO->setConversationId($conversationId);
            $topicDTO->setName($messageStruct->getName());
            $topicDTO->setDescription($messageStruct->getDescription());
            $senderTopicEntity = $this->magicChatTopicRepository->createTopic($topicDTO);
            // 为消息接收方创建话题
            $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($conversationId);
            if ($receiveConversationEntity === null) {
                // 刚加好友，接收方的会话 id 还未生成
                return $senderTopicEntity;
            }
            $receiveTopicDTO = new MagicTopicEntity();
            $receiveTopicDTO->setTopicId($senderTopicEntity->getTopicId());
            $receiveTopicDTO->setName($senderTopicEntity->getName());
            $receiveTopicDTO->setConversationId($receiveConversationEntity->getId());
            $receiveTopicDTO->setOrganizationCode($receiveConversationEntity->getUserOrganizationCode());
            $receiveTopicDTO->setDescription($senderTopicEntity->getDescription());
            // 为收件方创建一个新的话题
            $this->magicChatTopicRepository->createTopic($receiveTopicDTO);
            return $senderTopicEntity;
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        } finally {
            if (! isset($exception)) {
                Db::commit();
            }
        }
    }

    public function parsePrivateChatConversationReceiveType(MagicConversationEntity $conversationDTO): MagicConversationEntity
    {
        $receiveId = $conversationDTO->getReceiveId();
        $senderId = $conversationDTO->getUserId();
        $receiveIdPrefix = explode('_', $receiveId, 2)[0] ?? '';
        $receiveType = UserIdType::getCaseFromPrefix($receiveIdPrefix);
        if ($receiveType === null) {
            ExceptionBuilder::throw(UserErrorCode::RECEIVE_TYPE_ERROR);
        }
        $senderUserEntity = $this->magicUserRepository->getUserById($senderId);
        $receiverUserEntity = $this->magicUserRepository->getUserById($receiveId);
        if ($receiverUserEntity === null || $senderUserEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }
        // 判断用户是ai还是人类
        $accountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($receiverUserEntity->getMagicId());
        if ($accountEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        $userType = $accountEntity->getType();
        switch ($userType) {
            case UserType::Ai:
                if (empty($accountEntity->getAiCode())) {
                    ExceptionBuilder::throw(ChatErrorCode::AI_NOT_FOUND);
                }
                $conversationDTO->setReceiveType(ConversationType::Ai);
                break;
            case UserType::Human:
                $conversationDTO->setReceiveType(ConversationType::User);
                break;
        }
        $conversationDTO->setReceiveOrganizationCode($receiverUserEntity->getOrganizationCode());
        $conversationDTO->setUserOrganizationCode($senderUserEntity->getOrganizationCode());
        return $conversationDTO;
    }

    /**
     * @throws Throwable
     */
    public function handleCommonControlMessage(MagicMessageEntity $messageDTO, ?MagicConversationEntity $conversationEntity, ?MagicConversationEntity $receiverConversationEntity = null): array
    {
        if ($conversationEntity === null) {
            return [];
        }
        Db::beginTransaction();
        try {
            // 根据 appMsgId,给这条消息创建 magicMsgId
            $messageDTO->setReceiveId($conversationEntity->getReceiveId());
            $messageDTO->setReceiveType($conversationEntity->getReceiveType());
            // 将会话id回写进控制消息中,便于客户端处理
            $content = $messageDTO->getContent()->toArray();
            $content['id'] = $conversationEntity->getId();
            $contentChange = MessageAssembler::getMessageStructByArray(
                $messageDTO->getMessageType()->getName(),
                $content
            );
            $messageDTO->setContent($contentChange);
            $messageDTO->setMessageType($contentChange->getMessageTypeEnum());
            // 给自己的消息流生成序列.
            $seqEntity = $this->generateSenderSequenceByControlMessage($messageDTO, $conversationEntity->getId());
            $seqEntity->setConversationId($conversationEntity->getId());
            // 群聊需要给群成员创建会话窗口
            if ($conversationEntity->getReceiveType() === ConversationType::Group || $messageDTO->getReceiveType() === ConversationType::Ai) {
                // 确定消息优先级
                $seqCreatedEvent = $this->getControlSeqCreatedEvent($seqEntity);
                // 异步给收件方(其他群成员)生成Seq并推送
                $this->dispatchSeq($seqCreatedEvent);
            }

            if ($receiverConversationEntity) {
                // 给接收方的消息流生成序列.
                $receiverSeqEntity = $this->generateReceiveSequenceByControlMessage($messageDTO, $receiverConversationEntity);
                // 确定消息优先级
                $receiverSeqCreatedEvent = $this->getControlSeqCreatedEvent($receiverSeqEntity);
                // 给对方发送消息
                $this->dispatchSeq($receiverSeqCreatedEvent);
            }
            // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
            $data = SeqAssembler::getClientSeqStruct($seqEntity, $messageDTO)->toArray();
            // 通知用户的其他设备,这里即使投递失败也不影响,所以放协程里,事务外.
            co(function () use ($seqEntity) {
                // 异步推送消息给自己的其他设备
                $this->pushControlSequence($seqEntity);
            });
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        }
        return $data;
    }

    /**
     * @param string[] $magicMessageIds
     * @return MagicMessageEntity[]
     */
    public function getMessageEntitiesByMaicMessageIds(array $magicMessageIds, ?array $rangMessageTypes = null): array
    {
        $messages = $this->magicMessageRepository->getMessages($magicMessageIds, $rangMessageTypes);
        $messageEntities = [];
        foreach ($messages as $message) {
            $messageEntity = MessageAssembler::getMessageEntity($message);
            $messageEntity && $messageEntities[] = $messageEntity;
        }
        return $messageEntities;
    }

    /**
     * 判断会话id是否是自己的.
     */
    protected function checkAndGetSelfConversation(string $conversationId, DataIsolation $dataIsolation): MagicConversationEntity
    {
        $senderConversation = $this->magicConversationRepository->getConversationById($conversationId);
        if ($senderConversation === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        if ($senderConversation->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 组织编码是否匹配
        if ($senderConversation->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        return $senderConversation;
    }

    protected function getAccountId(string $uid): string
    {
        $receiveEntity = $this->magicUserRepository->getUserById($uid);
        if ($receiveEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }
        return $receiveEntity->getMagicId();
    }

    /**
     * 由于一条消息,在2个会话窗口渲染时,会生成2个消息id,因此需要解析出来收件方能看到的消息引用的id.
     * 根据 magic_message_id + object_id + object_type 找到消息的收件方的refer_message_id.
     * Support for the message editing function: For multiple sequences (seqs) of the same object_id, only the one with the smallest seq_id is returned.
     */
    protected function getMinSeqListByReferMessageId(MagicSeqEntity $senderSeqEntity): array
    {
        // 发送方自己的会话窗口里,引用的消息id,需要转换成收件方的消息id
        $sendReferMessageId = $senderSeqEntity->getReferMessageId();
        if (empty($sendReferMessageId)) {
            // 没有消息引用
            return [];
        }
        $referSeqEntity = $this->magicSeqRepository->getSeqByMessageId($sendReferMessageId);
        if ($referSeqEntity === null) {
            return [];
        }
        // Optimized version: Group by object_id at MySQL level and return only the minimum seq_id record for each user
        $seqList = $this->magicSeqRepository->getMinSeqListByMagicMessageId($referSeqEntity->getMagicMessageId());

        // build referMap
        $referMap = [];
        foreach ($seqList as $seq) {
            $referMap[$seq['object_id']] = $seq['message_id'];
        }
        return $referMap;
    }

    /**
     * 获取消息的最近状态.
     * @param MagicSeqEntity[] $seqList 多个 refer_message_id 的相关seqList
     * @return MagicSeqEntity[]
     */
    protected function getMessageLatestStatus(array $referMessageIds, array $seqList): array
    {
        $userMessagesReadStatus = [];
        $messageTypes = ControlMessageType::getMessageStatusChangeType();
        foreach ($seqList as $userSeq) {
            $seqType = $userSeq->getSeqType();
            if (in_array($seqType, $messageTypes, true) && in_array($userSeq->getReferMessageId(), $referMessageIds, true)) {
                $userMessageId = $userSeq->getReferMessageId();
            } elseif ($seqType instanceof ChatMessageType && in_array($userSeq->getMessageId(), $referMessageIds, true)) {
                $userMessageId = $userSeq->getMessageId();
            } else {
                $userMessageId = '';
            }
            if (empty($userMessageId) || isset($userMessagesReadStatus[$userMessageId])) {
                continue;
            }
            $userMessagesReadStatus[$userMessageId] = $userSeq;
        }
        return $userMessagesReadStatus;
    }

    /**
     * 返回收件方多条消息最终的阅读状态
     * @return MagicSeqEntity[]
     * @todo 考虑用户的A设备编辑消息,B设备撤回消息的场景
     */
    private function getReceiveMessageLatestReadStatus(array $referMessageIds, DataIsolation $dataIsolation): array
    {
        $referSeqList = $this->magicSeqRepository->getReceiveMessagesStatusChange($referMessageIds, $dataIsolation->getCurrentUserId());
        // 对于接收方来说,一个 sender_message_id 由于状态变化,可能会有多条记录,此处需要最后的状态
        return $this->getMessageLatestStatus($referMessageIds, $referSeqList);
    }
}

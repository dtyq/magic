<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\ConversationListQueryDTO;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationEndInputMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationHideMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationMuteMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationStartInputMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationTopMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\ConversationWindowOpenMessage;
use App\Domain\Chat\DTO\PageResponseDTO\ConversationsPageResponseDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Chat\Event\ConversationCreatedEvent;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Throwable;

use function Hyperf\Coroutine\co;

class MagicConversationDomainService extends AbstractDomainService
{
    /**
     * 创建/更新会话窗口.
     */
    public function saveConversation(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): MagicConversationEntity
    {
        // 从messageStruct中解析出来会话窗口详情
        $messageType = $messageDTO->getMessageType();
        if (! $messageType instanceof ControlMessageType) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        /** @var ConversationWindowOpenMessage $messageStruct */
        $messageStruct = $messageDTO->getContent();
        $conversationDTO = new MagicConversationEntity();
        $conversationDTO->setUserId($dataIsolation->getCurrentUserId());
        $conversationDTO->setUserOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $conversationDTO->setReceiveId($messageStruct->getReceiveId());
        $conversationDTO->setReceiveType(ConversationType::from($messageStruct->getReceiveType()));
        // 判断 uid 和 receiverId 是否已经存在会话
        $existsConversation = $this->magicConversationRepository->getConversationByUserIdAndReceiveId($conversationDTO);
        if ($existsConversation) {
            // 改变消息类型,从创建会话窗口,变更为打开会话窗口
            $conversationEntity = $existsConversation;
            $messageTypeInterface = MessageAssembler::getMessageStructByArray(
                $messageType->getName(),
                $messageDTO->getContent()->toArray()
            );
            // 需要同时修改type和content,才能把消息内容变更为打开会话窗口
            $messageDTO->setMessageType($messageTypeInterface->getMessageTypeEnum());
            $messageDTO->setContent($messageTypeInterface);
            $messageDTO->setReceiveType($conversationEntity->getReceiveType());
            // 更新会话窗口状态
            if (in_array($messageDTO->getMessageType(), [ControlMessageType::CreateConversation, ControlMessageType::OpenConversation], true)) {
                $this->magicConversationRepository->updateConversationById($conversationEntity->getId(), [
                    'status' => ConversationStatus::Normal->value,
                ]);
                $conversationEntity->setStatus(ConversationStatus::Normal);
            }
        } else {
            $conversationEntity = $this->getOrCreateConversation(
                $conversationDTO->getUserId(),
                $conversationDTO->getReceiveId(),
                $conversationDTO->getReceiveType()
            );
        }
        return $conversationEntity;
    }

    /**
     * 打开会话窗口.
     * 控制消息,只在seq表写入数据,不在message表写.
     * @throws Throwable
     */
    public function openConversationWindow(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): array
    {
        Db::beginTransaction();
        try {
            $conversationEntity = $this->saveConversation($messageDTO, $dataIsolation);
            $result = $this->handleCommonControlMessage($messageDTO, $conversationEntity);
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
        return $result;
    }

    /**
     * 会话窗口：置顶/移除/免打扰.
     * @throws Throwable
     */
    public function conversationOptionChange(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): array
    {
        /** @var ConversationHideMessage|ConversationMuteMessage|ConversationTopMessage $messageStruct */
        $messageStruct = $messageDTO->getContent();
        $conversationId = $messageStruct->getConversationId();
        $conversationEntity = $this->checkAndGetSelfConversation($conversationId, $dataIsolation);
        // 根据要操作的类型，更改数据库
        $updateData = [];
        if ($messageStruct instanceof ConversationTopMessage) {
            $updateData = ['is_top' => $messageStruct->getIsTop()];
        }
        if ($messageStruct instanceof ConversationMuteMessage) {
            $updateData = ['is_not_disturb' => $messageStruct->getIsNotDisturb()];
        }
        if ($messageStruct instanceof ConversationHideMessage) {
            $updateData = ['status' => ConversationStatus::Hidden->value];
        }
        Db::beginTransaction();
        try {
            if (! empty($updateData)) {
                $this->magicConversationRepository->updateConversationById($conversationEntity->getId(), $updateData);
            }
            // 给自己的消息流生成序列.
            $seqEntity = $this->generateSenderSequenceByControlMessage($messageDTO, $conversationEntity->getId());
            $seqEntity->setConversationId($conversationEntity->getId());
            // 通知用户的其他设备,这里即使投递失败也不影响,所以放协程里,事务外.
            co(function () use ($seqEntity) {
                // 异步推送消息给自己的其他设备
                $this->pushControlSequence($seqEntity);
            });
            // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
            $result = SeqAssembler::getClientSeqStruct($seqEntity, $messageDTO)->toArray();
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
        return $result;
    }

    /**
     * 正在输入中的状态只需要推送给对方,不需要推给自己的设备.
     */
    public function clientOperateConversationStatus(MagicMessageEntity $messageDTO, DataIsolation $dataIsolation): array
    {
        // 从messageStruct中解析出来会话窗口详情
        $messageType = $messageDTO->getMessageType();
        if (! in_array($messageType, [ControlMessageType::StartConversationInput, ControlMessageType::EndConversationInput], true)) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }

        if (in_array($messageType, [ControlMessageType::StartConversationInput, ControlMessageType::EndConversationInput], true)) {
            /** @var ConversationEndInputMessage|ConversationStartInputMessage $messageStruct */
            $messageStruct = $messageDTO->getContent();
            // 会话不存在直接返回
            if (! $messageStruct->getConversationId()) {
                return [];
            }
            $this->checkAndGetSelfConversation($messageStruct->getConversationId(), $dataIsolation);
            // 生成控制消息,推送给收发双发
            $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($messageStruct->getConversationId());
            if ($receiveConversationEntity === null) {
                // 检查对方是否存在会话,如果不存在直接返回
                return [];
            }
            // 替换会话id为接收方自己的
            $messageStruct->setConversationId($receiveConversationEntity->getId());
            $messageDTO->setContent($messageStruct);
            // 给对方的消息流生成序列.
            $seqEntity = $this->generateReceiveSequenceByControlMessage($messageDTO, $receiveConversationEntity);
            // 通知对方的所有
            $this->pushControlSequence($seqEntity);
        }
        // 告知客户端请求成功
        return [];
    }

    /**
     * 智能体触发会话的开始输入或者结束输入.
     * 直接操作对方的会话窗口，而不是把消息发在自己的会话窗口然后再经由消息分发模块转发到对方的会话窗口.
     * @deprecated 用户端调用 agentOperateConversationStatusV2 方法代替
     */
    public function agentOperateConversationStatus(ControlMessageType $controlMessageType, string $agentConversationId): bool
    {
        // 查找对方的会话窗口
        $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($agentConversationId);
        if ($receiveConversationEntity === null) {
            return true;
        }
        $receiveUserEntity = $this->magicUserRepository->getUserById($receiveConversationEntity->getUserId());
        if ($receiveUserEntity === null) {
            return true;
        }
        if (! in_array($controlMessageType, [ControlMessageType::StartConversationInput, ControlMessageType::EndConversationInput], true)) {
            return true;
        }
        $messageDTO = new MagicMessageEntity();
        if ($controlMessageType === ControlMessageType::StartConversationInput) {
            $content = new ConversationStartInputMessage();
        } else {
            $content = new ConversationEndInputMessage();
        }
        $messageDTO->setMessageType($controlMessageType);
        $messageDTO->setContent($content);
        /** @var ConversationEndInputMessage|ConversationStartInputMessage $messageStruct */
        $messageStruct = $messageDTO->getContent();
        // 生成控制消息,推送收件方
        $messageStruct->setConversationId($receiveConversationEntity->getId());
        $messageDTO->setContent($messageStruct);
        // 生成消息流生成序列.
        $seqEntity = $this->generateReceiveSequenceByControlMessage($messageDTO, $receiveConversationEntity);
        // 通知收件方所有设备
        $this->pushControlSequence($seqEntity);
        return true;
    }

    /**
     * 使用 intermediate 事件进行中间态消息推送，不持久化消息. 支持话题级别的“正在输入中”
     * 直接操作对方的会话窗口，而不是把消息发在自己的会话窗口然后再经由消息分发模块转发到对方的会话窗口.
     */
    public function agentOperateConversationStatusV2(ControlMessageType $controlMessageType, string $agentConversationId, ?string $topicId = null): bool
    {
        // 查找对方的会话窗口
        $receiveConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId($agentConversationId);
        if ($receiveConversationEntity === null) {
            return true;
        }
        $receiveUserEntity = $this->magicUserRepository->getUserById($receiveConversationEntity->getUserId());
        if ($receiveUserEntity === null) {
            return true;
        }
        if (! in_array($controlMessageType, [ControlMessageType::StartConversationInput, ControlMessageType::EndConversationInput], true)) {
            return true;
        }
        $messageDTO = new MagicMessageEntity();
        if ($controlMessageType === ControlMessageType::StartConversationInput) {
            $content = new ConversationStartInputMessage();
        } else {
            $content = new ConversationEndInputMessage();
        }
        $messageDTO->setMessageType($controlMessageType);
        $messageDTO->setContent($content);
        /** @var ConversationEndInputMessage|ConversationStartInputMessage $messageStruct */
        $messageStruct = $messageDTO->getContent();
        // 生成控制消息,推送收件方
        $messageStruct->setConversationId($receiveConversationEntity->getId());
        $messageStruct->setTopicId($topicId);
        $messageDTO->setContent($messageStruct);
        $time = date('Y-m-d H:i:s');
        // 生成消息流生成序列.
        $seqData = [
            'organization_code' => $receiveConversationEntity->getUserOrganizationCode(),
            'object_type' => $receiveUserEntity->getUserType()->value,
            'object_id' => $receiveUserEntity->getMagicId(),
            'seq_type' => $messageDTO->getMessageType()->getName(),
            'content' => $content->toArray(),
            'conversation_id' => $receiveConversationEntity->getId(),
            'status' => MagicMessageStatus::Read->value, // 控制消息不需要已读回执
            'created_at' => $time,
            'updated_at' => $time,
            'app_message_id' => $messageDTO->getAppMessageId(),
            'extra' => [
                'topic_id' => $topicId,
            ],
        ];
        $seqEntity = SeqAssembler::getSeqEntity($seqData);
        // seq 也加上 topicId
        $pushData = SeqAssembler::getClientSeqStruct($seqEntity)->toArray();
        // 直接推送消息给收件方
        SocketIOUtil::sendIntermediate(SocketEventType::Intermediate, $receiveUserEntity->getMagicId(), $pushData);
        return true;
    }

    /**
     * 为指定群成员创建会话窗口.
     */
    public function batchCreateGroupConversationByUserIds(MagicGroupEntity $groupEntity, array $userIds): array
    {
        $users = $this->magicUserRepository->getUserByIds($userIds);
        $users = array_column($users, null, 'user_id');
        // 判断这些用户是否已经存在会话窗口,只是窗口状态被标记为删除
        $conversations = $this->magicConversationRepository->batchGetConversations($userIds, $groupEntity->getId(), ConversationType::Group);
        /** @var MagicConversationEntity[] $conversations */
        $conversations = array_column($conversations, null, 'user_id');
        // 给这些群成员批量生成创建会话窗口消息
        $conversationsCreateDTO = [];
        $conversationsUpdateIds = [];
        foreach ($users as $user) {
            $userId = $user['user_id'] ?? null;
            $magicId = $user['magic_id'] ?? null;
            if (empty($userId) || empty($magicId)) {
                $this->logger->error(sprintf(
                    'batchCreateGroupConversations 群成员没有匹配到 $users:%s $groupEntity:%s',
                    Json::encode($users),
                    Json::encode($groupEntity->toArray()),
                ));
                continue;
            }
            if (isset($conversations[$userId]) && ! empty($conversations[$userId]->getId())) {
                $conversationsUpdateIds[] = $conversations[$userId]->getId();
            } else {
                $conversationId = (string) IdGenerator::getSnowId();
                $conversationsCreateDTO[] = [
                    'id' => $conversationId,
                    'user_id' => $userId,
                    'user_organization_code' => $user['organization_code'],
                    'receive_type' => ConversationType::Group->value,
                    'receive_id' => $groupEntity->getId(),
                    'receive_organization_code' => $groupEntity->getOrganizationCode(),
                ];
            }
        }
        if (! empty($conversationsCreateDTO)) {
            $this->magicConversationRepository->batchAddConversation($conversationsCreateDTO);
        }
        if (! empty($conversationsUpdateIds)) {
            $this->magicConversationRepository->batchUpdateConversations($conversationsUpdateIds, [
                'status' => ConversationStatus::Normal->value,
                'updated_at' => date('Y-m-d H:i:s'),
                'deleted_at' => null,
            ]);
        }
        return $conversationsCreateDTO;
    }

    /**
     * 为群主和群成员删除会话窗口.
     */
    public function batchDeleteGroupConversationByUserIds(MagicGroupEntity $groupEntity, array $userIds): int
    {
        return $this->magicConversationRepository->batchRemoveConversations($userIds, $groupEntity->getId(), ConversationType::Group);
    }

    public function getConversationById(string $conversationId, DataIsolation $dataIsolation): MagicConversationEntity
    {
        return $this->checkAndGetSelfConversation($conversationId, $dataIsolation);
    }

    public function getConversationByIdWithoutCheck(string $conversationId): ?MagicConversationEntity
    {
        return $this->magicConversationRepository->getConversationById($conversationId);
    }

    /**
     * 获取会话窗口，不存在则创建.支持用户/群聊/ai.
     */
    public function getOrCreateConversation(string $senderUserId, string $receiveId, ?ConversationType $receiverType = null): MagicConversationEntity
    {
        // 根据 $receiverType ，对 receiveId 进行解析，判断是否存在
        $receiverTypeCallable = match ($receiverType) {
            null, ConversationType::User, ConversationType::Ai => function () use ($receiveId) {
                $receiverUserEntity = $this->magicUserRepository->getUserById($receiveId);
                if ($receiverUserEntity === null) {
                    ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
                }
                return ConversationType::from($receiverUserEntity->getUserType()->value);
            },
            ConversationType::Group => function () use ($receiveId) {
                $receiverGroupEntity = $this->magicGroupRepository->getGroupInfoById($receiveId);
                if ($receiverGroupEntity === null) {
                    ExceptionBuilder::throw(ChatErrorCode::RECEIVER_NOT_FOUND);
                }
                return ConversationType::Group;
            },
            default => static function () {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_TYPE_ERROR);
            }
        };
        $receiverType = $receiverTypeCallable();
        $conversationDTO = new MagicConversationEntity();
        $conversationDTO->setUserId($senderUserId);
        $conversationDTO->setReceiveId($receiveId);
        $conversationDTO->setReceiveType($receiverType);
        // 判断 uid 和 receiverId 是否已经存在会话
        $conversationEntity = $this->magicConversationRepository->getConversationByUserIdAndReceiveId($conversationDTO);
        if ($conversationEntity === null) {
            if (in_array($conversationDTO->getReceiveType(), [ConversationType::User, ConversationType::Ai], true)) {
                # 创建会话窗口
                $conversationDTO = $this->parsePrivateChatConversationReceiveType($conversationDTO);
                # 准备生成一个会话窗口
                $conversationEntity = $this->magicConversationRepository->addConversation($conversationDTO);

                # 触发会话创建事件
                event_dispatch(new ConversationCreatedEvent($conversationEntity));
            }

            if (isset($conversationEntity)) {
                return $conversationEntity;
            }
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        return $conversationEntity;
    }

    public function getConversationByUserIdAndReceiveId(MagicConversationEntity $conversation): ?MagicConversationEntity
    {
        return $this->magicConversationRepository->getConversationByUserIdAndReceiveId($conversation);
    }

    public function getConversations(DataIsolation $dataIsolation, ConversationListQueryDTO $queryDTO): ConversationsPageResponseDTO
    {
        $conversationDTO = new MagicConversationEntity();
        $conversationDTO->setUserId($dataIsolation->getCurrentUserId());
        return $this->magicConversationRepository->getConversationsByUserIds($conversationDTO, $queryDTO, [$dataIsolation->getCurrentUserId()]);
    }

    public function saveInstruct(MagicUserAuthorization $authenticatable, array $instruct, string $conversationId): array
    {
        $this->getConversationById($conversationId, DataIsolation::create($authenticatable->getOrganizationCode(), $authenticatable->getId()));

        $this->magicConversationRepository->saveInstructs($conversationId, $instruct);

        $magicSeqEntity = new MagicSeqEntity();

        $magicSeqEntity->setOrganizationCode($authenticatable->getOrganizationCode());

        return $instruct;
    }

    public function batchUpdateInstruct(array $updateData): void
    {
        $this->magicConversationRepository->batchUpdateInstructs($updateData);
    }

    /**
     * 获取用户与多个接收者的会话ID映射.
     * @param string $userId 用户ID
     * @param array $receiveIds 接收者ID数组
     * @return array 接收者ID => 会话ID的映射数组
     */
    public function getConversationIdMappingByReceiveIds(string $userId, array $receiveIds): array
    {
        if (empty($receiveIds)) {
            return [];
        }

        $conversations = $this->magicConversationRepository->getConversationsByReceiveIds(
            $userId,
            $receiveIds
        );

        $conversationMap = [];
        foreach ($conversations as $conversation) {
            $conversationMap[$conversation->getReceiveId()] = $conversation->getId();
        }

        return $conversationMap;
    }
}

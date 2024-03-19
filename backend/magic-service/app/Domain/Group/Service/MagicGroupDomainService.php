<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Service;

use App\Domain\Chat\DTO\Message\ControlMessage\GroupCreateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupInfoUpdateMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupOwnerChangeMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupUserAddMessage;
use App\Domain\Chat\DTO\Message\ControlMessage\GroupUserRemoveMessage;
use App\Domain\Chat\DTO\PageResponseDTO\GroupsPageResponseDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Service\AbstractDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Throwable;

class MagicGroupDomainService extends AbstractDomainService
{
    use DataIsolationTrait;

    // 创建群组
    public function createGroup(MagicGroupEntity $magicGroupDTO, DataIsolation $dataIsolation): MagicGroupEntity
    {
        $magicGroupDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $magicGroupDTO->setGroupOwner($dataIsolation->getCurrentUserId());
        $magicGroupDTO->setGroupNotice('');
        $magicGroupDTO->setGroupTag('');
        return $this->magicGroupRepository->createGroup($magicGroupDTO);
    }

    public function addUsersToGroup(MagicGroupEntity $magicGroupEntity, array $userIds): bool
    {
        return $this->magicGroupRepository->addUsersToGroup($magicGroupEntity, $userIds);
    }

    // 减少群成员
    public function removeUsersFromGroup(MagicGroupEntity $magicGroupEntity, array $userIds): int
    {
        // todo 如果是群主离开,需要转移群主
        return $this->magicGroupRepository->removeUsersFromGroup($magicGroupEntity, $userIds);
    }

    public function GroupUpdateInfo(MagicGroupEntity $magicGroupDTO, DataIsolation $dataIsolation): MagicGroupEntity
    {
        $updateData = [];
        if (! empty($magicGroupDTO->getGroupName())) {
            $updateData['group_name'] = $magicGroupDTO->getGroupName();
        }
        if (! empty($magicGroupDTO->getGroupAvatar())) {
            $updateData['group_avatar'] = $magicGroupDTO->getGroupAvatar();
        }
        $this->magicGroupRepository->updateGroupById($magicGroupDTO->getId(), $updateData);
        $magicGroupEntity = $this->magicGroupRepository->getGroupInfoById($magicGroupDTO->getId(), $dataIsolation->getCurrentOrganizationCode());
        if ($magicGroupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        return $magicGroupEntity;
    }

    public function getGroupInfoById(string $groupId, DataIsolation $dataIsolation): ?MagicGroupEntity
    {
        return $this->magicGroupRepository->getGroupInfoById($groupId, $dataIsolation->getCurrentOrganizationCode());
    }

    public function getGroupUserCount($groupId): int
    {
        return $this->magicGroupRepository->getGroupUserCount($groupId);
    }

    /**
     * @return MagicGroupEntity[]
     */
    public function getGroupsInfoByIds(array $groupIds, DataIsolation $dataIsolation, bool $keyById = false): array
    {
        return $this->magicGroupRepository->getGroupsInfoByIds($groupIds, $dataIsolation->getCurrentOrganizationCode(), $keyById);
    }

    public function getGroupUserList(string $groupId, string $pageToken, DataIsolation $dataIsolation, ?array $columns = ['*']): array
    {
        return $this->magicGroupRepository->getGroupUserList($groupId, $pageToken, $dataIsolation->getCurrentOrganizationCode(), $columns);
    }

    public function getGroupIdsByUserIds(array $userIds): array
    {
        return $this->magicGroupRepository->getGroupIdsByUserIds($userIds);
    }

    public function isUserInGroup(string $groupId, string $userId): bool
    {
        return $this->magicGroupRepository->isUserInGroup($groupId, $userId);
    }

    public function isUsersInGroup(string $groupId, array $userIds): bool
    {
        return $this->magicGroupRepository->isUsersInGroup($groupId, $userIds);
    }

    public function getUserGroupList(string $pageToken, DataIsolation $dataIsolation, int $pageSize): GroupsPageResponseDTO
    {
        $groupPageResponseDTO = $this->magicGroupRepository->getUserGroupList($pageToken, $dataIsolation->getCurrentUserId(), $pageSize);
        $groupDTOS = $groupPageResponseDTO->getItems();
        // 用户在这些群聊中的会话id
        $groupIds = array_column($groupDTOS, 'id');
        $conversations = $this->magicConversationRepository->getConversationsByReceiveIds($dataIsolation->getCurrentUserId(), $groupIds);
        /** @var MagicConversationEntity[] $conversations */
        $conversations = array_column($conversations, null, 'receive_id');
        $groupList = [];
        foreach ($groupDTOS as $groupDTO) {
            // 返回群聊对应的会话id
            $groupId = $groupDTO->getId();
            $groupDTO->setConversationId($conversations[$groupId]->getId() ?? null);
            $groupList[] = $groupDTO;
        }
        $groupPageResponseDTO->setItems($groupList);
        return $groupPageResponseDTO;
    }

    /**
     * @throws Throwable
     */
    public function handlerMQGroupUserChangeSeq(MagicSeqEntity $groupUserChangeSeqEntity): void
    {
        Db::beginTransaction();
        try {
            $controlMessageType = $groupUserChangeSeqEntity->getSeqType();
            // 批量生成群成员变更消息
            /** @var GroupCreateMessage|GroupInfoUpdateMessage|GroupOwnerChangeMessage|GroupUserAddMessage|GroupUserRemoveMessage $content */
            $content = $groupUserChangeSeqEntity->getContent();
            $groupId = $content->getGroupId();
            $groupEntity = $this->magicGroupRepository->getGroupInfoById($groupId);
            if ($groupEntity === null) {
                return;
            }
            $userIds = $this->getGroupUpdateReceiveUsers($groupId);

            $changeUserIds = [];
            if (method_exists($content, 'getUserIds')) {
                foreach ($content->getUserIds() as $userId) {
                    $changeUserIds[] = $userId;
                }
            }
            $content = $content->toArray();
            // 通过 protobuf 消息结构,创建magic chat的对象,为弃用 protobuf 做准备
            if (in_array($controlMessageType, [ControlMessageType::GroupUsersRemove, ControlMessageType::GroupDisband], true)) {
                // 这些用户已经从群成员表中移除,但是他们还未收到被移除的消息
                $userIds = array_values(array_unique(array_merge($userIds, $changeUserIds)));
                if ($controlMessageType === ControlMessageType::GroupDisband) {
                    // 解散群聊,所有人都是被移除的.这里减少流量消耗.
                    $content['user_ids'] = [];
                }
            }
            $this->batchCreateGroupUserSeqEntity($userIds, $controlMessageType, $content);
            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    public function createGroupUserChangeSeq(
        DataIsolation $dataIsolation,
        MagicGroupEntity $groupEntity,
        array $seqContent,
        ControlMessageType $controlMessageType
    ): MagicSeqEntity {
        // 返回会话id,方便前端操作
        $userConversations = $this->getGroupUserConversationsByUserIds([$dataIsolation->getCurrentUserId()], $groupEntity->getId());
        $seqContent['conversation_id'] = $userConversations[$dataIsolation->getCurrentUserId()] ?? '';
        $seqEntity = $this->getGroupChangeSeqEntity($dataIsolation, $groupEntity, $seqContent, $controlMessageType);
        return $this->magicSeqRepository->createSequence($seqEntity->toArray());
    }

    public function deleteGroup(MagicGroupEntity $magicGroupEntity): int
    {
        return $this->magicGroupRepository->deleteGroup($magicGroupEntity);
    }

    public function getGroupControlSeq(MagicGroupEntity $magicGroupEntity, DataIsolation $dataIsolation, ControlMessageType $controlMessageType): ?MagicSeqEntity
    {
        // 群会话信息
        $conversation = $this->magicConversationRepository->getConversationsByReceiveIds($dataIsolation->getCurrentUserId(), [$magicGroupEntity->getId()])[0] ?? [];
        if (empty($conversation)) {
            return null;
        }
        return $this->magicSeqRepository->getConversationSeqByType(
            $dataIsolation->getCurrentMagicId(),
            $conversation->getId(),
            $controlMessageType
        );
    }

    public function transferGroupOwner(MagicGroupEntity $groupEntity, DataIsolation $dataIsolation, MagicGroupEntity $magicGroupDTO): bool
    {
        // 检查用户是否是群主
        $oldGroupOwner = $groupEntity->getGroupOwner();
        if ($oldGroupOwner !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_ONLY_OWNER_CAN_TRANSFER);
        }
        // 检查被转让的用户是否在群聊中
        $groupId = $groupEntity->getId();
        $newOwnerUserId = $magicGroupDTO->getGroupOwner();
        if (! $this->isUserInGroup($groupId, $newOwnerUserId)) {
            ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
        }
        // 转让群主
        return $this->magicGroupRepository->transferGroupOwner($groupId, $oldGroupOwner, $newOwnerUserId);
    }

    protected function getGroupChangeSeqEntity(DataIsolation $dataIsolation, MagicGroupEntity $groupEntity, array $seqContent, ControlMessageType $controlMessageType): MagicSeqEntity
    {
        $id = (string) IdGenerator::getSnowId();
        $time = date('Y-m-d H:i:s');
        $seqData = [
            'id' => $id,
            'organization_code' => $groupEntity->getOrganizationCode(),
            'object_type' => ConversationType::User->value,
            'object_id' => $dataIsolation->getCurrentMagicId(),
            'seq_id' => $id,
            'seq_type' => $controlMessageType->value,
            'content' => Json::encode($seqContent, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'receive_list' => '',
            'magic_message_id' => '',
            'message_id' => $id,
            'refer_message_id' => '',
            'sender_message_id' => '',
            'conversation_id' => $seqContent['conversation_id'] ?? '',
            'status' => MagicMessageStatus::Read->value, // 控制消息不需要已读回执
            'created_at' => $time,
            'updated_at' => $time,
            'app_message_id' => '',
        ];
        return SeqAssembler::getSeqEntity($seqData);
    }

    private function getGroupUpdateReceiveUsers(string $groupId): array
    {
        // 批量生成群成员变更消息
        $groupEntity = $this->magicGroupRepository->getGroupInfoById($groupId);
        if ($groupEntity === null || $groupEntity->getGroupStatus() === GroupStatusEnum::Disband) {
            return [];
        }
        // 找到群成员
        $groupUsers = $this->magicGroupRepository->getGroupUserList($groupId, '', null, ['user_id']);
        return array_column($groupUsers, 'user_id');
    }

    private function getGroupUserConversationsByUserIds(array $groupUserIds, string $groupId): array
    {
        $userConversations = $this->magicConversationRepository->batchGetConversations($groupUserIds, $groupId, ConversationType::Group);
        return array_column($userConversations, 'id', 'user_id');
    }

    private function batchCreateGroupUserSeqEntity(array $userIds, ControlMessageType $controlMessageType, array $content): void
    {
        $operateUserId = $content['operate_user_id'] ?? '';
        // 批量获取userEntity
        $users = $this->magicUserRepository->getUserByIds($userIds);
        $users = array_column($users, null, 'user_id');
        $time = date('Y-m-d H:i:s');
        $seqListCreateDTO = [];
        $groupId = $content['group_id'] ?? '';
        // 群成员增加时,为新加入的成员返回会话id
        $userConversations = $this->getGroupUserConversationsByUserIds(array_keys($users), $groupId);
        $userContent = $content;
        foreach ($users as $user) {
            $userId = $user['user_id'] ?? null;
            if (empty($userId)) {
                continue;
            }
            // 不为操作者重复生成seq. 因为在投mq之前,已经为操作者生成了seq
            if ($userId === $operateUserId) {
                continue;
            }
            $conversationId = $userConversations[$userId] ?? '';
            $userContent['conversation_id'] = $conversationId;
            if (! empty($userContent['user_ids'])) {
                $userContent['user_ids'] = array_values(array_unique($userContent['user_ids']));
            }
            $seqId = (string) IdGenerator::getSnowId();
            $seqData = [
                'id' => $seqId,
                'organization_code' => $user['organization_code'],
                'object_type' => $user['user_type'],
                'object_id' => $user['magic_id'],
                'seq_id' => $seqId,
                'seq_type' => $controlMessageType->value,
                'content' => Json::encode($userContent, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'receive_list' => '',
                'magic_message_id' => '', // 控制消息不能有 magic_message_id
                'message_id' => $seqId,
                'refer_message_id' => '',
                'sender_message_id' => '',
                'conversation_id' => $conversationId,
                'status' => MagicMessageStatus::Read->value, // 发送方自己的消息,默认已读
                'created_at' => $time,
                'updated_at' => $time,
                'app_message_id' => '',
            ];
            $seqListCreateDTO[] = SeqAssembler::getSeqEntity($seqData);
        }
        if (! empty($seqListCreateDTO)) {
            $this->magicSeqRepository->batchCreateSeq($seqListCreateDTO);
            $this->batchPushControlSeqList($seqListCreateDTO);
        }
    }
}

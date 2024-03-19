<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\PageResponseDTO\GroupsPageResponseDTO;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Event\Group\GroupDeleteEvent;
use App\Domain\Chat\Service\MagicControlDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Entity\ValueObject\GroupLimitEnum;
use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\Domain\Group\Service\MagicGroupDomainService;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Context\ApplicationContext;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Coroutine\co;

class MagicChatGroupAppService extends AbstractAppService
{
    public function __construct(
        protected readonly MagicGroupDomainService $magicGroupDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        protected readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        protected readonly MagicControlMessageAppService $controlMessageAppService,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicControlDomainService $magicControlDomainService,
        protected LoggerInterface $logger,
        protected readonly MagicAgentDomainService $magicAgentDomainService,
        protected readonly OperationPermissionDomainService $operationPermissionDomainService,
        protected readonly MagicUserContactAppService $magicUserContactAppService
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
    }

    // 创建群聊
    public function createChatGroup(array $groupUserIds, array $inputDepartmentIds, MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $chatGroupUserNumLimit = GroupLimitEnum::NormalGroup->value;
        $groupUserIds[] = $dataIsolation->getCurrentUserId();
        $groupUserIds = array_values(array_unique($groupUserIds));
        $users = $this->getGroupAddUsers($groupUserIds, $dataIsolation, $inputDepartmentIds, $chatGroupUserNumLimit);
        $userIds = array_column($users, 'user_id');
        // 确定群聊名称
        $groupName = $this->getGroupName($magicGroupDTO, $userIds, $dataIsolation);
        $magicGroupDTO->setGroupName($groupName);
        $magicGroupDTO->setMemberLimit($chatGroupUserNumLimit);
        // 创建群聊
        Db::beginTransaction();
        try {
            $groupEntity = $this->magicGroupDomainService->createGroup($magicGroupDTO, $dataIsolation);
            $seqContent = [
                'operate_user_id' => $dataIsolation->getCurrentUserId(),
                'group_id' => $groupEntity->getId(),
                'user_ids' => $userIds,
                'group_name' => $groupName,
                'group_avatar' => $magicGroupDTO->getGroupAvatar(),
                'group_owner_id' => $dataIsolation->getCurrentUserId(),
            ];
            $createGroupSeq = $this->addGroupUsers(
                $userIds,
                $seqContent,
                $groupEntity,
                $dataIsolation,
                ControlMessageType::GroupCreate
            );
            Db::commit();
        } catch (Throwable$exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_CREATE_ERROR, throwable: $exception);
        }
        // 为操作者及时返回 seq
        return $this->noticeGroupChangeSeq($createGroupSeq);
    }

    /**
     * 群聊加人.
     */
    public function groupAddUsers(array $groupAddUserIds, array $inputDepartmentIds, MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        // 当前群聊人数
        $groupUserCount = $this->magicGroupDomainService->getGroupUserCount($groupId);
        // 最大人数限制减去当前人数
        $chatGroupUserNumLimit = GroupLimitEnum::NormalGroup->value;
        $chatGroupUserNumLimit -= $groupUserCount;
        // 获取本次需要添加的群成员 (综合 指定的user_id + 部门id下的用户)
        $wantJoinUsers = $this->getGroupAddUsers($groupAddUserIds, $dataIsolation, $inputDepartmentIds, $chatGroupUserNumLimit);
        $wantJoinUserIds = array_column($wantJoinUsers, 'user_id');
        // 判断哪些用户已经在群聊中
        $groupUsers = $this->magicGroupDomainService->getGroupUserList($groupId, '', $dataIsolation, ['user_id']);
        // 已经存在于群聊中的用户id
        $existUserIds = array_column($groupUsers, 'user_id');
        $needAddGroupUserIds = array_diff($wantJoinUserIds, $existUserIds);
        if (empty($needAddGroupUserIds)) {
            ExceptionBuilder::throw(ChatErrorCode::USER_ALREADY_IN_GROUP);
        }
        Db::beginTransaction();
        try {
            $seqContent = [
                'operate_user_id' => $dataIsolation->getCurrentUserId(),
                'group_id' => $groupEntity->getId(),
                'user_ids' => $needAddGroupUserIds,
            ];
            $addUsersSeq = $this->addGroupUsers(
                $needAddGroupUserIds,
                $seqContent,
                $groupEntity,
                $dataIsolation,
                ControlMessageType::GroupUsersAdd
            );
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_UPDATE_ERROR, throwable: $exception);
        }
        // 为操作者及时返回 seq
        return $this->noticeGroupChangeSeq($addUsersSeq);
    }

    public function groupKickUsers(
        MagicUserAuthorization $userAuthorization,
        MagicGroupEntity $magicGroupDTO,
        array $userIds,
        ControlMessageType $controlMessageType
    ): array {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        // 不能踢出群主
        $groupOwner = $groupEntity->getGroupOwner();
        if (in_array($groupOwner, $userIds, true)) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_CANNOT_KICK_OWNER);
        }
        $userSeq = $this->groupRemoveUsers($dataIsolation, $groupEntity, $userIds, $controlMessageType);
        return $this->noticeGroupChangeSeq($userSeq);
    }

    public function leaveGroupConversation(
        MagicUserAuthorization $userAuthorization,
        MagicGroupEntity $magicGroupDTO,
        array $userIds,
        ControlMessageType $controlMessageType
    ): array {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        // 群主不能退出群聊,需要先转移群主身份
        $groupOwner = $groupEntity->getGroupOwner();
        if ($groupOwner === $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_TRANSFER_OWNER_BEFORE_LEAVE);
        }
        // 幂等.检查用户是否已离开群组
        $isInGroup = $this->magicGroupDomainService->isUserInGroup($groupId, $dataIsolation->getCurrentUserId());
        if (! $isInGroup) {
            // 返回用户上次离开群聊的 seq
            $seqEntity = $this->magicGroupDomainService->getGroupControlSeq($groupEntity, $dataIsolation, ControlMessageType::GroupUsersRemove);
            if (isset($seqEntity)) {
                return $this->noticeGroupChangeSeq($seqEntity);
            }
        }
        // 退出群聊
        $userSeq = $this->groupRemoveUsers($dataIsolation, $groupEntity, $userIds, $controlMessageType);
        return $this->noticeGroupChangeSeq($userSeq);
    }

    public function deleteGroup(MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): array
    {
        // 获取所有群成员
        $groupUsers = $this->magicGroupDomainService->getGroupUserList(
            $magicGroupDTO->getId(),
            '',
            $this->createDataIsolation($userAuthorization),
            ['user_id']
        );
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userIds = array_column($groupUsers, 'user_id');
        $controlMessageType = ControlMessageType::GroupDisband;
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        // 检查群组是否已解散
        if ($groupEntity->getGroupStatus() === GroupStatusEnum::Disband) {
            // 找到该用户的解散群组seq
            $seqEntity = $this->magicGroupDomainService->getGroupControlSeq($groupEntity, $dataIsolation, ControlMessageType::GroupDisband);
            // 如果已经存在群聊解散的 seq,则直接返回
            if (isset($seqEntity)) {
                return $this->noticeGroupChangeSeq($seqEntity);
            }
        }
        // 只能群主解散群聊
        $groupOwner = $groupEntity->getGroupOwner();
        if ($groupOwner !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_ONLY_OWNER_CAN_DISBAND);
        }
        Db::beginTransaction();
        try {
            $userSeq = $this->groupRemoveUsers($dataIsolation, $groupEntity, $userIds, $controlMessageType);
            // 删除群聊
            $this->magicGroupDomainService->deleteGroup($groupEntity);
            Db::commit();
        } catch (BusinessException $exception) {
            Db::rollBack();
            throw $exception;
        } catch (Throwable $exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_UPDATE_ERROR, throwable: $exception);
        }

        AsyncEventUtil::dispatch(new GroupDeleteEvent($magicGroupDTO->getId()));

        return $this->noticeGroupChangeSeq($userSeq);
    }

    public function GroupUpdateInfo(MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): array
    {
        if (empty($magicGroupDTO->getGroupAvatar()) && empty($magicGroupDTO->getGroupName())) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => 'group_name, group_avatar']);
        }
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        $groupEntity->setGroupAvatar($magicGroupDTO->getGroupAvatar());
        $groupEntity->setGroupName($magicGroupDTO->getGroupName());
        Db::beginTransaction();
        try {
            // 更新群信息
            $groupEntity = $this->magicGroupDomainService->GroupUpdateInfo($magicGroupDTO, $dataIsolation);
            // 生成群更新的 seq 并分发
            $seqContent = [
                'operate_user_id' => $dataIsolation->getCurrentUserId(),
                'group_id' => $groupEntity->getId(),
                'user_ids' => [],
            ];
            if ($magicGroupDTO->getGroupName() !== null) {
                $seqContent['group_name'] = $magicGroupDTO->getGroupName();
            }
            if ($magicGroupDTO->getGroupAvatar() !== null) {
                $seqContent['group_avatar'] = $magicGroupDTO->getGroupAvatar();
            }
            $userSeq = $this->createAndDispatchOperateGroupUsersSeq(
                $seqContent,
                $groupEntity,
                $dataIsolation,
                ControlMessageType::GroupUpdate
            );
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_UPDATE_ERROR, throwable: $exception);
        }
        return $this->noticeGroupChangeSeq($userSeq);
    }

    public function getGroupsInfo(array $groupIds, MagicUserAuthorization $userAuthorization): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicGroupDomainService->getGroupsInfoByIds($groupIds, $dataIsolation);
    }

    /**
     * 获取群的成员列表.
     */
    public function getGroupUserList(string $groupId, string $pageToken, MagicUserAuthorization $userAuthorization): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicGroupDomainService->getGroupUserList($groupId, $pageToken, $dataIsolation);
    }

    /**
     * 获取用户的群列表.
     */
    public function getUserGroupList(string $pageToken, MagicUserAuthorization $userAuthorization, int $pageSize): GroupsPageResponseDTO
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicGroupDomainService->getUserGroupList($pageToken, $dataIsolation, $pageSize);
    }

    public function groupTransferOwner(MagicGroupEntity $magicGroupDTO, MagicUserAuthorization $userAuthorization): array
    {
        // 检查群聊是否存在
        $groupId = $magicGroupDTO->getId();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $groupEntity = $this->magicGroupDomainService->getGroupInfoById($groupId, $dataIsolation);
        if ($groupEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NOT_FOUND);
        }
        Db::beginTransaction();
        try {
            // 转让群主
            $this->magicGroupDomainService->transferGroupOwner($groupEntity, $dataIsolation, $magicGroupDTO);
            // 生成群主转让的 seq
            $seqContent = [
                'operate_user_id' => $dataIsolation->getCurrentUserId(),
                'group_id' => $groupEntity->getId(),
                'old_owner_user_id' => $groupEntity->getGroupOwner(),
                'new_owner_user_id' => $magicGroupDTO->getGroupOwner(),
            ];
            $userSeq = $this->createAndDispatchOperateGroupUsersSeq(
                $seqContent,// 全员通知
                $groupEntity,
                $dataIsolation,
                ControlMessageType::GroupOwnerChange
            );
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_UPDATE_ERROR, throwable: $exception);
        }
        // 为操作者及时返回 seq
        return $this->noticeGroupChangeSeq($userSeq);
    }

    /**
     * 群聊减人.
     */
    protected function groupRemoveUsers(
        DataIsolation $dataIsolation,
        MagicGroupEntity $groupEntity,
        array $userIds,
        ControlMessageType $controlMessageType
    ): MagicSeqEntity {
        // 查询群聊中的用户
        $groupUsers = $this->magicGroupDomainService->getGroupUserList($groupEntity->getId(), '', $dataIsolation, ['user_id']);
        $groupUsers = array_column($groupUsers, 'user_id');
        // 判断要移除的用户是否在群聊中
        $removeUserIds = array_intersect($userIds, $groupUsers);
        if (empty($removeUserIds)) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_NO_USER_TO_REMOVE);
        }
        Db::beginTransaction();
        try {
            // 往群聊中减少用户
            $this->magicGroupDomainService->removeUsersFromGroup($groupEntity, $removeUserIds);
            // 移除这些用户的会话窗口
            $this->magicConversationDomainService->batchDeleteGroupConversationByUserIds($groupEntity, $removeUserIds);
            // 生成群成员减少的seq
            $seqContent = ['user_ids' => $removeUserIds, 'group_id' => $groupEntity->getId(), 'operate_user_id' => $dataIsolation->getCurrentUserId()];
            $groupUserRemoveSeq = $this->createAndDispatchOperateGroupUsersSeq($seqContent, $groupEntity, $dataIsolation, $controlMessageType);
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            ExceptionBuilder::throw(ChatErrorCode::GROUP_UPDATE_ERROR, throwable: $exception);
        }
        // 为操作者及时返回 seq
        return $groupUserRemoveSeq;
    }

    /**
     * 获取本次需要添加的群成员.
     * @return MagicUserEntity[]
     */
    private function getGroupAddUsers(array $needAddGroupUserIds, DataIsolation $dataIsolation, array $inputDepartmentIds, int $chatGroupUserNumLimit): array
    {
        if (! empty($inputDepartmentIds)) {
            $departmentIds = $this->magicDepartmentDomainService->getAllChildrenByDepartmentIds($inputDepartmentIds, $dataIsolation);
        } else {
            $departmentIds = [];
        }
        // 目前只支持添加同组织的用户
        $groupAddUsers = $this->magicUserDomainService->getUserByIds($needAddGroupUserIds, $dataIsolation, ['user_id', 'nickname']);
        // 按部门获取用户
        if (! empty($departmentIds)) {
            $departmentUsers = $this->magicDepartmentUserDomainService->getDepartmentUsersByDepartmentIds(
                $departmentIds,
                $dataIsolation,
                $chatGroupUserNumLimit + 1,
                fields: ['user_id']
            );
        } else {
            $departmentUsers = [];
        }
        // 去重
        $groupAddUsers = array_values(array_column(array_merge($departmentUsers, $groupAddUsers), null, 'user_id'));
        if (count($groupAddUsers) > $chatGroupUserNumLimit) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_USER_NUM_LIMIT_ERROR);
        }
        return $groupAddUsers;
    }

    private function getGroupName(MagicGroupEntity $magicGroupDTO, array $userIds, DataIsolation $dataIsolation): string
    {
        // 如果群聊名称为空,获取群主 + 20 个群成员的昵称
        if (empty($magicGroupDTO->getGroupName())) {
            $someUserIds = array_slice($userIds, 0, 20);
            $someUserIds[] = $dataIsolation->getCurrentUserId();
            $someUsers = $this->magicUserDomainService->getUserByIds($someUserIds, $dataIsolation, ['user_id', 'nickname']);
            $someUsers = array_column($someUsers, null, 'user_id');
            // 将群主的昵称放在第一个
            $ownerNickname = $someUsers[$dataIsolation->getCurrentUserId()]['nickname'] ?? '';
            unset($someUsers[$dataIsolation->getCurrentUserId()]);
            $nicknames = array_column($someUsers, 'nickname');
            array_unshift($nicknames, $ownerNickname);
            $groupName = implode(',', $nicknames);
            // 长度超过20个字符后,用...代替
            if (mb_strlen($groupName) > 20) {
                $groupName = mb_substr($groupName, 0, 20) . '...';
            }
            return $groupName;
        }
        return $magicGroupDTO->getGroupName();
    }

    private function addGroupUsers(
        array $userIds,
        array $structure,
        MagicGroupEntity $groupEntity,
        DataIsolation $dataIsolation,
        ControlMessageType $controlMessageType
    ): MagicSeqEntity {
        // 往群聊中添加用户
        $this->magicGroupDomainService->addUsersToGroup($groupEntity, $userIds);
        // 为新增的成员创建会话窗口
        $this->magicConversationDomainService->batchCreateGroupConversationByUserIds($groupEntity, $userIds);
        return $this->createAndDispatchOperateGroupUsersSeq($structure, $groupEntity, $dataIsolation, $controlMessageType);
    }

    /**
     * 创建并分发操作群成员的 seq.
     */
    private function createAndDispatchOperateGroupUsersSeq(
        array $seqContent,
        MagicGroupEntity $groupEntity,
        DataIsolation $dataIsolation,
        ControlMessageType $controlMessageType
    ): MagicSeqEntity {
        // 为当前操作者,生成群成员变更Seq,并经由 mq 分发给群成员
        $groupUserChangeSeq = $this->magicGroupDomainService->createGroupUserChangeSeq($dataIsolation, $groupEntity, $seqContent, $controlMessageType);
        $seqCreateEvent = $this->magicControlDomainService->getControlSeqCreatedEvent($groupUserChangeSeq);
        $this->magicControlDomainService->dispatchSeq($seqCreateEvent);
        return $groupUserChangeSeq;
    }

    private function noticeGroupChangeSeq(MagicSeqEntity $seqEntity): array
    {
        // 协程通知用户其他设备,放在事务外面
        co(function () use ($seqEntity) {
            $this->magicControlDomainService->pushControlSequence($seqEntity);
        });
        // 返回为当前操作者生成的 seq
        return SeqAssembler::getClientSeqStruct($seqEntity)->toArray();
    }
}

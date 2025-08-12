<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Chat\DTO\Message\ControlMessage\AddFriendMessage;
use App\Domain\Chat\DTO\PageResponseDTO\PageResponseDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\PlatformRootDepartmentId;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Contact\DTO\FriendQueryDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\AddFriendType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Entity\ValueObject\UserOption;
use App\Domain\Contact\Entity\ValueObject\UserQueryType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\Facade\MagicUserDomainExtendInterface;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\PageListAssembler;
use App\Interfaces\Chat\Assembler\UserAssembler;
use App\Interfaces\Chat\DTO\AgentInfoDTO;
use App\Interfaces\Chat\DTO\UserDepartmentDetailDTO;
use App\Interfaces\Chat\DTO\UserDetailDTO;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MagicUserContactAppService extends AbstractAppService
{
    public function __construct(
        protected readonly MagicUserDomainService $userDomainService,
        protected readonly MagicAccountDomainService $accountDomainService,
        protected readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        protected readonly MagicDepartmentDomainService $departmentChartDomainService,
        protected LoggerInterface $logger,
        protected readonly MagicOrganizationEnvDomainService $magicOrganizationEnvDomainService,
        protected readonly FileDomainService $fileDomainService,
        protected readonly MagicAgentDomainService $magicAgentDomainService,
        protected readonly OperationPermissionDomainService $operationPermissionDomainService,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly ContainerInterface $container
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(get_class($this));
        } catch (Throwable) {
        }
    }

    /**
     * @param string $friendId 好友的用户id. 好友可能是ai
     * @throws Throwable
     */
    public function addFriend(MagicUserAuthorization $userAuthorization, string $friendId, AddFriendType $addFriendType): bool
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 检查是否已经是好友
        if ($this->userDomainService->isFriend($dataIsolation->getCurrentUserId(), $friendId)) {
            return true;
        }

        if (! $this->userDomainService->addFriend($dataIsolation, $friendId)) {
            return false;
        }
        // 发送添加好友消息。加好友拆分为：好友申请/好友同意/好友拒绝
        if ($addFriendType === AddFriendType::PASS) {
            // 发送添加好友控制消息
            $friendUserEntity = new MagicUserEntity();
            $friendUserEntity->setUserId($friendId);
            $this->sendAddFriendControlMessage($dataIsolation, $friendUserEntity);
        }
        return true;
    }

    /**
     * 向AI助理发送添加好友控制消息.
     * @throws Throwable
     */
    public function sendAddFriendControlMessage(DataIsolation $dataIsolation, MagicUserEntity $friendUserEntity): bool
    {
        // 检查是否已经是好友
        if ($this->userDomainService->isFriend($dataIsolation->getCurrentUserId(), $friendUserEntity->getUserId())) {
            return true;
        }

        $now = date('Y-m-d H:i:s');
        $messageDTO = new MagicMessageEntity([
            'receive_id' => $friendUserEntity->getUserId(),
            'receive_type' => ConversationType::Ai->value,
            'message_type' => ControlMessageType::AddFriendSuccess->value,
            'sender_id' => $dataIsolation->getCurrentUserId(),
            'sender_organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'app_message_id' => (string) IdGenerator::getSnowId(),
            'sender_type' => ConversationType::User->value,
            'send_time' => $now,
            'created_at' => $now,
            'updated_at' => $now,
            'content' => [
                'receive_id' => $friendUserEntity->getUserId(),
                'receive_type' => ConversationType::Ai->value,
                'user_id' => $dataIsolation->getCurrentUserId(),
            ],
        ]);
        /** @var AddFriendMessage $messageStruct */
        $messageStruct = $messageDTO->getContent();
        $conversationEntity = new MagicConversationEntity();
        $conversationEntity->setReceiveId($messageStruct->getReceiveId());
        $receiveType = ConversationType::tryFrom($messageStruct->getReceiveType());
        if ($receiveType === null) {
            ExceptionBuilder::throw(ChatErrorCode::RECEIVER_NOT_FOUND);
        }
        $conversationEntity->setReceiveType($receiveType);

        $receiverConversationEntity = new MagicConversationEntity();
        $receiverConversationEntity->setUserId($messageStruct->getReceiveId());
        $receiverConversationEntity->setUserOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        // 通用控制消息处理逻辑
        $this->magicChatDomainService->handleCommonControlMessage($messageDTO, $conversationEntity, $receiverConversationEntity);

        return true;
    }

    public function searchFriend(string $keyword): array
    {
        return $this->userDomainService->searchFriend($keyword);
    }

    public function getUserWithoutDepartmentInfoByIds(array $ids, MagicUserAuthorization $authorization, array $column = ['*']): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        return $this->userDomainService->getUserByIds($ids, $dataIsolation, $column);
    }

    /**
     * 批量查询组织架构、ai 、或者个人版的用户.
     */
    public function getUserDetailByIds(UserQueryDTO $dto, MagicUserAuthorization $authorization): array
    {
        $userIds = $dto->getUserIds();
        $pageToken = (int) $dto->getPageToken();
        $pageSize = $dto->getPageSize();

        $userIds = array_slice($userIds, $pageToken, $pageSize);
        $queryType = $dto->getQueryType();
        $dataIsolation = $this->createDataIsolation($authorization);

        // 获取当前用户拥有的组织列表
        $userOrganizations = $this->userDomainService->getUserOrganizations($dataIsolation->getCurrentUserId());

        // 基本用户信息查询 - 传入用户拥有的组织列表
        $usersDetailDTOList = $this->userDomainService->getUserDetailByUserIdsWithOrgCodes($userIds, $userOrganizations);
        // 处理用户头像
        $usersDetail = $this->getUsersAvatarCoordinator($usersDetailDTOList, $dataIsolation);

        // 处理用户助理信息
        $this->addAgentInfoToUsers($authorization, $usersDetail);

        if ($queryType === UserQueryType::User) {
            // 只查人员信息
            $users = $usersDetail;
        } else {
            // 查询部门信息
            $withDepartmentFullPath = $queryType === UserQueryType::UserAndDepartmentFullPath;

            // 获取用户所属部门
            $departmentUsers = $this->departmentUserDomainService->getDepartmentUsersByUserIds($userIds, $dataIsolation);
            $departmentIds = array_column($departmentUsers, 'department_id');

            // 获取部门详情
            $departmentsInfo = $this->departmentChartDomainService->getDepartmentFullPathByIds($dataIsolation, $departmentIds);

            // 组装用户和部门信息
            $users = UserAssembler::getUserDepartmentDetailDTOList($departmentUsers, $usersDetail, $departmentsInfo, $withDepartmentFullPath);
        }

        // 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
        $users = $this->filterDepartmentOrUserHidden($users);
        return PageListAssembler::pageByMysql($users, (int) $dto->getPageToken(), $pageSize, count($dto->getUserIds()));
    }

    public function getUsersDetailByDepartmentId(UserQueryDTO $dto, MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        // 根部门被抽象为 -1，所以这里需要转换
        if ($dto->getDepartmentId() === PlatformRootDepartmentId::Magic) {
            $departmentId = $this->departmentChartDomainService->getDepartmentRootId($dataIsolation);
            $dto->setDepartmentId($departmentId);
        }
        // 部门下的用户列表，限制了 pageSize
        $usersPageResponseDTO = $this->departmentUserDomainService->getDepartmentUsersByDepartmentId($dto, $dataIsolation);
        $departmentUsers = $usersPageResponseDTO->getItems();
        $departmentIds = array_column($departmentUsers, 'department_id');
        // 部门详情
        $departmentsInfo = $this->departmentChartDomainService->getDepartmentByIds($dataIsolation, $departmentIds);
        $departmentsInfoWithFullPath = [];
        foreach ($departmentsInfo as $departmentInfo) {
            $departmentsInfoWithFullPath[$departmentInfo->getDepartmentId()] = [$departmentInfo];
        }
        // 获取用户的真名/昵称/手机号/头像等信息
        $userIds = array_values(array_unique(array_column($departmentUsers, 'user_id')));
        $usersDetail = $this->userDomainService->getUserDetailByUserIds($userIds, $dataIsolation);
        $usersDetail = $this->getUsersAvatar($usersDetail, $dataIsolation);
        // 组织用户 + 部门详情
        $userDepartmentDetailDTOS = UserAssembler::getUserDepartmentDetailDTOList($departmentUsers, $usersDetail, $departmentsInfoWithFullPath);
        // 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
        $userDepartmentDetailDTOS = $this->filterDepartmentOrUserHidden($userDepartmentDetailDTOS);
        // 由于 $usersPageResponseDTO 的 items 限制的参数类型，从代码规范的角度，再 new 一个通用的 PageResponseDTO， 按分页的结构返回
        // 另外，由于过滤逻辑的存在，可能本次返回的 items 数量少于 $limit,但是又有下一页。
        $pageResponseDTO = new PageResponseDTO();
        $pageResponseDTO->setPageToken($usersPageResponseDTO->getpageToken());
        $pageResponseDTO->setHasMore($usersPageResponseDTO->getHasMore());
        $pageResponseDTO->setItems($userDepartmentDetailDTOS);
        return $pageResponseDTO->toArray();
    }

    /**
     * 按 用户昵称/真名/手机号/邮箱/部门路径/职位 搜索用户.
     */
    public function searchDepartmentUser(UserQueryDTO $queryDTO, MagicUserAuthorization $authorization): array
    {
        $this->logger->info(sprintf('searchDepartmentUser query:%s', Json::encode($queryDTO->toArray())));

        $dataIsolation = $this->createDataIsolation($authorization);

        $usersForQueryDepartmentPath = [];
        $usersForQueryJobTitle = [];
        // 搜索职位包含搜索词的人
        if ($queryDTO->isQueryByJobTitle()) {
            $departmentUsers = $this->departmentUserDomainService->searchDepartmentUsersByJobTitle($queryDTO->getQuery(), $dataIsolation);
            // 获取用户详细信息
            $userIds = array_column($departmentUsers, 'user_id');
            $userEntities = $this->userDomainService->getUserDetailByUserIds($userIds, $dataIsolation);
            $usersForQueryJobTitle = array_map(static fn ($entity) => $entity->toArray(), $userEntities);
        }

        // 按昵称搜索
        $usersByNickname = $this->userDomainService->searchUserByNickName($queryDTO->getQuery(), $dataIsolation);
        // 按手机号/真名搜索
        $usersByPhoneOrRealName = $this->accountDomainService->searchUserByPhoneOrRealName($queryDTO->getQuery(), $dataIsolation);

        // 合并结果
        $usersForQueryDepartmentPath = array_merge($usersForQueryJobTitle, $usersForQueryDepartmentPath, $usersByNickname, $usersByPhoneOrRealName);
        // 去重
        $usersForQueryDepartmentPath = array_values(array_column($usersForQueryDepartmentPath, null, 'user_id'));

        // 去除AI助理
        if ($queryDTO->isFilterAgent()) {
            $usersForQueryDepartmentPath = array_filter($usersForQueryDepartmentPath, static fn ($user) => $user['user_type'] !== UserType::Ai->value);
        }

        // 设置用户IDs用于查询详细信息
        $userIds = array_column($usersForQueryDepartmentPath, 'user_id');
        $queryDTO->setUserIds($userIds);

        $usersForQueryDepartmentPath = $this->getUserDetailByIds($queryDTO, $authorization);
        $usersForQueryDepartmentPath['items'] = $this->filterDepartmentOrUserHidden($usersForQueryDepartmentPath['items']);

        return $usersForQueryDepartmentPath;
    }

    public function getUserFriendList(FriendQueryDTO $friendQueryDTO, MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        return $this->userDomainService->getUserFriendList($friendQueryDTO, $dataIsolation);
    }

    public function updateUserOptionByIds(array $userIds, ?UserOption $userOption = null): int
    {
        return $this->userDomainService->updateUserOptionByIds($userIds, $userOption);
    }

    public function getEnvByAuthorization(string $authorization): ?MagicEnvironmentEntity
    {
        return $this->magicOrganizationEnvDomainService->getEnvironmentEntityByAuthorization($authorization);
    }

    /**
     * Get user details for all organizations under the account from authorization token.
     *
     * @param string $authorization Authorization token
     * @param null|string $organizationCode Optional organization code to filter users
     * @return array Paginated format consistent with existing queries interface
     * @throws Throwable
     */
    public function getUsersDetailByAccountAuthorization(string $authorization, ?string $organizationCode = null): array
    {
        // Get user details list
        $usersDetailDTOList = $this->userDomainService->getUsersDetailByAccountFromAuthorization($authorization, $organizationCode);

        if (empty($usersDetailDTOList)) {
            return PageListAssembler::pageByMysql([], 0, 0, 0);
        }

        // Note: Since this interface is not within RequestContextMiddleware, organization context cannot be obtained
        // Therefore, avatar processing is not performed, and raw data is returned directly
        // Avatar processing requires specific organization context and file service configuration

        // Return paginated format consistent with existing interfaces
        return PageListAssembler::pageByMysql($usersDetailDTOList, 0, 0, count($usersDetailDTOList));
    }

    public function getByUserId(string $userId): ?MagicUserEntity
    {
        return $this->userDomainService->getByUserId($userId);
    }

    public function getLoginCodeEnv(string $loginCode): MagicEnvironmentEntity
    {
        if (empty($loginCode)) {
            // 如果没有传，那么默认取当前环境
            $magicEnvironmentEntity = $this->magicOrganizationEnvDomainService->getCurrentDefaultMagicEnv();
        } else {
            $magicEnvironmentEntity = $this->magicOrganizationEnvDomainService->getEnvironmentEntityByLoginCode($loginCode);
        }
        if ($magicEnvironmentEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        return $magicEnvironmentEntity;
    }

    /**
     * 是否允许更新用户信息.
     */
    public function getUserUpdatePermission(MagicUserAuthorization $userAuthorization): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return di(MagicUserDomainExtendInterface::class)->getUserUpdatePermission($dataIsolation);
    }

    /**
     * 更新用户信息.
     */
    public function updateUserInfo(MagicUserAuthorization $userAuthorization, UserUpdateDTO $userUpdateDTO): MagicUserEntity
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userDomainExtendService = di(MagicUserDomainExtendInterface::class);
        $userDomainExtendService->updateUserInfo($dataIsolation, $userUpdateDTO);
        return $this->getByUserId($dataIsolation->getCurrentUserId());
    }

    /**
     * 为用户添加Agent信息(应用层协调器).
     * @param array<UserDetailDTO> $usersDetailDTOList
     */
    public function addAgentInfoToUsers(Authenticatable $authorization, array $usersDetailDTOList): array
    {
        $aiCodes = [];
        // 如果是 AI 助理，那么返回 AI 助理相关信息和对它的权限
        foreach ($usersDetailDTOList as $userDetailDTO) {
            if (! empty($userDetailDTO->getAiCode())) {
                $aiCodes[] = $userDetailDTO->getAiCode();
            }
        }
        // 获取 agentIds
        $agents = $this->magicAgentDomainService->getByFlowCodes($aiCodes);
        $flowCodeMapAgentId = [];
        foreach ($agents as $agent) {
            $flowCodeMapAgentId[$agent->getFlowCode()] = $agent->getId();
        }
        $agentIds = array_keys($agents);
        $agentPermissions = [];
        if (! empty($agentIds)) {
            // 查询 user 对这些 agent 的权限
            $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
            $agentPermissions = $this->operationPermissionDomainService->getResourceOperationByUserIds(
                $permissionDataIsolation,
                ResourceType::AgentCode,
                [$authorization->getId()],
                $agentIds
            )[$authorization->getId()] ?? [];
        }

        foreach ($usersDetailDTOList as $userDetailDTO) {
            if (! empty($userDetailDTO->getAiCode())) {
                $agentId = $flowCodeMapAgentId[$userDetailDTO->getAiCode()] ?? null;
                // 设置 agent 信息
                $userDetailDTO->setAgentInfo(
                    new AgentInfoDTO([
                        'bot_id' => (string) $agentId,
                        'agent_id' => (string) $agentId,
                        'flow_code' => $userDetailDTO->getAiCode(),
                        'user_operation' => ($agentPermissions[$agentId] ?? Operation::None)->value,
                    ])
                );
            }
        }
        return $usersDetailDTOList;
    }

    /**
     * 通讯录和搜索相关接口，过滤隐藏部门和隐藏用户。
     * @param UserDepartmentDetailDTO[]|UserDetailDTO[] $usersDepartmentDetails
     */
    private function filterDepartmentOrUserHidden(array $usersDepartmentDetails): array
    {
        foreach ($usersDepartmentDetails as $key => $userDepartmentDetail) {
            // 用户是否隐藏
            if ($userDepartmentDetail->getOption() === UserOption::Hidden) {
                unset($usersDepartmentDetails[$key]);
                continue;
            }
            if ($userDepartmentDetail instanceof UserDetailDTO) {
                // 不要检查用户的部门信息
                continue;
            }
            $userPathNodes = [];
            foreach ($userDepartmentDetail->getPathNodes() as $pathNode) {
                // 用户所在的部门是否隐藏
                if ($pathNode->getOption() === DepartmentOption::Hidden) {
                    continue;
                }
                $userPathNodes[] = $pathNode;
            }
            $userDepartmentDetail->setPathNodes($userPathNodes);
        }
        return array_values($usersDepartmentDetails);
    }

    /**
     * 读私有或者公有桶，拿头像.
     * @return UserDetailDTO[]
     */
    private function getUsersAvatar(array $usersDetail, DataIsolation $dataIsolation): array
    {
        return $this->getUsersAvatarCoordinator($usersDetail, $dataIsolation);
    }

    /**
     * 读私有或者公有桶，拿头像(应用层协调器).
     * @param array<UserDetailDTO> $usersDetail
     * @return array<UserDetailDTO>
     */
    private function getUsersAvatarCoordinator(array $usersDetail, DataIsolation $dataIsolation): array
    {
        $fileKeys = array_column($usersDetail, 'avatar_url');
        // 移除空值/http或者 https开头的/长度小于 32的
        $validFileKeys = [];
        foreach ($fileKeys as $fileKey) {
            if (! empty($fileKey) && mb_strlen($fileKey) >= 32 && ! str_starts_with($fileKey, 'http')) {
                $validFileKeys[] = $fileKey;
            }
        }

        // 按组织分组fileKeys
        $orgFileKeys = [];
        foreach ($validFileKeys as $fileKey) {
            $orgCode = explode('/', $fileKey, 2)[0] ?? '';
            if (! empty($orgCode)) {
                $orgFileKeys[$orgCode][] = $fileKey;
            }
        }

        // 按组织批量获取链接
        $links = [];
        foreach ($orgFileKeys as $orgCode => $fileKeys) {
            $orgLinks = $this->fileDomainService->getLinks($orgCode, $fileKeys);
            $links[] = $orgLinks;
        }
        if (! empty($links)) {
            $links = array_merge(...$links);
        }

        // 替换 avatar_url
        foreach ($usersDetail as &$user) {
            $avatarUrl = $user['avatar_url'];
            $fileLink = $links[$avatarUrl] ?? null;
            if (isset($fileLink)) {
                $user['avatar_url'] = $fileLink->getUrl();
            }
        }
        return $usersDetail;
    }
}

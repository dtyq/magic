<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\Service;

use App\Application\Admin\Agent\Assembler\AgentAssembler;
use App\Application\Admin\Agent\DTO\AdminAgentDetailDTO;
use App\Application\Admin\Agent\Service\Extra\Factory\ExtraDetailAppenderFactory;
use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsName;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Entity\ValueObject\AgentFilterType;
use App\Domain\Admin\Entity\ValueObject\Extra\AbstractSettingExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\DefaultFriendExtra;
use App\Domain\Admin\Service\AdminGlobalSettingsDomainService;
use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Agent\Service\MagicAgentVersionDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Group\Service\MagicGroupDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Infrastructure\Core\PageDTO;
use App\Interfaces\Admin\DTO\AgentGlobalSettingsDTO;
use App\Interfaces\Admin\DTO\Extra\AbstractSettingExtraDTO;
use App\Interfaces\Admin\DTO\Extra\Item\AgentItemDTO;
use App\Interfaces\Admin\DTO\Request\QueryPageAgentDTO;
use App\Interfaces\Admin\DTO\Response\GetPublishedAgentsResponseDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Permission\Assembler\OperationPermissionAssembler;
use App\Interfaces\Permission\DTO\ResourceAccessDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Qbhy\HyperfAuth\Authenticatable;

use function Hyperf\Collection\last;
use function Hyperf\Translation\__;

class AdminAgentAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly AdminGlobalSettingsDomainService $globalSettingsDomainService,
        private readonly MagicAgentDomainService $magicAgentDomainService,
        private readonly MagicAgentVersionDomainService $magicAgentVersionDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly OperationPermissionDomainService $operationPermissionDomainService,
        private readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly MagicGroupDomainService $magicGroupDomainService,
    ) {
    }

    /**
     * 删除助理.
     */
    public function deleteAgent(MagicUserAuthorization $authenticatable, string $agentId)
    {
        $this->magicAgentDomainService->deleteAgentById($agentId, $authenticatable->getOrganizationCode());
    }

    /**
     * 获取助理详情.
     */
    public function getAgentDetail(MagicUserAuthorization $authorization, string $agentId): AdminAgentDetailDTO
    {
        $agentEntity = $this->magicAgentDomainService->getAgentById($agentId);
        $adminAgentDetail = new AdminAgentDetailDTO();

        $agentVersionEntity = new MagicAgentVersionEntity();
        if ($agentEntity->getAgentVersionId()) {
            $agentVersionEntity = $this->magicAgentVersionDomainService->getAgentById($agentEntity->getAgentVersionId());
            // 只有发布的助理才会有权限管控
            $resourceAccessDTO = $this->getAgentResource($authorization, $agentId);
            $adminAgentDetail->setResourceAccess($resourceAccessDTO);
        } else {
            $agentVersionEntity->setAgentName($agentEntity->getAgentName());
            $agentVersionEntity->setAgentDescription($agentEntity->getAgentDescription());
            $agentVersionEntity->setVersionNumber(__('agent.no_version'));
            $agentVersionEntity->setAgentAvatar($agentEntity->getAgentAvatar());
            $agentVersionEntity->setCreatedAt($agentEntity->getCreatedAt());
        }
        $adminAgentDetailDTO = AgentAssembler::toAdminAgentDetail($agentEntity, $agentVersionEntity);
        $fileLink = $this->fileDomainService->getLink($authorization->getOrganizationCode(), $agentVersionEntity->getAgentAvatar());
        if ($fileLink) {
            $adminAgentDetailDTO->setAgentAvatar($fileLink->getUrl());
        }

        $magicUserEntity = $this->userDomainService->getUserById($agentEntity->getCreatedUid());
        $adminAgentDetailDTO->setCreatedName($magicUserEntity->getNickname());

        return $adminAgentDetailDTO;
    }

    /**
     * 获取企业下的所有助理创建者.
     * @return array<array{user_id:string,nickname:string,avatar:string}>
     */
    public function getOrganizationAgentsCreators(MagicUserAuthorization $authorization): array
    {
        // 获取所有助理
        $agentCreators = $this->magicAgentDomainService->getOrganizationAgentsCreators($authorization->getOrganizationCode());
        $dataIsolation = DataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $userMap = $this->userDomainService->getByUserIds($dataIsolation, $agentCreators);

        // 收集用户头像key
        $avatars = array_filter(array_map(function ($user) {
            return $user->getAvatarUrl();
        }, $userMap), fn ($avatar) => ! empty($avatar));

        // 获取头像URL
        $fileLinks = $this->fileDomainService->getLinks($authorization->getOrganizationCode(), $avatars);

        $result = [];
        foreach ($userMap as $user) {
            $avatarKey = $user->getAvatarUrl();
            $avatarUrl = '';
            if (! empty($avatarKey) && isset($fileLinks[$avatarKey])) {
                $avatarUrl = $fileLinks[$avatarKey]->getUrl();
            }

            $result[] = [
                'user_id' => $user->getUserId(),
                'nickname' => $user->getNickname(),
                'avatar' => $avatarUrl,
            ];
        }
        return $result;
    }

    /**
     * 查询企业下的所有助理,条件查询：状态，创建人，搜索.
     */
    public function queriesAgents(MagicUserAuthorization $authorization, QueryPageAgentDTO $query): PageDTO
    {
        $magicAgentEntities = $this->magicAgentDomainService->queriesAgents($authorization->getOrganizationCode(), $query);
        if (empty($magicAgentEntities)) {
            return new PageDTO();
        }
        $magicAgentEntityCount = $this->magicAgentDomainService->queriesAgentsCount($authorization->getOrganizationCode(), $query);
        // 获取所有的 avatar
        $avatars = array_filter(array_column($magicAgentEntities, 'agent_avatar'), fn ($avatar) => ! empty($avatar));
        $fileLinks = $this->fileDomainService->getLinks($authorization->getOrganizationCode(), $avatars);
        // 获取助理创建人
        $createdUids = array_column($magicAgentEntities, 'created_uid');
        $createdUsers = $this->userDomainService->getUserByIdsWithoutOrganization($createdUids);
        $agentVersionIds = array_filter(array_column($magicAgentEntities, 'agent_version_id'), fn ($agentVersionId) => $agentVersionId !== null);
        $agentVersions = $this->magicAgentVersionDomainService->getAgentByIds($agentVersionIds);

        // 构建创建人映射
        $createdUserMap = [];
        foreach ($createdUsers as $user) {
            $createdUserMap[$user->getUserId()] = $user;
        }

        // 构建助理版本映射
        $agentVersionMap = [];
        foreach ($agentVersions as $version) {
            $agentVersionMap[$version->getId()] = $version;
        }

        // 聚合数据
        $items = [];
        foreach ($magicAgentEntities as $agent) {
            $adminAgentDTO = AgentAssembler::entityToDTO($agent);

            // 设置头像
            $avatar = $fileLinks[$agent->getAgentAvatar()] ?? null;
            $adminAgentDTO->setAgentAvatar($avatar?->getUrl() ?? '');

            // 设置创建人信息
            $createdUser = $createdUserMap[$agent->getCreatedUid()] ?? null;
            if ($createdUser) {
                $adminAgentDTO->setCreatedName($createdUser->getNickname());
            }

            // 设置版本信息
            $versionId = $agent->getAgentVersionId();
            if ($versionId && isset($agentVersionMap[$versionId])) {
                $version = $agentVersionMap[$versionId];
                $adminAgentDTO->setReleaseScope($version->getReleaseScope());
                $adminAgentDTO->setReviewStatus($version->getReviewStatus());
                $adminAgentDTO->setApprovalStatus($version->getApprovalStatus());
            }

            $items[] = $adminAgentDTO;
        }
        $pageDTO = new PageDTO();
        $pageDTO->setPage($query->getPage());
        $pageDTO->setTotal($magicAgentEntityCount);
        $pageDTO->setList($items);
        return $pageDTO;
    }

    /**
     * @param MagicUserAuthorization $authorization
     * @return AgentGlobalSettingsDTO[]
     */
    public function getGlobalSettings(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createAdminDataIsolation($authorization);
        $allSettings = [];

        // 获取所有 Agent 相关的设置类型
        $agentSettingsTypes = AdminGlobalSettingsType::getAssistantGlobalSettingsType();

        // 一次性获取所有设置
        $settings = $this->globalSettingsDomainService->getSettingsByTypes(
            $agentSettingsTypes,
            $dataIsolation
        );

        // 处理所有设置
        foreach ($settings as $setting) {
            $settingDTO = (new AgentGlobalSettingsDTO($setting->toArray()));
            ExtraDetailAppenderFactory::createStrategy($settingDTO->getExtra())->appendExtraDetail($settingDTO->getExtra(), $authorization);
            $settingName = AdminGlobalSettingsName::getByType($setting->getType());
            $allSettings[$settingName] = $settingDTO;
        }

        return $allSettings;
    }

    /**
     * @param AgentGlobalSettingsDTO[] $settings
     * @return AgentGlobalSettingsDTO[]
     */
    public function updateGlobalSettings(
        Authenticatable $authorization,
        array $settings
    ): array {
        $dataIsolation = $this->createAdminDataIsolation($authorization);
        $agentSettingsTypes = array_map(fn ($type) => $type->value, AdminGlobalSettingsType::getAssistantGlobalSettingsType());
        $agentSettingsTypes = array_flip($agentSettingsTypes);

        // 过滤出需要更新的设置
        $settingsToUpdate = array_filter($settings, function ($setting) use ($agentSettingsTypes) {
            return isset($agentSettingsTypes[$setting->getType()->value]);
        });

        // 转换为实体对象
        $entities = array_map(function ($setting) {
            /** @var AbstractSettingExtraDTO $extra */
            $extra = $setting->getExtra();
            return (new AdminGlobalSettingsEntity())
                ->setType($setting->getType())
                ->setStatus($setting->getStatus())
                ->setExtra(AbstractSettingExtra::fromDataByType($extra->toArray(), $setting->getType()));
        }, $settingsToUpdate);

        // 一次性更新所有设置
        $updatedSettings = $this->globalSettingsDomainService->updateSettingsBatch($entities, $dataIsolation);

        // 转换为DTO返回
        return array_map(fn ($setting) => new AgentGlobalSettingsDTO($setting->toArray()), $updatedSettings);
    }

    public function getPublishedAgents(Authenticatable $authorization, string $pageToken, int $pageSize, AgentFilterType $type): GetPublishedAgentsResponseDTO
    {
        // 获取数据隔离对象并获取当前组织的组织代码
        /** @var MagicUserAuthorization $authorization */
        $organizationCode = $authorization->getOrganizationCode();

        // 获取启用的机器人列表
        $enabledAgents = $this->magicAgentDomainService->getEnabledAgents();

        // 根据筛选类型过滤
        $enabledAgents = $this->filterEnableAgentsByType($authorization, $enabledAgents, $type);

        // 提取启用机器人列表中的 agent_version_id
        $agentVersionIds = array_column($enabledAgents, 'agent_version_id');

        // 获取指定组织和机器人版本的机器人数据及其总数
        $agentVersions = $this->magicAgentVersionDomainService->getAgentsByOrganizationWithCursor(
            $organizationCode,
            $agentVersionIds,
            $pageToken,
            $pageSize
        );

        if (empty($agentVersions)) {
            return new GetPublishedAgentsResponseDTO();
        }

        // 获取头像url
        $avatars = array_column($agentVersions, 'agent_avatar');
        $fileLinks = $this->fileDomainService->getLinks($organizationCode, $avatars);

        // 转换为AgentItemDTO格式
        /** @var array<AgentItemDTO> $result */
        $result = [];
        foreach ($agentVersions as $agent) {
            /** @var ?FileLink $avatar */
            $avatar = $fileLinks[$agent->getAgentAvatar()] ?? null;
            $item = new AgentItemDTO();
            $item->setAgentId($agent->getAgentId());
            $item->setName($agent->getAgentName());
            $item->setAvatar($avatar?->getUrl() ?? '');
            $result[] = $item;
        }
        /** @var AgentItemDTO $lastAgent */
        $lastAgent = last($result);
        $hasMore = count($agentVersions) === $pageSize;
        return new GetPublishedAgentsResponseDTO([
            'items' => $result,
            'has_more' => $hasMore,
            'page_token' => $lastAgent->getAgentId(),
        ]);
    }

    private function getAgentResource(MagicUserAuthorization $authorization, string $agentId): ResourceAccessDTO
    {
        $dataIsolation = $this->createPermissionDataIsolation($authorization);
        $operationPermissionEntities = $this->operationPermissionDomainService->listByResource($dataIsolation, ResourceType::AgentCode, $agentId);
        $userIds = [];
        $departmentIds = [];
        $groupIds = [];
        foreach ($operationPermissionEntities as $item) {
            if ($item->getTargetType() === TargetType::UserId) {
                $userIds[] = $item->getTargetId();
            }
            if ($item->getTargetType() === TargetType::DepartmentId) {
                $departmentIds[] = $item->getTargetId();
            }
            if ($item->getTargetType() === TargetType::GroupId) {
                $groupIds[] = $item->getTargetId();
            }
        }
        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        // 根据 userid 获取用户信息
        $users = $this->userDomainService->getByUserIds($contactDataIsolation, $userIds);
        // 获取用户的 departmentId
        $userDepartmentList = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserIds($contactDataIsolation, $userIds);
        foreach ($userDepartmentList as $userDepartmentIds) {
            $departmentIds = array_merge($departmentIds, $userDepartmentIds);
        }
        $departments = $this->magicDepartmentDomainService->getDepartmentByIds($contactDataIsolation, $departmentIds, true);
        // 获取群组信息
        $groups = $this->magicGroupDomainService->getGroupsInfoByIds($groupIds, $contactDataIsolation, true);
        return OperationPermissionAssembler::createResourceAccessDTO(ResourceType::AgentCode, $agentId, $operationPermissionEntities, $users, $departments, $groups);
    }

    /**
     * @param array<MagicAgentEntity> $enabledAgents
     * @return array<MagicAgentEntity>
     */
    private function filterEnableAgentsByType(Authenticatable $authorization, array $enabledAgents, AgentFilterType $type): array
    {
        if ($type === AgentFilterType::ALL) {
            return $enabledAgents;
        }

        $selectedDefaultFriendRootIds = array_flip($this->getSelectedDefaultFriendRootIds($authorization));
        // 如果type为SELECTED_DEFAULT_FRIEND，则只返回选中的默认好友
        if ($type === AgentFilterType::SELECTED_DEFAULT_FRIEND) {
            return array_filter($enabledAgents, function ($agent) use ($selectedDefaultFriendRootIds) {
                return isset($selectedDefaultFriendRootIds[$agent->getId()]);
            });
        }
        // 如果type为NOT_SELECTED_DEFAULT_FRIEND，则只返回未选中的默认好友
        /* @phpstan-ignore-next-line */
        if ($type === AgentFilterType::NOT_SELECTED_DEFAULT_FRIEND) {
            return array_filter($enabledAgents, function ($agent) use ($selectedDefaultFriendRootIds) {
                return ! isset($selectedDefaultFriendRootIds[$agent->getId()]);
            });
        }
        /* @phpstan-ignore-next-line */
        return $enabledAgents;
    }

    /**
     * @return array<string>
     */
    private function getSelectedDefaultFriendRootIds(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createAdminDataIsolation($authorization);
        $settings = $this->globalSettingsDomainService->getSettingsByType(AdminGlobalSettingsType::DEFAULT_FRIEND, $dataIsolation);
        /** @var ?DefaultFriendExtra $extra */
        $extra = $settings->getExtra();
        return $extra ? $extra->getSelectedAgentIds() : [];
    }
}

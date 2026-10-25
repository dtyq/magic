<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentPlaybookEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentIconType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentOrigin;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentListScope;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\CreateAgentRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateAgentInfoRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentVersionListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\CategoryInfoDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\GetAgentDetailResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\PublishAgentVersionResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\QueryAgentsResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\QueryAgentVersionsResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\SuperMagicAgentCategorizedListDTO;
use App\Interfaces\SuperMagic\Agent\DTO\SuperMagicAgentDTO;
use App\Interfaces\SuperMagic\Agent\DTO\SuperMagicAgentListDTO;
use Hyperf\Codec\Json;

class SuperMagicAgentAssembler
{
    public static function createDTO(SuperMagicAgentEntity $superMagicAgentEntity, array $users = [], bool $withPromptString = false): SuperMagicAgentDTO
    {
        $language = CoContext::getLanguage();

        $DTO = new SuperMagicAgentDTO();
        $DTO->setId($superMagicAgentEntity->getCode());
        $DTO->setCode($superMagicAgentEntity->getCode());
        $DTO->setName($superMagicAgentEntity->getI18nName($language));
        $DTO->setDescription($superMagicAgentEntity->getI18nDescription($language));
        $DTO->setIcon($superMagicAgentEntity->getIcon());
        $DTO->setIconType($superMagicAgentEntity->getIconType());
        $DTO->setPrompt($superMagicAgentEntity->getPrompt());
        $DTO->setType($superMagicAgentEntity->getType()->value);
        $DTO->setEnabled($superMagicAgentEntity->isEnabled());
        $DTO->setTools($superMagicAgentEntity->getTools());
        $DTO->setNameI18n($superMagicAgentEntity->getNameI18n());
        $DTO->setRoleI18n($superMagicAgentEntity->getRoleI18n());
        $DTO->setDescriptionI18n($superMagicAgentEntity->getDescriptionI18n());

        // Set promptString if requested
        if ($withPromptString) {
            $DTO->setPromptString($superMagicAgentEntity->getPromptString());
        }

        $DTO->setProjectId($superMagicAgentEntity->getProjectId() ? (string) $superMagicAgentEntity->getProjectId() : null);
        $DTO->setFileKey($superMagicAgentEntity->getFileKey());
        $DTO->setCreator($superMagicAgentEntity->getCreator());
        $DTO->setCreatedAt($superMagicAgentEntity->getCreatedAt());
        $DTO->setModifier($superMagicAgentEntity->getModifier());
        $DTO->setUpdatedAt($superMagicAgentEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$superMagicAgentEntity->getCreator()] ?? null, $superMagicAgentEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$superMagicAgentEntity->getModifier()] ?? null, $superMagicAgentEntity->getUpdatedAt()));

        $DTO->setVisibilityConfig($superMagicAgentEntity->getVisibilityConfig());
        return $DTO;
    }

    public static function createDO(SuperMagicAgentDTO $superMagicAgentDTO): SuperMagicAgentEntity
    {
        $superMagicAgentEntity = new SuperMagicAgentEntity();
        $superMagicAgentEntity->setCode((string) $superMagicAgentDTO->getId());
        $superMagicAgentEntity->setName($superMagicAgentDTO->getName());
        $superMagicAgentEntity->setDescription($superMagicAgentDTO->getDescription());
        $superMagicAgentEntity->setIcon($superMagicAgentDTO->getIcon());
        $superMagicAgentEntity->setIconType($superMagicAgentDTO->getIconType());
        $superMagicAgentEntity->setPrompt($superMagicAgentDTO->getPrompt());
        $superMagicAgentEntity->setTools($superMagicAgentDTO->getTools());
        $superMagicAgentEntity->setFileKey($superMagicAgentDTO->getFileKey());

        if ($superMagicAgentDTO->getEnabled() !== null) {
            $superMagicAgentEntity->setEnabled($superMagicAgentDTO->getEnabled());
        }

        return $superMagicAgentEntity;
    }

    public static function createListDTO(SuperMagicAgentEntity $superMagicAgentEntity): SuperMagicAgentListDTO
    {
        $language = CoContext::getLanguage();
        $DTO = new SuperMagicAgentListDTO();
        $DTO->setId($superMagicAgentEntity->getCode());
        $DTO->setName($superMagicAgentEntity->getI18nName($language));
        $DTO->setDescription($superMagicAgentEntity->getI18nDescription($language));
        $DTO->setIcon($superMagicAgentEntity->getIcon());
        $DTO->setIconType($superMagicAgentEntity->getIconType());
        $DTO->setType($superMagicAgentEntity->getType()->value);

        return $DTO;
    }

    /**
     * @param array<SuperMagicAgentEntity> $list
     */
    public static function createPageListDTO(array $list, int $total, Page $page): PageDTO
    {
        $dtoList = [];
        foreach ($list as $entity) {
            $dtoList[] = self::createListDTO($entity);
        }

        return new PageDTO($page->getPage(), $total, $dtoList);
    }

    /**
     * 创建分类列表DTO.
     */
    public static function createCategorizedListDTO(array $frequent, array $all, int $total): SuperMagicAgentCategorizedListDTO
    {
        $frequentDTOs = [];
        foreach ($frequent as $entity) {
            $frequentDTOs[] = self::createListDTO($entity);
        }

        $allDTOs = [];
        foreach ($all as $entity) {
            $allDTOs[] = self::createListDTO($entity);
        }

        return new SuperMagicAgentCategorizedListDTO([
            'frequent' => $frequentDTOs,
            'all' => $allDTOs,
            'total' => $total,
        ]);
    }

    public static function createDOV2(CreateAgentRequestDTO $requestDTO): SuperMagicAgentEntity
    {
        // 创建 Entity
        $entity = new SuperMagicAgentEntity();

        // 设置多语言字段
        $entity->setNameI18n($requestDTO->getNameI18n());
        $entity->setRoleI18n($requestDTO->getRoleI18n());
        $entity->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $entity->hydrateScalarTextForWrite();

        // 处理 icon
        $entity->setIcon($requestDTO->getIcon());
        $entity->setIconType($requestDTO->getIconType() ?: AgentIconType::Icon->value);

        // 处理 prompt_shadow（混淆代码）
        $promptShadow = $requestDTO->getPromptShadow();
        if (! empty($promptShadow)) {
            $promptData = json_decode(ShadowCode::unShadow($promptShadow), true);
            $entity->setPrompt($promptData);
        }

        // 设置默认值
        $entity->setSourceType(AgentSourceType::LOCAL_CREATE);
        $entity->setEnabled(true);
        $entity->setVisibilityConfig($requestDTO->getVisibilityConfig());
        $entity->setFileKey($requestDTO->getFileKey());

        if ($requestDTO instanceof UpdateAgentInfoRequestDTO) {
            $entity->setProvidedFields([
                'name_i18n' => $requestDTO->hasField('name_i18n'),
                'role_i18n' => $requestDTO->hasField('role_i18n'),
                'description_i18n' => $requestDTO->hasField('description_i18n'),
                'icon' => $requestDTO->hasField('icon'),
                'icon_type' => $requestDTO->hasField('icon_type'),
                'prompt_shadow' => $requestDTO->hasField('prompt_shadow'),
                'file_key' => $requestDTO->hasField('file_key'),
            ]);
        }

        return $entity;
    }

    /**
     * @param SkillEntity[] $skills
     */
    public static function createDetailResponseDTO(
        SuperMagicAgentEntity $agent,
        array $skills,
        ?bool $isStoreOffline,
        bool $withFileUrl = false,
        ?Operation $operation = null
    ): GetAgentDetailResponseDTO {
        $language = CoContext::getLanguage();

        $promptString = json_encode($agent->getPrompt(), JSON_UNESCAPED_UNICODE);
        $prompt = $promptString ? Json::decode($promptString) : [];

        $nameI18n = $agent->getNameI18n();
        $roleI18n = $agent->getRoleI18n();
        $descriptionI18n = $agent->getDescriptionI18n();

        if (! $nameI18n) {
            foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
                $nameI18n[$languageCode] = $agent->getName();
            }
        }
        if (! $descriptionI18n) {
            foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
                $descriptionI18n[$languageCode] = $agent->getDescription();
            }
        }

        $skillMap = [];
        foreach ($skills as $skill) {
            $skillMap[$skill->getCode()] = $skill;
        }

        $skillItems = [];
        foreach ($agent->getSkills() as $agentSkill) {
            $skill = $skillMap[$agentSkill->getSkillCode()] ?? null;
            if (! $skill) {
                continue;
            }

            $skillItems[] = [
                'id' => (string) $agentSkill->getId(),
                'skill_id' => (string) $agentSkill->getSkillId(),
                'skill_code' => $agentSkill->getSkillCode(),
                'name_i18n' => $skill->getNameI18n(),
                'description_i18n' => $skill->getDescriptionI18n(),
                'logo' => $skill->getLogo(),
                'file_url' => $skill->getFileUrl(),
                'sort_order' => $agentSkill->getSortOrder(),
            ];
        }

        $playbooks = [];
        foreach ($agent->getPlaybooks() as $playbook) {
            $playbooks[] = [
                'id' => (string) $playbook->getId(),
                'name_i18n' => $playbook->getNameI18n(),
                'description_i18n' => $playbook->getDescriptionI18n(),
                'icon' => $playbook->getIcon(),
                'theme_color' => $playbook->getThemeColor(),
                'enabled' => $playbook->getIsEnabled(),
                'sort_order' => $playbook->getSortOrder(),
            ];
        }

        return new GetAgentDetailResponseDTO(
            id: $agent->getCode(),
            code: $agent->getCode(),
            versionCode: null,
            versionId: null,
            name: $agent->getI18nName($language),
            description: $agent->getI18nDescription($language),
            nameI18n: $nameI18n,
            roleI18n: $roleI18n,
            descriptionI18n: $descriptionI18n,
            icon: $agent->getIcon(),
            iconType: $agent->getIconType(),
            prompt: $prompt,
            enabled: $agent->getEnabled() ?? false,
            sourceType: $agent->getSourceType()->value,
            isStoreOffline: $isStoreOffline,
            pinnedAt: $agent->getPinnedAt(),
            skills: $skillItems,
            playbooks: $playbooks,
            tools: $agent->getTools(),
            projectId: $agent->getProjectId(),
            fileKey: $agent->getFileKey(),
            fileUrl: $withFileUrl ? $agent->getFileUrl() : null,
            latestPublishedAt: $agent->getLatestPublishedAt(),
            createdAt: $agent->getCreatedAt(),
            updatedAt: $agent->getUpdatedAt(),
            userRole: $operation?->toAlias()
        );
    }

    public static function createPublishVersionResponseDTO(AgentVersionEntity $version): PublishAgentVersionResponseDTO
    {
        return new PublishAgentVersionResponseDTO(
            versionId: (string) $version->getId(),
            version: $version->getVersion(),
            publishStatus: $version->getPublishStatus()->value,
            reviewStatus: $version->getReviewStatus()->value,
            publishTargetType: $version->getPublishTargetType()->value,
            isCurrentVersion: $version->isCurrentVersion(),
            publishedAt: $version->getPublishedAt(),
            categoryIds: $version->getCategoryIds(),
        );
    }

    /**
     * @param array<int, SuperMagicAgentEntity> $agents
     * @param array<string, array<int, AgentPlaybookEntity>> $playbooksMap
     * @param array<string, AgentMarketEntity> $storeAgentsMap
     * @param array<string, AgentVersionEntity> $latestVersionsMap
     * @param array<string, array{name: string}> $organizationInfoMap
     */
    public static function createMyAgentsResponseDTO(
        array $agents,
        array $playbooksMap,
        array $storeAgentsMap,
        array $latestVersionsMap,
        array $userAgentsMap,
        string $currentUserId,
        int $page,
        int $pageSize,
        int $total,
        array $organizationInfoMap = [],
        array $officialAgentCodes = [],
        array $marketSourceMap = []
    ): QueryAgentsResponseDTO {
        $list = [];
        $officialAgentCodeMap = array_fill_keys($officialAgentCodes, true);
        foreach ($agents as $agent) {
            $agentCode = $agent->getCode();
            $list[] = self::createAgentListItemDTO(
                agent: $agent,
                playbooks: $playbooksMap[$agentCode] ?? [],
                storeAgent: $storeAgentsMap[$agentCode] ?? null,
                latestVersionEntity: $latestVersionsMap[$agentCode] ?? null,
                userAgent: $userAgentsMap[$agentCode] ?? null,
                origin: self::resolveAgentOrigin(
                    $agent,
                    $currentUserId,
                    $userAgentsMap[$agentCode] ?? null,
                    $officialAgentCodeMap,
                    $marketSourceMap
                ),
                // Created-list cards still need an explicit role; installation alone is not ownership.
                userOperation: $agent->getCreator() === $currentUserId ? Operation::Owner : null,
                scope: AgentListScope::CREATED->value,
                organizationInfo: $organizationInfoMap[$agent->getOrganizationCode()] ?? null,
            );
        }

        return new QueryAgentsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * @param array<int, SuperMagicAgentEntity> $agents
     * @param array<string, array<int, AgentPlaybookEntity>> $playbooksMap
     * @param array<string, AgentMarketEntity> $storeAgentsMap
     * @param array<string, AgentVersionEntity> $latestVersionsMap
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, array{name: string}> $organizationInfoMap
     */
    public static function createExternalAgentsResponseDTO(
        array $agents,
        array $playbooksMap,
        array $storeAgentsMap,
        array $latestVersionsMap,
        array $userAgentsMap,
        string $currentUserId,
        int $page,
        int $pageSize,
        int $total,
        array $agentOperations = [],
        array $publisherUserMap = [],
        array $creatorUserMap = [],
        array $organizationInfoMap = [],
        array $officialAgentCodes = [],
        array $marketSourceMap = []
    ): QueryAgentsResponseDTO {
        $list = [];
        $officialAgentCodeMap = array_fill_keys($officialAgentCodes, true);
        foreach ($agents as $agent) {
            $agentCode = $agent->getCode();
            $list[] = self::createAgentListItemDTO(
                agent: $agent,
                playbooks: $playbooksMap[$agentCode] ?? [],
                storeAgent: $storeAgentsMap[$agentCode] ?? null,
                latestVersionEntity: $latestVersionsMap[$agentCode] ?? null,
                userAgent: $userAgentsMap[$agentCode] ?? null,
                origin: self::resolveAgentOrigin(
                    $agent,
                    $currentUserId,
                    $userAgentsMap[$agentCode] ?? null,
                    $officialAgentCodeMap,
                    $marketSourceMap
                ),
                userOperation: $agentOperations[$agentCode] ?? null,
                publisher: isset($storeAgentsMap[$agentCode])
                    ? self::buildAgentPublisher($storeAgentsMap[$agentCode]->getPublisherType(), $agent->getCreator(), $publisherUserMap)
                    : null,
                creatorInfo: self::buildSimpleCreatorInfo($agent->getCreator(), $creatorUserMap),
                scope: self::resolveAgentListScope($agent, $currentUserId, $userAgentsMap[$agentCode] ?? null),
                organizationInfo: $organizationInfoMap[$agent->getOrganizationCode()] ?? null
            );
        }

        return new QueryAgentsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * @param array<string, MagicUserEntity> $userMap
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap
     * @param array<int, AgentCategoryEntity> $categoryMap
     * @param AgentVersionEntity[] $versions
     */
    public static function createQueryAgentVersionsResponseDTO(
        array $versions,
        array $userMap,
        int $page,
        int $pageSize,
        int $total,
        array $memberDepartmentMap = [],
        array $categoryMap = []
    ): QueryAgentVersionsResponseDTO {
        $list = [];
        foreach ($versions as $version) {
            $enrichedPublishTargetValue = self::buildEnrichedPublishTargetValue(
                $version,
                $userMap,
                $memberDepartmentMap
            );

            $list[] = new AgentVersionListItemDTO(
                id: (string) $version->getId(),
                version: $version->getVersion(),
                publishStatus: $version->getPublishStatus()->value,
                reviewStatus: $version->getReviewStatus()->value,
                reviewRemark: $version->getReviewRemark(),
                publishTargetType: $version->getPublishTargetType()->value,
                publisher: OperatorAssembler::createOperatorDTOByUserEntity($userMap[$version->getPublisherUserId() ?? ''] ?? null, $version->getPublishedAt() ?? $version->getCreatedAt()),
                publishedAt: $version->getPublishedAt(),
                isCurrentVersion: $version->isCurrentVersion(),
                versionDescriptionI18n: $version->getVersionDescriptionI18n(),
                versionDescription: $version->getI18nVersionDescription(CoContext::getLanguage()),
                publishTargetValue: $enrichedPublishTargetValue,
                categories: self::buildCategoryInfoDTOs($version, $categoryMap),
            );
        }

        return new QueryAgentVersionsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * 构建 MEMBER 类型的 publishTargetValue enriched 数据.
     *
     * @param array<string, MagicUserEntity> $userMap
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap
     * @return null|array{users: array<array{id: string, name: string}>, departments: array<array{id: string, name: string}>}
     */
    private static function buildEnrichedPublishTargetValue(
        AgentVersionEntity $version,
        array $userMap,
        array $memberDepartmentMap
    ): ?array {
        $targetValue = $version->getPublishTargetValue();
        if ($targetValue === null || ! $version->getPublishTargetType()->requiresTargetValue()) {
            return null;
        }

        $users = [];
        foreach ($targetValue->getUserIds() as $userId) {
            $userEntity = $userMap[$userId] ?? null;
            $users[] = [
                'id' => $userId,
                'name' => $userEntity?->getNickname() ?: $userId,
            ];
        }

        $departments = [];
        foreach ($targetValue->getDepartmentIds() as $departmentId) {
            $departmentEntity = $memberDepartmentMap[$departmentId] ?? null;
            $departments[] = [
                'id' => $departmentId,
                'name' => $departmentEntity?->getName() ?: $departmentId,
            ];
        }

        return [
            'users' => $users,
            'departments' => $departments,
        ];
    }

    /**
     * @param array<int, AgentCategoryEntity> $categoryMap
     * @return CategoryInfoDTO[]
     */
    private static function buildCategoryInfoDTOs(AgentVersionEntity $version, array $categoryMap): array
    {
        $items = [];
        foreach ($version->getCategoryIds() as $categoryId) {
            $category = $categoryMap[$categoryId] ?? null;
            if ($category === null) {
                continue;
            }

            $items[] = new CategoryInfoDTO(
                id: (string) $categoryId,
                name: $category->getI18nName(CoContext::getLanguage()),
            );
        }

        return $items;
    }

    /**
     * @param array<int, AgentPlaybookEntity> $playbooks
     * @param null|array{type: string, info: array{name: string, avatar: string}} $publisher
     */
    private static function createAgentListItemDTO(
        SuperMagicAgentEntity $agent,
        array $playbooks = [],
        ?AgentMarketEntity $storeAgent = null,
        ?AgentVersionEntity $latestVersionEntity = null,
        ?UserAgentEntity $userAgent = null,
        ?AgentOrigin $origin = null,
        ?Operation $userOperation = null,
        ?array $publisher = null,
        ?array $creatorInfo = null,
        ?string $scope = null,
        ?array $organizationInfo = null
    ): AgentListItemDTO {
        $features = [];
        foreach ($playbooks as $playbook) {
            $features[] = [
                'name_i18n' => $playbook->getNameI18n(),
                'icon' => $playbook->getIcon(),
                'theme_color' => $playbook->getThemeColor(),
            ];
        }

        $latestVersionCode = $latestVersionEntity?->getVersion();
        $publishTargetType = $latestVersionEntity?->getPublishTargetType()->value;
        $isAdded = $userAgent !== null;

        $allowDelete = false;
        if ($userAgent && $userAgent->getSourceType()->isMarket()) {
            $allowDelete = $isAdded;
        }

        return new AgentListItemDTO(
            id: $agent->getId(),
            code: $agent->getCode(),
            projectId: $agent->getProjectId() === null ? null : (string) $agent->getProjectId(),
            nameI18n: $agent->getNameI18n() ?? [],
            roleI18n: $agent->getRoleI18n() ?? [],
            descriptionI18n: $agent->getDescriptionI18n() ?? [],
            icon: $agent->getIcon(),
            iconType: $agent->getIconType(),
            playbooks: $features,
            sourceType: $agent->getSourceType()->value,
            // `source` is the scalar replacement for the removed source_i18n field; keep source_type for compatibility.
            source: $agent->getSourceType()->value,
            enabled: $agent->getEnabled() ?? false,
            isStoreOffline: false,
            latestVersionCode: $latestVersionCode,
            publishTargetType: $publishTargetType,
            origin: ($origin ?? AgentOrigin::TEAM_SHARED)->value,
            allowDelete: $allowDelete,
            pinnedAt: $agent->getPinnedAt(),
            latestPublishedAt: $agent->getLatestPublishedAt(),
            updatedAt: $agent->getUpdatedAt(),
            createdAt: $agent->getCreatedAt(),
            publisherType: $publisher['type'] ?? null,
            publisher: $publisher['info'] ?? null,
            creatorInfo: $creatorInfo,
            userRole: $userOperation?->toAlias(),
            scope: $scope,
            organizationInfo: $organizationInfo,
        );
    }

    /**
     * Resolve the list badge from official membership, ownership, or hired market source.
     *
     * @param array<string, true> $officialAgentCodeMap
     * @param array<int, AgentMarketEntity> $marketSourceMap
     */
    private static function resolveAgentOrigin(
        SuperMagicAgentEntity $agent,
        string $currentUserId,
        ?UserAgentEntity $userAgent,
        array $officialAgentCodeMap,
        array $marketSourceMap
    ): AgentOrigin {
        if (isset($officialAgentCodeMap[$agent->getCode()])) {
            return AgentOrigin::OFFICIAL;
        }

        if ($agent->getCreator() === $currentUserId) {
            return AgentOrigin::CREATED;
        }

        if ($userAgent?->getSourceType()->isMarket()) {
            $market = $marketSourceMap[$userAgent->getSourceId() ?? 0] ?? null;
            if ($market?->getMarketType() === AgentMarketType::MARKET) {
                return AgentOrigin::MARKET;
            }
            if ($market?->getMarketType() === AgentMarketType::ORGANIZATION) {
                return AgentOrigin::TEAM_SHARED;
            }
        }

        // Remaining visible external agents are collaborators or shelf recipients without a hire.
        return AgentOrigin::TEAM_SHARED;
    }

    private static function resolveAgentListScope(
        SuperMagicAgentEntity $agent,
        string $currentUserId,
        ?UserAgentEntity $userAgent = null
    ): string {
        if ($agent->getCreator() === $currentUserId) {
            return AgentListScope::CREATED->value;
        }

        if ($agent->getSourceType()->isSystem() || $agent->getSourceType()->isMarket() || $userAgent?->getSourceType()->isMarket()) {
            return AgentListScope::MARKET_INSTALLED->value;
        }

        return AgentListScope::TEAM_SHARED->value;
    }

    /**
     * @param array<string, MagicUserEntity> $creatorUserMap
     */
    private static function buildSimpleCreatorInfo(string $creatorId, array $creatorUserMap): ?array
    {
        $creator = $creatorUserMap[$creatorId] ?? null;
        if ($creator === null) {
            return null;
        }

        return [
            'id' => (string) $creator->getId(),
            'name' => $creator->getNickname(),
        ];
    }

    /**
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @return array{type: string, info: array{name: string, avatar: string}}
     */
    private static function buildAgentPublisher(PublisherType $publisherType, string $creatorId, array $publisherUserMap): array
    {
        if ($publisherType->isUser()) {
            $userEntity = $publisherUserMap[$creatorId] ?? null;
            return [
                'type' => $publisherType->value,
                'info' => [
                    'name' => $userEntity?->getNickname() ?: $publisherType->value,
                    'avatar' => '',
                ],
            ];
        }

        return [
            'type' => $publisherType->value,
            'info' => [
                'name' => '',
                'avatar' => '',
            ],
        ];
    }
}

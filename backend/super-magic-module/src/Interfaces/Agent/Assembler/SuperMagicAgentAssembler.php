<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentIconType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateAgentRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\GetAgentDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentCategorizedListDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentListDTO;
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
        $DTO->setDescription($superMagicAgentEntity->getI18nName($language));
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
        $DTO = new SuperMagicAgentListDTO();
        $DTO->setId($superMagicAgentEntity->getCode());
        $DTO->setName($superMagicAgentEntity->getName());
        $DTO->setDescription($superMagicAgentEntity->getDescription());
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

        // 从 name_i18n.en_US 提取 name
        $nameI18n = $requestDTO->getNameI18n();
        $entity->setName($nameI18n[LanguageEnum::EN_US->value] ?? '');

        // 从 description_i18n.en_US 提取 description（如果存在）
        $descriptionI18n = $requestDTO->getDescriptionI18n();
        $entity->setDescription($descriptionI18n[LanguageEnum::EN_US->value] ?? '');

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

        return $entity;
    }

    /**
     * @param SkillEntity[] $skills
     */
    public static function createDetailResponseDTO(
        SuperMagicAgentEntity $agent,
        array $skills,
        ?bool $isStoreOffline,
        bool $withFileUrl = false
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
            $skillMap[$skill->getId()] = $skill;
        }

        $skillItems = [];
        foreach ($agent->getSkills() as $agentSkill) {
            $skill = $skillMap[$agentSkill->getSkillId()] ?? null;
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
            id: $agent->getId(),
            code: $agent->getCode(),
            versionCode: $agent->getVersionCode(),
            versionId: (string) $agent->getVersionId(),
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
            createdAt: $agent->getCreatedAt(),
            updatedAt: $agent->getUpdatedAt()
        );
    }
}

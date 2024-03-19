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
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateAgentRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentCategorizedListDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentListDTO;

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

        return $entity;
    }
}

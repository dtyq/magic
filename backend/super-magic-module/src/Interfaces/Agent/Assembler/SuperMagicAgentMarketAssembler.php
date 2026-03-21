<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentMarketListItemDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\CategoryListItemDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\GetAgentMarketDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentMarketsResponseDTO;

class SuperMagicAgentMarketAssembler
{
    /**
     * @param array<int, AgentMarketEntity> $agentMarkets
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, UserAgentEntity> $userAgentsMap
     * @param array<string, AgentVersionEntity> $latestVersionsMap
     * @param array<int, array<int, AgentPlaybookEntity>> $playbooksMap
     */
    public static function createQueryAgentMarketsResponseDTO(
        array $agentMarkets,
        array $publisherUserMap,
        array $userAgentsMap,
        array $latestVersionsMap,
        array $playbooksMap,
        int $page,
        int $pageSize,
        int $total
    ): QueryAgentMarketsResponseDTO {
        $list = [];
        foreach ($agentMarkets as $agentMarket) {
            $list[] = self::createAgentMarketListItemDTO(
                $agentMarket,
                $publisherUserMap,
                $userAgentsMap,
                $latestVersionsMap,
                $playbooksMap
            );
        }

        return new QueryAgentMarketsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * @param array<int, array{id:int, name_i18n:array, logo:?string, sort_order:int, crew_count:int}> $items
     * @return array<int, CategoryListItemDTO>
     */
    public static function createCategoryListItemDTOs(array $items): array
    {
        $list = [];
        foreach ($items as $item) {
            $list[] = new CategoryListItemDTO(
                id: $item['id'],
                nameI18n: $item['name_i18n'],
                logo: $item['logo'],
                sortOrder: $item['sort_order'],
                crewCount: $item['crew_count'],
            );
        }

        return $list;
    }

    /**
     * Build the market detail DTO from the market snapshot and version snapshot.
     */
    public static function createAgentMarketDetailResponseDTO(
        AgentMarketEntity $agentMarket,
        AgentVersionEntity $agentVersion
    ): GetAgentMarketDetailResponseDTO {
        $language = CoContext::getLanguage() ?: LanguageEnum::EN_US->value;
        $nameI18n = $agentMarket->getNameI18n() ?? $agentVersion->getNameI18n();
        $roleI18n = $agentMarket->getRoleI18n() ?? $agentVersion->getRoleI18n();
        $descriptionI18n = $agentMarket->getDescriptionI18n() ?? $agentVersion->getDescriptionI18n();

        return new GetAgentMarketDetailResponseDTO(
            id: (string) ($agentMarket->getId() ?? 0),
            agentCode: $agentMarket->getAgentCode(),
            name: self::resolveLocalizedText($nameI18n, $agentVersion->getI18nName($language), $language),
            role: self::resolveLocalizedList($roleI18n, $language),
            description: self::resolveLocalizedText($descriptionI18n, $agentVersion->getI18nDescription($language), $language),
            nameI18n: $nameI18n,
            roleI18n: $roleI18n,
            descriptionI18n: $descriptionI18n,
            icon: $agentMarket->getIcon(),
            iconType: $agentMarket->getIconType()->value,
            versionCode: $agentVersion->getVersion(),
            createdAt: $agentMarket->getCreatedAt() ?? '',
            publishedAt: $agentVersion->getPublishedAt(),
        );
    }

    /**
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, UserAgentEntity> $userAgentsMap
     * @param array<string, AgentVersionEntity> $latestVersionsMap
     * @param array<int, array<int, AgentPlaybookEntity>> $playbooksMap
     */
    private static function createAgentMarketListItemDTO(
        AgentMarketEntity $agentMarket,
        array $publisherUserMap,
        array $userAgentsMap,
        array $latestVersionsMap,
        array $playbooksMap
    ): AgentMarketListItemDTO {
        $agentCode = $agentMarket->getAgentCode();
        $userAgent = $userAgentsMap[$agentCode] ?? null;
        $agentVersionId = $agentMarket->getAgentVersionId();
        $playbooks = $playbooksMap[$agentVersionId] ?? [];

        $features = [];
        foreach ($playbooks as $playbook) {
            $features[] = [
                'name_i18n' => $playbook->getNameI18n() ?? [],
                'icon' => $playbook->getIcon(),
                'theme_color' => $playbook->getThemeColor(),
            ];
        }

        $isAdded = $userAgent !== null;
        $allowDelete = $isAdded && $userAgent?->getSourceType()->isMarket() === true;
        $latestVersionCode = isset($latestVersionsMap[$agentCode]) ? $latestVersionsMap[$agentCode]->getVersion() : null;
        $publisher = self::buildPublisher(
            $agentMarket->getPublisherType(),
            $publisherUserMap[$agentMarket->getPublisherId()] ?? null
        );

        return new AgentMarketListItemDTO(
            id: $agentMarket->getId() ?? 0,
            agentCode: $agentCode,
            userCode: $userAgent?->getAgentCode(),
            nameI18n: $agentMarket->getNameI18n() ?? [],
            roleI18n: $agentMarket->getRoleI18n(),
            descriptionI18n: $agentMarket->getDescriptionI18n(),
            icon: $agentMarket->getIcon(),
            iconType: $agentMarket->getIconType()->value,
            playbooks: $features,
            publisherType: $agentMarket->getPublisherType()->value,
            publisher: $publisher,
            categoryId: $agentMarket->getCategoryId(),
            isAdded: $isAdded,
            latestVersionCode: $latestVersionCode,
            allowDelete: $allowDelete,
            createdAt: $agentMarket->getCreatedAt() ?? '',
            updatedAt: $agentMarket->getUpdatedAt() ?? '',
        );
    }

    /**
     * Resolve a localized text field with a safe fallback chain.
     */
    private static function resolveLocalizedText(?array $i18n, string $fallback, string $language): string
    {
        $localizedValue = $i18n[$language] ?: $i18n[LanguageEnum::DEFAULT->value] ?? null;
        if (is_string($localizedValue) && $localizedValue !== '') {
            return $localizedValue;
        }

        return $fallback;
    }

    /**
     * Resolve a localized string list with a safe fallback chain.
     *
     * @return array<int, string>
     */
    private static function resolveLocalizedList(?array $i18n, string $language): array
    {
        $localizedValue = $i18n[$language] ?? $i18n[LanguageEnum::DEFAULT->value] ?? [];
        if (! is_array($localizedValue)) {
            return [];
        }

        return array_values(array_filter(
            $localizedValue,
            static fn ($item) => is_string($item) && $item !== ''
        ));
    }

    /**
     * @return array{name: string, avatar: string}
     */
    private static function buildPublisher(PublisherType $publisherType, ?MagicUserEntity $userEntity = null): array
    {
        if ($publisherType === PublisherType::OFFICIAL) {
            return [
                'name' => PublisherType::OFFICIAL->value,
                'avatar' => '',
            ];
        }

        if ($userEntity !== null) {
            return [
                'name' => $userEntity->getNickname() ?: $publisherType->value,
                'avatar' => $userEntity->getAvatarUrl() ?? '',
            ];
        }

        return [
            'name' => $publisherType->value,
            'avatar' => '',
        ];
    }
}

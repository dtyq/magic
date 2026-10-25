<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentPlaybookEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublisherType;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentMarketListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\CategoryListItemDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\GetAgentMarketDetailResponseDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\QueryAgentMarketsResponseDTO;

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
        ?int $total
    ): QueryAgentMarketsResponseDTO {
        $list = [];
        foreach ($agentMarkets as $agentMarket) {
            $list[] = self::createAgentMarketListItemDTO(
                $agentMarket,
                $publisherUserMap,
                $userAgentsMap,
                $latestVersionsMap,
                $playbooksMap,
            );
        }

        return new QueryAgentMarketsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * @param array<int, array{id:int, name_i18n:array, logo:?string, sort_order:int, status:int, crew_count:int}> $items
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
                status: $item['status'],
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
            categoryIds: $agentMarket->getCategoryIds(),
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
        array $playbooksMap,
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

        // 如果是官方内置则不允许删除，不允许添加
        if ($agentMarket->getPublisherType()->isOfficialBuiltin()) {
            $isAdded = true;
            $allowDelete = false;
        }

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
            categoryIds: $agentMarket->getCategoryIds(),
            isFeatured: $agentMarket->isFeatured(),
            marketType: $agentMarket->getMarketType()->value,
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
        foreach ([$language, LanguageEnum::DEFAULT->value, 'en_US', 'zh_CN'] as $key) {
            $localizedValue = $i18n[$key] ?? null;
            if (is_string($localizedValue) && $localizedValue !== '') {
                return $localizedValue;
            }
        }

        foreach ($i18n ?? [] as $localizedValue) {
            if (is_string($localizedValue) && $localizedValue !== '') {
                return $localizedValue;
            }
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
        if ($i18n === null) {
            return [];
        }

        $preferredKeys = [$language, LanguageEnum::DEFAULT->value, 'en_US', 'zh_CN'];
        foreach ($preferredKeys as $key) {
            $localizedValue = $i18n[$key] ?? null;
            if (! is_array($localizedValue)) {
                continue;
            }

            $resolved = self::filterLocalizedList($localizedValue);
            if ($resolved !== []) {
                return $resolved;
            }
        }

        foreach ($i18n as $localizedValue) {
            if (! is_array($localizedValue)) {
                continue;
            }

            $resolved = self::filterLocalizedList($localizedValue);
            if ($resolved !== []) {
                return $resolved;
            }
        }

        return [];
    }

    /**
     * @param array<mixed> $values
     * @return array<int, string>
     */
    private static function filterLocalizedList(array $values): array
    {
        return array_values(array_filter(
            $values,
            static fn ($item) => is_string($item) && $item !== ''
        ));
    }

    /**
     * @return array{name: string, avatar: string}
     */
    private static function buildPublisher(PublisherType $publisherType, ?MagicUserEntity $userEntity = null): array
    {
        if ($publisherType->isUser() && $userEntity !== null) {
            return [
                'name' => $userEntity->getNickname() ?: $publisherType->value,
                'avatar' => '',
            ];
        }

        return [
            'name' => $publisherType->value,
            'avatar' => '',
        ];
    }
}

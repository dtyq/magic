<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Service;

use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;

final class SkillMarketSearchTextBuilder
{
    /**
     * Build the text that represents a market skill in semantic search.
     *
     * @param array<int, SkillCategoryEntity> $categories
     */
    public static function buildSemanticText(SkillMarketEntity $skillMarket, array $categories = []): string
    {
        $values = [];
        $seen = [];

        self::appendText($values, $seen, $skillMarket->getPackageName());
        self::appendI18nTexts($values, $seen, $skillMarket->getNameI18n() ?? []);
        self::appendI18nTexts($values, $seen, $skillMarket->getDescriptionI18n() ?? []);
        foreach ($categories as $category) {
            if (! $category instanceof SkillCategoryEntity) {
                continue;
            }
            self::appendI18nTexts($values, $seen, $category->getNameI18n());
        }

        return implode(' ', $values);
    }

    public static function buildFromSkill(SkillEntity $skillVersion): string
    {
        $values = [];
        $seen = [];

        self::appendText($values, $seen, $skillVersion->getPackageName());
        self::appendText($values, $seen, $skillVersion->getPackageDescription());
        self::appendI18nTexts($values, $seen, $skillVersion->getNameI18n());
        self::appendI18nTexts($values, $seen, $skillVersion->getDescriptionI18n() ?? []);

        return implode(' ', $values);
    }

    public static function buildFromSkillVersion(SkillVersionEntity $skillVersion): string
    {
        $values = [];
        $seen = [];

        self::appendText($values, $seen, $skillVersion->getPackageName());
        self::appendText($values, $seen, $skillVersion->getPackageDescription());
        self::appendI18nTexts($values, $seen, $skillVersion->getNameI18n());
        self::appendI18nTexts($values, $seen, $skillVersion->getDescriptionI18n() ?? []);

        return implode(' ', $values);
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     */
    private static function appendText(array &$values, array &$seen, ?string $text): void
    {
        $normalized = self::normalizeText($text);
        if ($normalized === null || isset($seen[$normalized])) {
            return;
        }

        $seen[$normalized] = true;
        $values[] = $normalized;
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     * @param array<mixed> $i18nTexts
     */
    private static function appendI18nTexts(array &$values, array &$seen, array $i18nTexts): void
    {
        foreach ($i18nTexts as $text) {
            if (! is_string($text)) {
                continue;
            }

            self::appendText($values, $seen, $text);
        }
    }

    private static function normalizeText(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        $text = trim($text);
        if ($text === '') {
            return null;
        }

        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return mb_strtolower($text, 'UTF-8');
    }
}

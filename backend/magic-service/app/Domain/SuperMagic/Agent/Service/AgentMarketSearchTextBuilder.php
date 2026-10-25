<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;

final class AgentMarketSearchTextBuilder
{
    /**
     * Build bilingual semantic text from searchable market fields.
     *
     * @param array<int, AgentCategoryEntity> $categories
     */
    public static function buildSemanticText(AgentMarketEntity $market, array $categories = []): string
    {
        $sections = [];
        self::appendI18nSection($sections, '名称', $market->getNameI18n() ?? []);
        self::appendI18nSection($sections, '角色定位', $market->getRoleI18n() ?? []);
        self::appendI18nSection($sections, '能力描述', $market->getDescriptionI18n() ?? []);

        $categoryTexts = [];
        foreach ($categories as $category) {
            if ($category instanceof AgentCategoryEntity) {
                $categoryTexts[] = $category->getNameI18n();
            }
        }
        self::appendI18nSection($sections, '分类', $categoryTexts);

        return implode("\n", $sections);
    }

    /** @param array<int, string> $sections @param array<mixed> $texts */
    private static function appendI18nSection(array &$sections, string $label, array $texts): void
    {
        $values = [];
        $seen = [];
        self::appendValues($values, $seen, $texts);
        if ($values !== []) {
            $sections[] = $label . '：' . implode('；', $values);
        }
    }

    /** @param array<int, string> $values @param array<string, bool> $seen */
    private static function appendValues(array &$values, array &$seen, mixed $value): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                self::appendValues($values, $seen, $item);
            }
            return;
        }

        $normalized = self::normalizeText(is_string($value) ? $value : null);
        if ($normalized === null || isset($seen[$normalized])) {
            return;
        }

        $seen[$normalized] = true;
        $values[] = $normalized;
    }

    private static function normalizeText(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        $text = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);
        return $text === '' ? null : mb_strtolower($text, 'UTF-8');
    }
}

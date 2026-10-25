<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Service;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;

final class SlidesTemplateSearchTextBuilder
{
    /** Build the database exact-search text, including category and tag names. */
    public static function build(
        SlidesTemplateEntity $template,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = []
    ): string {
        $values = [];
        $seen = [];

        self::appendText($values, $seen, $template->getCode());
        self::appendText($values, $seen, $template->getSourceType()->value);
        self::appendText($values, $seen, $template->getCategoryCode());
        self::appendI18nTexts($values, $seen, $template->getLabel());
        self::appendI18nTexts($values, $seen, $template->getDescription());
        if ($category !== null) {
            self::appendText($values, $seen, $category->getCode());
            self::appendI18nTexts($values, $seen, $category->getNameI18n());
        }
        foreach ($tags as $tag) {
            if (! $tag instanceof SlidesTemplateTagEntity
                || $tag->getStatus() !== SlidesTemplateTagStatus::Enabled) {
                continue;
            }
            self::appendText($values, $seen, $tag->getCode());
            self::appendI18nTexts($values, $seen, $tag->getNameI18n());
        }

        return implode(' ', $values);
    }

    /** Build the natural-language text used only for vector embedding. */
    public static function buildSemanticText(
        SlidesTemplateEntity $template,
        ?SlidesTemplateCategoryEntity $category = null,
        array $tags = []
    ): string {
        $sections = [];
        self::appendI18nSection($sections, '标题', $template->getLabel());
        self::appendI18nSection($sections, '描述', $template->getDescription());
        if ($category !== null) {
            self::appendI18nSection($sections, '分类', $category->getNameI18n());
        }

        $tagNames = [];
        $seen = [];
        foreach ($tags as $tag) {
            if (! $tag instanceof SlidesTemplateTagEntity
                || $tag->getStatus() !== SlidesTemplateTagStatus::Enabled) {
                continue;
            }
            foreach ($tag->getNameI18n() as $name) {
                $normalized = self::normalizeText(is_string($name) ? $name : null);
                if ($normalized !== null && ! isset($seen[$normalized])) {
                    $seen[$normalized] = true;
                    $tagNames[] = $normalized;
                }
            }
        }
        if ($tagNames !== []) {
            $sections[] = '标签：' . implode('、', $tagNames);
        }

        return implode("\n", $sections);
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

    /** Append a labeled bilingual section while keeping the text readable to the embedding model. */
    private static function appendI18nSection(array &$sections, string $label, array $i18nTexts): void
    {
        $values = [];
        $seen = [];
        foreach ($i18nTexts as $text) {
            self::appendText($values, $seen, is_string($text) ? $text : null);
        }
        if ($values !== []) {
            $sections[] = $label . '：' . implode('；', $values);
        }
    }

    /** Normalize case and whitespace so duplicate search terms are stored once. */
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

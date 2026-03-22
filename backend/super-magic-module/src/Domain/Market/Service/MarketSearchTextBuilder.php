<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Market\Service;

final class MarketSearchTextBuilder
{
    /**
     * @param array<int, mixed> $plainTexts
     * @param array<int, mixed> $structuredTexts
     */
    public static function build(array $plainTexts = [], array $structuredTexts = []): string
    {
        $values = [];
        $seen = [];

        foreach ($plainTexts as $text) {
            self::appendValue($values, $seen, $text);
        }

        foreach ($structuredTexts as $text) {
            self::appendValue($values, $seen, $text);
        }

        return implode(' ', $values);
    }

    /**
     * @param array<int, string> $values
     * @param array<string, bool> $seen
     */
    private static function appendValue(array &$values, array &$seen, mixed $value): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                self::appendValue($values, $seen, $item);
            }
            return;
        }

        if (! is_string($value)) {
            return;
        }

        $normalized = self::normalizeText($value);
        if ($normalized === null || isset($seen[$normalized])) {
            return;
        }

        $seen[$normalized] = true;
        $values[] = $normalized;
    }

    private static function normalizeText(string $text): ?string
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return mb_strtolower($text, 'UTF-8');
    }
}

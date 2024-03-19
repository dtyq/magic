<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Collator;

/**
 * VS Code style file name sorter.
 *
 * Sorting priority:
 * 1. Directories before files
 * 2. Unicode Collation (multi-language, natural number sorting, case-insensitive)
 */
class FileNameSorter
{
    /**
     * Supported locales mapping.
     */
    private const LOCALE_MAP = [
        'zh' => 'zh_CN',
        'zh_CN' => 'zh_CN',
        'zh_TW' => 'zh_TW',
        'en' => 'en_US',
        'en_US' => 'en_US',
        'ja' => 'ja_JP',
        'ja_JP' => 'ja_JP',
        'ko' => 'ko_KR',
        'ko_KR' => 'ko_KR',
        'vi' => 'vi_VN',
        'vi_VN' => 'vi_VN',
        'th' => 'th_TH',
        'th_TH' => 'th_TH',
        'ms' => 'ms_MY',
        'ms_MY' => 'ms_MY',
    ];

    /**
     * Default fallback locale.
     */
    private const DEFAULT_LOCALE = 'en_US';

    private Collator $collator;

    public function __construct(?string $locale = null)
    {
        $normalizedLocale = $this->normalizeLocale($locale);
        $this->collator = new Collator($normalizedLocale);

        // Enable numeric collation (file2 < file10)
        $this->collator->setAttribute(Collator::NUMERIC_COLLATION, Collator::ON);

        // Case insensitive comparison (Apple ≈ apple)
        $this->collator->setStrength(Collator::SECONDARY);
    }

    /**
     * Compare two file/directory nodes.
     *
     * @param array $a First item with 'is_directory' and 'name'/'file_name'
     * @param array $b Second item with 'is_directory' and 'name'/'file_name'
     * @return int -1 if $a < $b, 0 if equal, 1 if $a > $b
     */
    public function compare(array $a, array $b): int
    {
        // Priority 1: Directories before files
        $aIsDir = $a['is_directory'] ?? false;
        $bIsDir = $b['is_directory'] ?? false;

        if ($aIsDir !== $bIsDir) {
            return $aIsDir ? -1 : 1; // Directory wins
        }

        // Priority 2: Unicode collation on names
        $aName = $a['name'] ?? $a['file_name'] ?? '';
        $bName = $b['name'] ?? $b['file_name'] ?? '';

        return $this->collator->compare($aName, $bName);
    }

    /**
     * Sort an array of file nodes in place.
     *
     * @param array &$items Array of file/directory items
     */
    public function sort(array &$items): void
    {
        usort($items, [$this, 'compare']);
    }

    /**
     * Recursively sort tree nodes and their children.
     *
     * @param array &$nodes Tree nodes with optional 'children' arrays
     */
    public function sortTree(array &$nodes): void
    {
        $this->sort($nodes);

        foreach ($nodes as &$node) {
            if (! empty($node['children'])) {
                $this->sortTree($node['children']);
            }
        }
    }

    /**
     * Get a comparison function for use with usort.
     */
    public function getComparator(): callable
    {
        return [$this, 'compare'];
    }

    /**
     * Normalize locale string to standard format.
     */
    private function normalizeLocale(?string $locale): string
    {
        if ($locale === null || $locale === '') {
            return self::DEFAULT_LOCALE;
        }

        // Direct match
        if (isset(self::LOCALE_MAP[$locale])) {
            return self::LOCALE_MAP[$locale];
        }

        // Try language code only (e.g., 'zh-CN' -> 'zh')
        $langCode = explode('-', str_replace('_', '-', $locale))[0];
        if (isset(self::LOCALE_MAP[$langCode])) {
            return self::LOCALE_MAP[$langCode];
        }

        return self::DEFAULT_LOCALE;
    }
}

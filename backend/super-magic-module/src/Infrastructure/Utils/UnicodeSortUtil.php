<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Collator;

/**
 * Unicode filename sorting utility.
 * Implements Unicode Collation Algorithm (UCA) for natural filename sorting.
 */
class UnicodeSortUtil
{
    /**
     * Compare two filenames using Unicode Collation Algorithm.
     *
     * @param string $a First filename
     * @param string $b Second filename
     * @return int Comparison result (-1, 0, or 1)
     */
    public static function compareFilenames(string $a, string $b): int
    {
        // Try to use Intl Collator if available (best for Unicode sorting)
        if (extension_loaded('intl')) {
            $collator = Collator::create('root');
            if ($collator !== null) {
                // Set numeric collation for natural number sorting
                $collator->setAttribute(Collator::NUMERIC_COLLATION, Collator::ON);
                return $collator->compare($a, $b);
            }
        }

        // Fallback to natural sort (handles numbers correctly)
        return strnatcmp($a, $b);
    }

    /**
     * Sort array of file items by filename.
     *
     * @param array $files Array of file items with 'file_name' key
     * @return array Sorted array
     */
    public static function sortByFilename(array $files): array
    {
        usort($files, function ($a, $b) {
            $aName = $a['file_name'] ?? '';
            $bName = $b['file_name'] ?? '';
            return self::compareFilenames($aName, $bName);
        });

        return $files;
    }
}

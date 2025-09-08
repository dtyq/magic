<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

class ProjectFileConstant
{
    /**
     * Project configuration file name.
     */
    public const PROJECT_CONFIG_FILENAME = 'magic.project.js';

    /**
     * Slide index file name.
     */
    public const SLIDE_INDEX_FILENAME = 'index.html';

    /**
     * Metadata type for slide.
     */
    public const METADATA_TYPE_SLIDE = 'slide';

    public static function isSetMetadataFile(string $fileName): bool
    {
        return in_array($fileName, [self::PROJECT_CONFIG_FILENAME, self::SLIDE_INDEX_FILENAME]);
    }
}

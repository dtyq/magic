<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Constant;

final class TopicFileConstant
{
    public const string ROOT_FILE_NAME_PREFIX = 'topic_';

    public static function rootFileName(int $topicId): string
    {
        return self::ROOT_FILE_NAME_PREFIX . $topicId;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * Internal topic modes used by the ASR workflow.
 */
enum AsrTopicModeEnum: string
{
    case AUDIO_MERGE = 'audio-merge';
}

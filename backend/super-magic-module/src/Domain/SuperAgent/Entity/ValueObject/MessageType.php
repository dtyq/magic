<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

enum MessageType: string
{
    case Init = 'init';
    case Chat = 'chat';
    case TaskUpdate = 'task_update';
    case Thinking = 'thinking';
    case ToolCall = 'tool_call';
    case Finished = 'finished';
    case Error = 'error';
    case Heartbeat = 'heartbeat';
    case ProjectArchive = 'project_archive';
    case Reminder = 'reminder';

    public static function isValid(string $type): bool
    {
        foreach (self::cases() as $case) {
            if ($case->value === $type) {
                return true;
            }
        }
        return false;
    }
}

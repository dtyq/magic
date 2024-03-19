<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

enum ExecutionType: string
{
    case None = 'None';
    case IMChat = 'IMChat';
    case OpenPlatformApi = 'OpenPlatformApi';
    case SKApi = 'SKApi';
    case Routine = 'Routine';
    case Debug = 'Debug';

    public function isImChat(): bool
    {
        return $this == self::IMChat;
    }

    public function isRoutine(): bool
    {
        return $this == self::Routine;
    }

    public function isApi(): bool
    {
        return $this == self::OpenPlatformApi || $this == self::SKApi;
    }

    public function isFlowMemory(): bool
    {
        return in_array($this, [self::OpenPlatformApi, self::SKApi, self::Debug]);
    }

    public function isDebug(): bool
    {
        return $this == self::Debug;
    }

    public function isSupportStream(): bool
    {
        return in_array($this, [self::IMChat, self::OpenPlatformApi, self::SKApi]);
    }
}

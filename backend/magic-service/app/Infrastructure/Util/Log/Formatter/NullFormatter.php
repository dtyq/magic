<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Formatter;

use Monolog\Formatter\FormatterInterface;
use Monolog\LogRecord;

/**
 * Null formatter that passes LogRecord directly without any processing
 * This is ideal when the Handler itself handles all formatting logic.
 *
 * This formatter avoids CPU-intensive string operations that can block coroutines
 */
class NullFormatter implements FormatterInterface
{
    public function format(LogRecord $record): LogRecord
    {
        return $record;
    }

    public function formatBatch(array $records): array
    {
        return $records;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests;

use Psr\Log\AbstractLogger;

class EchoLogger extends AbstractLogger
{
    public function log($level, $message, array $context = []): void
    {
        echo "[{$level}]" . $message . ' ' . json_encode($context) . PHP_EOL;
    }
}

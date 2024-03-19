<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\Mock;

use Psr\Log\AbstractLogger;

class EchoLogger extends AbstractLogger
{
    public function log($level, $message, array $context = []): void
    {
        echo "[{$level}]{$message} " . json_encode($context, JSON_UNESCAPED_UNICODE) . PHP_EOL;
    }
}

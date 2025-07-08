<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log\Handler;

use Hyperf\Codec\Json;
use Hyperf\Contract\StdoutLoggerInterface;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\LogRecord;

class StdoutHandler extends AbstractProcessingHandler
{
    private StdoutLoggerInterface $logger;

    public function __construct($level = Level::Debug, bool $bubble = true)
    {
        parent::__construct($level, $bubble);
        $this->logger = \Hyperf\Support\make(StdoutLogger::class, ['minLevel' => $level]);
    }

    protected function write(LogRecord $record): void
    {
        $level = strtolower($record->level->getName());
        $formatted = '[' . date('Y-m-d H:i:s') . '][' . $record->channel . '][' . $record->message . ']' . Json::encode($record->context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        call_user_func([$this->logger, $level], $formatted);
    }
}

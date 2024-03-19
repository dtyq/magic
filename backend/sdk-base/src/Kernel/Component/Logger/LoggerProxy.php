<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase\Kernel\Component\Logger;

use Psr\Log\LoggerInterface;

/**
 * 因为psr/log 1.0和2.0、3.0有差异，就不继承使用了，不直接注入，这里做一个转发.
 * @method void emergency(string $message, array $context = [])
 * @method void alert(string $message, array $context = [])
 * @method void critical(string $message, array $context = [])
 * @method void error(string $message, array $context = [])
 * @method void warning(string $message, array $context = [])
 * @method void notice(string $message, array $context = [])
 * @method void info(string $message, array $context = [])
 * @method void debug(string $message, array $context = [])
 * @method void collect(string $message, array $context = [])
 */
class LoggerProxy
{
    public function __construct(
        private readonly string $sdkName,
        private readonly ?LoggerInterface $logger = null
    ) {
    }

    public function __call($name, $arguments)
    {
        $arguments = array_values($arguments);
        $arguments[0] = "[{$this->sdkName}] " . $arguments[0];
        if ($this->logger && method_exists($this->logger, $name)) {
            $this->logger->{$name}(...$arguments);
        }
    }
}

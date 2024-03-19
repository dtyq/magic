<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase\Kernel\Component\Exception;

use Dtyq\SdkBase\SdkBase;
use Exception;
use RuntimeException;
use Throwable;

class ExceptionBuilder
{
    private string $exceptionClass;

    public function __construct(SdkBase $sdkBase)
    {
        $this->exceptionClass = $this->getExceptionClass($sdkBase);
    }

    public function throw(int $code, string $message = '', ?Throwable $previous = null): void
    {
        throw new $this->exceptionClass($message, $code, $previous);
    }

    public function createException(int $code, string $message = '', ?Throwable $previous = null): Throwable
    {
        return new $this->exceptionClass($message, $code, $previous);
    }

    private function getExceptionClass(SdkBase $sdkBase): string
    {
        $exceptionClass = $sdkBase->getConfig()->get('exception_class', Exception::class);
        if (! class_exists($exceptionClass)) {
            throw new RuntimeException("[{$exceptionClass}] Not Found");
        }
        if (! is_a($exceptionClass, Exception::class, true)) {
            throw new RuntimeException("[{$exceptionClass}] Must Be An Instance Of Exception");
        }
        return $exceptionClass;
    }
}

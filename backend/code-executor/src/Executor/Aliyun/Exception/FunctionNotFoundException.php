<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Executor\Aliyun\Exception;

class FunctionNotFoundException extends AliyunExecutorException
{
    public const CODE = 'FunctionNotFound';
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Coroutine\AutoCopy;

use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Hyperf\Engine\Coroutine;

#[Aspect(priority: 99)]
class CoroutineCreateAspect extends AbstractAspect
{
    public array $classes = [
        'Hyperf\Engine\Coroutine::create',
    ];

    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        // 获取当前协程id
        $fromCoroutineId = Coroutine::id();

        // 要替换的参数
        $argKey = 'callable';

        // 获取参数
        $callable = $proceedingJoinPoint->arguments['keys'][$argKey];

        // 生成代理call类，用于上下文复制
        $callProxy = new CoroutineCreateCallProxy($callable, $fromCoroutineId);

        // 替换参数
        $proceedingJoinPoint->arguments['keys'][$argKey] = [$callProxy, 'run'];

        return $proceedingJoinPoint->process();
    }
}

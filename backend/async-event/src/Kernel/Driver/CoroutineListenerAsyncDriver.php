<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Dtyq\AsyncEvent\Kernel\Executor\AsyncListenerExecutor;
use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Dtyq\AsyncEvent\Kernel\Utils\ContextDataUtil;
use Hyperf\Engine\Coroutine;
use Psr\Container\ContainerInterface;

class CoroutineListenerAsyncDriver implements ListenerAsyncDriverInterface
{
    private AsyncListenerExecutor $asyncListenerExecutor;

    public function __construct(
        ContainerInterface $container,
    ) {
        $this->asyncListenerExecutor = $container->get(AsyncListenerExecutor::class);
    }

    public function publish(AsyncEventModel $asyncEventModel, object $event, callable $listener, bool $immediate = false): void
    {
        // Read context data based on config
        $contextData = ContextDataUtil::readContextData();

        $callback = function () use ($asyncEventModel, $event, $listener, $contextData) {
            // Set context data before executing listener
            ContextDataUtil::setContextData($contextData);

            $this->asyncListenerExecutor->run($asyncEventModel, $event, $listener, 'coroutine');
        };

        if ($immediate) {
            // 立即派生新协程，与当前协程并发执行，不等待同步监听
            Coroutine::create($callback);
        } else {
            // 延迟到当前协程结束后执行
            Coroutine::defer($callback);
        }
    }
}

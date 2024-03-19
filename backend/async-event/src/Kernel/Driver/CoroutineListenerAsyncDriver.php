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

    public function publish(AsyncEventModel $asyncEventModel, object $event, callable $listener): void
    {
        // Read context data based on config
        $contextData = ContextDataUtil::readContextData();

        Coroutine::defer(function () use ($asyncEventModel, $event, $listener, $contextData) {
            // Set context data before executing listener
            ContextDataUtil::setContextData($contextData);

            $this->asyncListenerExecutor->run($asyncEventModel, $event, $listener);
        });
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Hyperf\Listener;

use Dtyq\FlowExprEngine\Hyperf\FlowExprEngineFactory;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\BootApplication;
use Psr\Container\ContainerInterface;

class BootSdkListener implements ListenerInterface
{
    public function __construct(protected ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            BootApplication::class,
        ];
    }

    public function process(object $event): void
    {
        $config = $this->container->get(ConfigInterface::class);
        if (! $config->has('flow_expr_engine')) {
            return;
        }

        /** @var FlowExprEngineFactory $factory */
        $factory = $this->container->get(FlowExprEngineFactory::class);
        $factory->register();
    }
}

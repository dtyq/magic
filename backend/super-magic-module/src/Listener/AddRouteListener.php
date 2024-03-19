<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Listener;

use App\Infrastructure\Core\Router\RouteLoader;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\BootApplication;
use Hyperf\HttpServer\Router\DispatcherFactory;
use Psr\Container\ContainerInterface;

class AddRouteListener implements ListenerInterface
{
    public function __construct(private ContainerInterface $container)
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
        // 避免 DispatcherFactory 没有被加载
        $this->container->get(DispatcherFactory::class);
        RouteLoader::loadPath(BASE_PATH . '/vendor/dtyq/super-magic-module/config/routes.php');
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Hyperf;

use Dtyq\FlowExprEngine\Hyperf\Listener\BootSdkListener;
use Psr\Http\Client\ClientInterface;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
                ClientInterface::class => SimpleClientFactory::class,
            ],
            'commands' => [
            ],
            'annotations' => [
                'scan' => [
                    'paths' => [
                        __DIR__,
                    ],
                ],
            ],
            'listeners' => [
                // 这里获取可以让业务自行注册，不提供自动
                BootSdkListener::class => 1000,
            ],
            'publish' => [
                [
                    'id' => 'config',
                    'description' => 'The config for dtyq/flow-expr-engine.',
                    'source' => __DIR__ . '/publish/flow_expr_engine.php',
                    'destination' => BASE_PATH . '/config/autoload/flow_expr_engine.php',
                ],
            ],
        ];
    }
}

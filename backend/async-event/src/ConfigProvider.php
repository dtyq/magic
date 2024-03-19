<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent;

use Dtyq\AsyncEvent\Kernel\Crontab\ClearHistoryCrontab;
use Dtyq\AsyncEvent\Kernel\Crontab\RetryCrontab;
use Hyperf\Crontab\Crontab;
use Hyperf\Di\Definition\PriorityDefinition;
use Psr\EventDispatcher\EventDispatcherInterface;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
                EventDispatcherInterface::class => new PriorityDefinition(EventDispatcherFactory::class, 1),
            ],
            'commands' => [
            ],
            'crontab' => [
                // 由于hyperf3弃用了@注解，php7又不支持原生注解，所以这里只能使用配置的方式
                'crontab' => [
                    (new Crontab())
                        ->setName('AsyncEventClearHistory')
                        ->setRule('*/5 5 * * *')
                        ->setCallback([ClearHistoryCrontab::class, 'execute'])
                        // 这里还无法使用config函数，先暂时使用env
                        ->setEnable((bool) \Hyperf\Support\env('ASYNC_EVENT_CLEAR_HISTORY', true))
                        ->setSingleton(true)
                        ->setMemo('清理历史记录'),
                    (new Crontab())
                        ->setName('AsyncEventRetry')
                        ->setRule('*/10 * * * * *')
                        ->setCallback([RetryCrontab::class, 'execute'])
                        ->setEnable(true)
                        ->setSingleton(true)
                        ->setMemo('时间重试'),
                ],
            ],
            'annotations' => [
                'scan' => [
                    'paths' => [
                        __DIR__,
                    ],
                ],
            ],
            'publish' => [
                [
                    'id' => 'config',
                    'description' => 'config file.',
                    'source' => __DIR__ . '/../publish/async_event.php',  // 对应的配置文件路径
                    'destination' => BASE_PATH . '/config/autoload/async_event.php', // 复制为这个路径下的该文件
                ],
                [
                    'id' => 'migration',
                    'description' => 'migration file.',
                    'source' => __DIR__ . '/../publish/migrations/2023_05_18_104130_create_async_event_records.php',  // 对应的配置文件路径
                    'destination' => BASE_PATH . '/migrations/2023_05_18_104130_create_async_event_records.php', // 复制为这个路径下的该文件
                ],
            ],
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor;

use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClient;
use Dtyq\CodeExecutor\Executor\Aliyun\AliyunRuntimeClientFactory;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
                AliyunRuntimeClient::class => AliyunRuntimeClientFactory::class,
            ],
            'commands' => [
            ],
            'annotations' => [
                'scan' => [
                    'paths' => [
                        __DIR__,
                    ],
                    'ignore_annotations' => [
                        'mixin',
                    ],
                ],
            ],
            'publish' => [
                [
                    'id' => 'code_executor',
                    'description' => 'code executor 组件配置.', // 描述
                    // 建议默认配置放在 publish 文件夹中，文件命名和组件名称相同
                    'source' => __DIR__ . '/../publish/code_executor.php',  // 对应的配置文件路径
                    'destination' => BASE_PATH . '/config/autoload/code_executor.php', // 复制为这个路径下的该文件
                ],
            ],
        ];
    }
}

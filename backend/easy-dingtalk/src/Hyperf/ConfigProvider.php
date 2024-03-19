<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Hyperf;

class ConfigProvider
{
    public function __invoke(): array
    {
        return [
            'dependencies' => [
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
            'publish' => [
                [
                    'id' => 'config',
                    'description' => 'The config of easy_dingtalk.',
                    'source' => __DIR__ . '/publish/dingtalk-sdk.php',
                    'destination' => BASE_PATH . '/config/autoload/dingtalk-sdk.php',
                ],
            ],
        ];
    }
}

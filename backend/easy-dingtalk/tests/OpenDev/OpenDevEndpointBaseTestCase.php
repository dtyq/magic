<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\OpenDev;

use Dtyq\EasyDingTalk\OpenDevFactory;
use Dtyq\EasyDingTalk\Test\Mock\Container;
use Dtyq\SdkBase\SdkBase;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class OpenDevEndpointBaseTestCase extends TestCase
{
    protected function createOpenDevFactory(string $appName = 'default'): OpenDevFactory
    {
        return new OpenDevFactory($appName, $this->createSdkBase());
    }

    protected function getCorpId(): string
    {
        return 'xxx';
    }

    protected function getSuitTicket(): string
    {
        return 'xxx';
    }

    private function createSdkBase(): SdkBase
    {
        $configs = [
            'sdk_name' => 'dingtalk-sdk',
            'applications' => [
                'crop' => [
                    'type' => 'open_dev',
                    'options' => [
                        'app_key' => 'xxx',
                        'app_secret' => 'xxx',
                        'callback_config' => [
                            'token' => 'xxx',
                            'aes_key' => 'xxx',
                        ],
                    ],
                ],
                'first' => [
                    'type' => 'open_dev',
                    'options' => [
                        'app_key' => 'xxx',
                        'app_secret' => 'xxx',
                        'callback_config' => [
                        ],
                    ],
                ],
            ],
        ];
        $container = new Container();
        return new SdkBase($container, $configs);
    }
}

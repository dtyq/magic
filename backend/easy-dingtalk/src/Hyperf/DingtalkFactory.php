<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Hyperf;

use Dtyq\EasyDingTalk\OpenDevFactory;
use Dtyq\SdkBase\SdkBase;
use Hyperf\Contract\ConfigInterface;
use Psr\Container\ContainerInterface;

class DingtalkFactory
{
    protected ContainerInterface $container;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
    }

    public function createOpenDevFactory(string $appName = 'default'): OpenDevFactory
    {
        $dingtalk = $this->container->get(ConfigInterface::class)->get('dingtalk-sdk');
        $configs = [
            'sdk_name' => 'dingtalk-sdk',
            'applications' => $dingtalk,
        ];
        $sdkBase = new SdkBase($this->container, $configs);
        return new OpenDevFactory($appName, $sdkBase);
    }
}

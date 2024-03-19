<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\MagicAIApi;

use App\Infrastructure\ExternalAPI\MagicAIApi\Kernel\MagicAIApiException;
use Dtyq\SdkBase\SdkBase;
use Hyperf\Contract\ConfigInterface;
use Psr\Container\ContainerInterface;

class MagicAIApiFactory
{
    protected ContainerInterface $container;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
    }

    public function create(array $configs = []): MagicAIApi
    {
        if (empty($configs)) {
            $configs = $this->container->get(ConfigInterface::class)->get('magic_ai');
        }
        $configs['sdk_name'] = MagicAIApi::NAME;
        $configs['exception_class'] = MagicAIApiException::class;
        $sdkBase = new SdkBase($this->container, $configs);
        return new MagicAIApi($sdkBase);
    }
}

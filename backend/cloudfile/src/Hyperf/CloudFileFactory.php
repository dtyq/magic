<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Hyperf;

use Dtyq\CloudFile\CloudFile;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\SdkBase\SdkBase;
use Hyperf\Contract\ConfigInterface;
use Psr\Container\ContainerInterface;

class CloudFileFactory
{
    protected ContainerInterface $container;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
    }

    public function create(): CloudFile
    {
        $configs = $this->container->get(ConfigInterface::class)->get('cloudfile', []);
        $container = new SdkBase($this->container, [
            'sdk_name' => 'cloudfile',
            'exception_class' => CloudFileException::class,
            'cloudfile' => $configs,
        ]);
        return new CloudFile($container);
    }
}

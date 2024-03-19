<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Executor\Aliyun;

use Hyperf\Contract\ContainerInterface;
use PhpCsFixer\ConfigInterface;

class AliyunRuntimeClientFactory
{
    public function __invoke(ContainerInterface $container)
    {
        $config = $container->get(ConfigInterface::class)->get('code_executor.executors.aliyun', []);
        return new AliyunRuntimeClient($config);
    }
}

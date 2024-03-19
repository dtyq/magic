<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor;

use Dtyq\CodeExecutor\Contract\ExecutorInterface;
use Hyperf\Contract\ConfigInterface;

use function Hyperf\Support\make;

class ExecutorFactory
{
    public function __construct(protected ConfigInterface $config) {}

    public function __invoke(): ExecutorInterface
    {
        return $this->create();
    }

    public function create(?string $driver = null): ExecutorInterface
    {
        if (empty($driver)) {
            $driver = $this->config->get('code_executor.executor', '');
        }

        $config = $this->config->get('code_executor.executors.' . $driver, []);

        return make($config['executor']);
    }
}

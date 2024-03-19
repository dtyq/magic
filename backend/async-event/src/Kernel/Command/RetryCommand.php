<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Command;

use Dtyq\AsyncEvent\Kernel\Crontab\RetryCrontab;
use Dtyq\AsyncEvent\Kernel\Executor\AsyncListenerExecutor;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Symfony\Component\Console\Input\InputArgument;

#[Command]
class RetryCommand extends HyperfCommand
{
    protected ?string $name = 'async-event:retry';

    protected string $description = '重试指定的异步事件';

    public function handle(): void
    {
        $id = $this->input->getArgument('id');
        if (! $id) {
            $this->error('请提供事件ID');
            return;
        }
        $id = (int) $id;
        if ($id === 1) {
            make(RetryCrontab::class)->execute();
            return;
        }
        di(AsyncListenerExecutor::class)->retry($id);
        $this->info("已触发重试事件 {$id}");
    }

    protected function getArguments(): array
    {
        return [
            ['id', InputArgument::REQUIRED, '要重试的事件ID'],
        ];
    }
}

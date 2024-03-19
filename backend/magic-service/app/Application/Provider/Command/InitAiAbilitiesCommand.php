<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Command;

use App\Application\Provider\Official\AiAbilityInitializer;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;

#[Command]
class InitAiAbilitiesCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container
    ) {
        parent::__construct('ai-abilities:init');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('初始化AI能力数据（从配置文件同步到数据库）');
    }

    public function handle(): void
    {
        $this->info('开始初始化AI能力数据...');

        $result = AiAbilityInitializer::init();

        if (($result['success'] ?? false) !== true) {
            $this->error($result['message'] ?? '初始化失败');
            return;
        }

        $this->info("成功初始化 {$result['count']} 个AI能力");
        $this->info('AI能力数据初始化完成');
    }
}

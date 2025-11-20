<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Command;

use App\Application\Provider\Service\AdminProviderAppService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Throwable;

#[Command]
class InitMagicProviderCommand extends HyperfCommand
{
    protected ContainerInterface $container;

    protected AdminProviderAppService $adminProviderAppService;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        parent::__construct('magic-provider:init');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('初始化Magic服务商配置数据');
    }

    public function handle(): void
    {
        $this->adminProviderAppService = $this->container->get(AdminProviderAppService::class);

        $this->info('开始初始化Magic服务商配置数据...');

        try {
            $count = $this->adminProviderAppService->initializeMagicProviderConfigs();
            $this->info("成功初始化 {$count} 个服务商配置");
        } catch (Throwable $e) {
            $this->error('初始化Magic服务商配置数据失败: ' . $e->getMessage());
            $this->error($e->getTraceAsString());
            return;
        }

        $this->info('Magic服务商配置数据初始化完成');
    }
}

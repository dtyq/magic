<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Command;

use App\Application\Provider\Service\AiAbilityAppService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputArgument;
use Throwable;

#[Command]
class InitAiAbilitiesCommand extends HyperfCommand
{
    protected ContainerInterface $container;

    protected AiAbilityAppService $aiAbilityAppService;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        parent::__construct('ai-abilities:init');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('初始化AI能力数据（从配置文件同步到数据库）');
        $this->addArgument('organization_code', InputArgument::REQUIRED, '组织编码');
    }

    public function handle(): void
    {
        $this->aiAbilityAppService = $this->container->get(AiAbilityAppService::class);

        $organizationCode = $this->input->getArgument('organization_code');
        if (empty($organizationCode)) {
            $this->error('请提供组织编码');
            return;
        }

        $this->info("开始为组织 {$organizationCode} 初始化AI能力数据...");

        try {
            // 创建一个临时的 Authorization 对象用于命令行
            $authorization = new MagicUserAuthorization();
            $authorization->setOrganizationCode($organizationCode);

            $count = $this->aiAbilityAppService->initializeAbilities($authorization);
            $this->info("成功初始化 {$count} 个AI能力");
        } catch (Throwable $e) {
            $this->error('初始化AI能力数据失败: ' . $e->getMessage());
            $this->error($e->getTraceAsString());
            return;
        }

        $this->info('AI能力数据初始化完成');
    }
}

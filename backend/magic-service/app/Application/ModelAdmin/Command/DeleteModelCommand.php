<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderModelsRepository;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * @Command
 */
#[Command]
class DeleteModelCommand extends HyperfCommand
{
    /**
     * @var ContainerInterface
     */
    protected $container;

    protected ServiceProviderModelsRepository $serviceProviderModelsRepository;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderModelsRepository = $container->get(ServiceProviderModelsRepository::class);

        parent::__construct('model:delete');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('删除服务提供商模型');

        $this->addOption('model-id', null, InputOption::VALUE_REQUIRED, '模型ID');
        $this->addOption('organization-code', null, InputOption::VALUE_REQUIRED, '组织编码');
    }

    public function handle()
    {
        $modelId = $this->input->getOption('model-id');
        $organizationCode = $this->input->getOption('organization-code');

        if (empty($modelId)) {
            $this->output->error('模型ID不能为空');
            return 1;
        }

        if (empty($organizationCode)) {
            $this->output->error('组织编码不能为空');
            return 1;
        }

        try {
            $this->serviceProviderModelsRepository->deleteByModelIdAndOrganizationCode($modelId, $organizationCode);
            $this->serviceProviderModelsRepository->deleteByModelParentId([$modelId]);

            $this->output->success(sprintf('成功删除模型 [%s]', $modelId));
            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('删除模型失败: %s', $e->getMessage()));
            return 1;
        }
    }
}

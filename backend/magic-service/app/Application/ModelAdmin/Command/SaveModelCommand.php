<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Application\ModelAdmin\Service\ServiceProviderAppService;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use Hyperf\Codec\Json;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class SaveModelCommand extends HyperfCommand
{
    /**
     * @var ContainerInterface
     */
    protected $container;

    /**
     * @var ServiceProviderAppService
     */
    protected $appService;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->appService = $container->get(ServiceProviderAppService::class);

        parent::__construct('model:save');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('保存服务提供商模型');

        // 只保留config参数(JSON格式)和组织编码参数
        $this->addOption('config', null, InputOption::VALUE_REQUIRED, '模型完整JSON配置数据');
        $this->addOption('organization-code', null, InputOption::VALUE_REQUIRED, '组织编码');
    }

    public function handle()
    {
        // 获取必填参数
        $jsonData = $this->input->getOption('config');
        $organizationCode = $this->input->getOption('organization-code');

        // 验证必填参数
        if (empty($jsonData)) {
            $this->output->error('模型配置数据不能为空');
            return 1;
        }

        if (empty($organizationCode)) {
            $this->output->error('组织编码不能为空');
            return 1;
        }

        try {
            $data = Json::decode($jsonData);

            // 创建实体
            $entity = new ServiceProviderModelsEntity($data);

            // 设置组织编码
            $entity->setOrganizationCode($organizationCode);

            // 保存模型
            $resultDTO = $this->appService->saveModelToServiceProvider($entity);

            $this->output->success(sprintf('成功保存模型 [%s] - %s', $resultDTO->getModelId(), $resultDTO->getName()));
            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('保存模型失败: %s', $e->getMessage()));
            return 1;
        }
    }
}

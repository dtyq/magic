<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderConfigRepository;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use Hyperf\Codec\Json;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * @Command
 */
#[Command]
class AddServiceProviderConfigCommand extends HyperfCommand
{
    /**
     * @var ContainerInterface
     */
    protected $container;

    protected ServiceProviderConfigRepository $serviceProviderConfigRepository;

    protected MagicOrganizationEnvDomainService $organizationEnvDomainService;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderConfigRepository = $container->get(ServiceProviderConfigRepository::class);
        $this->organizationEnvDomainService = $container->get(MagicOrganizationEnvDomainService::class);

        parent::__construct('service-provider-config:add');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('添加服务商配置到所有组织');

        $this->addOption('config', null, InputOption::VALUE_REQUIRED, 'JSON格式的服务商配置');
    }

    public function handle()
    {
        $configData = $this->input->getOption('config');

        if (empty($configData)) {
            $this->output->error('请提供JSON格式的服务商配置');
            $this->output->info('示例: --config=\'{"service_provider_id":123,"alias":"配置别名","status":1}\'');
            return 1;
        }

        try {
            // Parse JSON and create ServiceProviderConfigEntity
            $data = Json::decode($configData);

            // Validate required fields
            if (empty($data['service_provider_id'])) {
                $this->output->error('服务提供商ID不能为空');
                return 1;
            }

            // Create base ServiceProviderConfigEntity from JSON
            $baseConfigEntity = new ServiceProviderConfigEntity($data);

            // Get all organization codes
            $organizationCodes = $this->organizationEnvDomainService->getAllOrganizationCodes();
            $this->output->info(sprintf('为 %d 个组织添加服务商配置', count($organizationCodes)));

            // Clone base entity for each organization
            $configEntities = [];
            foreach ($organizationCodes as $organizationCode) {
                $configEntity = clone $baseConfigEntity;
                $configEntity->setOrganizationCode($organizationCode);
                $configEntities[] = $configEntity;
            }

            // Batch add service provider configs
            $this->serviceProviderConfigRepository->batchAddServiceProviderConfigs($configEntities);

            $this->output->success(sprintf(
                '成功为服务提供商 [%d] 添加配置到 %d 个组织',
                $data['service_provider_id'],
                count($organizationCodes)
            ));

            // Display organization codes summary
            if (count($organizationCodes) <= 10) {
                $this->output->info('组织: ' . implode(', ', $organizationCodes));
            } else {
                $this->output->info(sprintf('已添加到 %d 个组织 (组织过多，不显示详情)', count($organizationCodes)));
            }

            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('添加服务商配置失败: %s', $e->getMessage()));
            return 1;
        }
    }
}

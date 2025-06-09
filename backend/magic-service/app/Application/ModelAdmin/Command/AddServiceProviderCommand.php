<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Factory\ServiceProviderEntityFactory;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderRepository;
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
class AddServiceProviderCommand extends HyperfCommand
{
    /**
     * @var ContainerInterface
     */
    protected $container;

    protected ServiceProviderRepository $serviceProviderRepository;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderRepository = $container->get(ServiceProviderRepository::class);

        parent::__construct('service-provider:add');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('添加服务提供商');

        $this->addOption('config', null, InputOption::VALUE_REQUIRED, 'JSON格式的服务提供商配置');
    }

    public function handle()
    {
        $configData = $this->input->getOption('config');

        if (empty($configData)) {
            $this->output->error('请提供JSON格式的服务提供商配置');
            $this->output->info('示例: --config=\'{"name":"OpenAI","provider_code":"openai","category":"llm"}\'');
            return 1;
        }

        try {
            // Parse JSON and create entity
            $data = Json::decode($configData);

            // Validate required fields before creating entity
            if (empty($data['name'])) {
                $this->output->error('服务提供商名称不能为空');
                return 1;
            }

            if (empty($data['provider_code'])) {
                $this->output->error('服务提供商编码不能为空');
                return 1;
            }

            if (empty($data['category'])) {
                $this->output->error('服务提供商类型不能为空');
                return 1;
            }

            // Validate category
            $categoryEnum = ServiceProviderCategory::tryFrom($data['category']);
            if (! $categoryEnum) {
                $this->output->error('无效的类型，必须是: llm 或 vlm');
                return 1;
            }

            // Validate provider type if provided
            $providerType = (int) ($data['provider_type'] ?? 0);
            $providerTypeEnum = ServiceProviderType::tryFrom($providerType);
            if (! $providerTypeEnum) {
                $this->output->error('无效的提供商类型，必须是: 0 (普通), 1 (官方), 或 2 (自定义)');
                return 1;
            }

            // Create entity using factory
            $serviceProviderEntity = ServiceProviderEntityFactory::toEntity($data);

            $result = $this->serviceProviderRepository->insert($serviceProviderEntity);

            $this->output->success(sprintf(
                '成功添加服务提供商 [%s]，ID: %d',
                $serviceProviderEntity->getName(),
                $result->getId()
            ));
            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('添加服务提供商失败: %s', $e->getMessage()));
            return 1;
        }
    }
}

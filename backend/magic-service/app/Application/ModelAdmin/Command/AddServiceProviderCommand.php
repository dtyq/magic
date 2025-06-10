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
        $this->setDescription('Add service provider');

        $this->addOption('config', null, InputOption::VALUE_REQUIRED, 'Service provider configuration in JSON format');
    }

    public function handle()
    {
        $configData = $this->input->getOption('config');

        if (empty($configData)) {
            $this->output->error('Please provide service provider configuration in JSON format');
            $this->output->info('Example: --config=\'{"name":"OpenAI","provider_code":"openai","category":"llm"}\'');
            return 1;
        }

        try {
            // Parse JSON and create entity
            $data = Json::decode($configData);

            // Validate required fields before creating entity
            if (empty($data['name'])) {
                $this->output->error('Service provider name cannot be empty');
                return 1;
            }

            if (empty($data['provider_code'])) {
                $this->output->error('Service provider code cannot be empty');
                return 1;
            }

            if (empty($data['category'])) {
                $this->output->error('Service provider category cannot be empty');
                return 1;
            }

            // Validate category
            $categoryEnum = ServiceProviderCategory::tryFrom($data['category']);
            if (! $categoryEnum) {
                $this->output->error('Invalid category, must be: llm or vlm');
                return 1;
            }

            // Validate provider type if provided
            $providerType = (int) ($data['provider_type'] ?? 0);
            $providerTypeEnum = ServiceProviderType::tryFrom($providerType);
            if (! $providerTypeEnum) {
                $this->output->error('Invalid provider type, must be: 0 (normal), 1 (official), or 2 (custom)');
                return 1;
            }

            // Create entity using factory
            $serviceProviderEntity = ServiceProviderEntityFactory::toEntity($data);

            $result = $this->serviceProviderRepository->insert($serviceProviderEntity);

            $this->output->success(sprintf(
                'Successfully added service provider [%s], ID: %d',
                $serviceProviderEntity->getName(),
                $result->getId()
            ));
            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('Failed to add service provider: %s', $e->getMessage()));
            return 1;
        }
    }
}

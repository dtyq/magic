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
        $this->setDescription('Add service provider configuration to all organizations');

        $this->addOption('config', null, InputOption::VALUE_REQUIRED, 'Service provider configuration in JSON format');
    }

    public function handle()
    {
        $configData = $this->input->getOption('config');

        if (empty($configData)) {
            $this->output->error('Please provide service provider configuration in JSON format');
            $this->output->info('Example: --config=\'{"service_provider_id":123,"alias":"config alias","status":1}\'');
            return 1;
        }

        try {
            // Parse JSON and create ServiceProviderConfigEntity
            $data = Json::decode($configData);

            // Validate required fields
            if (empty($data['service_provider_id'])) {
                $this->output->error('Service provider ID cannot be empty');
                return 1;
            }

            // Create base ServiceProviderConfigEntity from JSON
            $baseConfigEntity = new ServiceProviderConfigEntity($data);

            // Get all organization codes
            $organizationCodes = $this->organizationEnvDomainService->getAllOrganizationCodes();
            $this->output->info(sprintf('Adding service provider configuration for %d organizations', count($organizationCodes)));

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
                'Successfully added configuration for service provider [%d] to %d organizations',
                $data['service_provider_id'],
                count($organizationCodes)
            ));

            // Display organization codes summary
            if (count($organizationCodes) <= 10) {
                $this->output->info('Organizations: ' . implode(', ', $organizationCodes));
            } else {
                $this->output->info(sprintf('Added to %d organizations (too many organizations, details not shown)', count($organizationCodes)));
            }

            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('Failed to add service provider configuration: %s', $e->getMessage()));
            return 1;
        }
    }
}

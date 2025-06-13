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
        $this->setDescription('Delete service provider model');

        $this->addOption('model-id', null, InputOption::VALUE_REQUIRED, 'Model ID');
        $this->addOption('organization-code', null, InputOption::VALUE_REQUIRED, 'Organization code');
    }

    public function handle()
    {
        $modelId = $this->input->getOption('model-id');
        $organizationCode = $this->input->getOption('organization-code');

        if (empty($modelId)) {
            $this->output->error('Model ID cannot be empty');
            return 1;
        }

        if (empty($organizationCode)) {
            $this->output->error('Organization code cannot be empty');
            return 1;
        }

        try {
            $this->serviceProviderModelsRepository->deleteByModelIdAndOrganizationCode($modelId, $organizationCode);
            $this->serviceProviderModelsRepository->deleteByModelParentId([$modelId]);

            $this->output->success(sprintf('Successfully deleted model [%s]', $modelId));
            return 0;
        } catch (Throwable $e) {
            $this->output->error(sprintf('Failed to delete model: %s', $e->getMessage()));
            return 1;
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use Hyperf\Codec\Json;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Symfony\Component\Console\Input\InputOption;

#[Command]
class ReconcileMagicClawPermissionCommand extends HyperfCommand
{
    protected ?string $name = 'magic-claw:reconcile-permission';

    public function __construct(private readonly MagicClawReconciliationAppService $service)
    {
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Preview revoked Magic Claw resources in one organization; optionally enqueue reconciliation');
        $this->addOption('organization-code', null, InputOption::VALUE_REQUIRED, 'Required organization code');
        $this->addOption('apply', null, InputOption::VALUE_NONE, 'Enqueue durable reconciliation after displaying the inventory');
    }

    public function handle(): int
    {
        $organization = trim((string) $this->input->getOption('organization-code'));
        if ($organization === '') {
            $this->error('--organization-code is required; all-organization repair is not supported.');
            return self::FAILURE;
        }
        $claws = 0;
        $resources = 0;
        $lastClaw = '';
        foreach ($this->service->preview($organization) as $resource) {
            if ($lastClaw !== $resource['claw_id']) {
                ++$claws;
                $lastClaw = $resource['claw_id'];
            }
            $resources += $resource['sandbox_id'] !== '' ? 1 : 0;
            $this->line(Json::encode($resource));
        }
        $this->info(sprintf('Revoked claws: %d; recorded sandbox bindings: %d. Unrecorded historical pods require separate verification.', $claws, $resources));
        if ($this->input->getOption('apply')) {
            $this->service->requestReconciliation($organization, 'manual_repair');
            $this->info('Reconciliation queued; the worker rechecks current permissions before stopping each resource.');
        } else {
            $this->info('Preview only. No policy, reconciliation record or sandbox was changed.');
        }
        return self::SUCCESS;
    }
}

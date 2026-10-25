<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Application\Audit\ModelCall\Service\ModelCallAuditArchiveService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
final class ModelCallAuditArchiveCommand extends HyperfCommand
{
    public function __construct(
        private readonly ContainerInterface $container,
    ) {
        parent::__construct('model-audit:archive');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Archive model audit hourly statistics by date range');
        $this->addOption('start-date', null, InputOption::VALUE_REQUIRED, 'First date to archive (YYYY-MM-DD)');
        $this->addOption('end-date', null, InputOption::VALUE_REQUIRED, 'Last date to archive (YYYY-MM-DD)');
    }

    public function handle(): int
    {
        $startDate = (string) $this->input->getOption('start-date');
        $endDate = (string) $this->input->getOption('end-date');

        try {
            $result = $this->container
                ->get(ModelCallAuditArchiveService::class)
                ->archiveRange($startDate, $endDate);
            $this->info(sprintf(
                'Archive finished: total=%d, success=%d, failed=%d',
                $result['total'],
                $result['success'],
                $result['failed']
            ));
            if ($result['failed_dates'] !== []) {
                $this->error('Failed dates: ' . implode(', ', $result['failed_dates']));
            }
            return $result['failed'] === 0 ? self::SUCCESS : self::FAILURE;
        } catch (Throwable $throwable) {
            $this->error($throwable->getMessage());
            return self::FAILURE;
        }
    }
}

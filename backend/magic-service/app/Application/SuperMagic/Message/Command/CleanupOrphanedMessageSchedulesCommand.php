<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Command;

use App\Application\SuperMagic\Message\Service\MessageScheduleCleanupAppService;
use Dtyq\TaskScheduler\Util\Functions;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class CleanupOrphanedMessageSchedulesCommand extends HyperfCommand
{
    public function __construct(private readonly MessageScheduleCleanupAppService $cleanupAppService)
    {
        parent::__construct('super-magic:cleanup-orphaned-message-schedules');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Preview or clean schedules whose bound projects are deleted or missing');
        $this->addOption('execute', null, InputOption::VALUE_NONE, 'Execute cleanup; preview only by default');
        $this->addOption('batch-size', null, InputOption::VALUE_REQUIRED, 'Schedules per batch (1-1000)', '100');
        $this->addOption('organization-code', null, InputOption::VALUE_REQUIRED, 'Limit candidates to this organization');
        $this->addOption('after-id', null, InputOption::VALUE_REQUIRED, 'Start after this schedule ID', '0');
    }

    public function handle(): int
    {
        $batchSize = filter_var($this->input->getOption('batch-size'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
        $afterId = filter_var($this->input->getOption('after-id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($batchSize === false || $afterId === false) {
            $this->error('batch-size 必须为 1-1000 的整数，after-id 必须为非负整数');
            return self::INVALID;
        }

        $execute = (bool) $this->input->getOption('execute');
        $organizationCode = $this->input->getOption('organization-code');
        $organizationCode = $organizationCode === null ? null : trim((string) $organizationCode);
        if ($organizationCode === '') {
            $this->error('organization-code 不能为空');
            return self::INVALID;
        }

        $this->line(sprintf('mode=%s environment=%s', $execute ? 'execute' : 'preview', Functions::getEnv() ?: '(unfiltered)'));
        $total = $cleaned = $skipped = $failed = 0;
        do {
            $candidates = $this->cleanupAppService->getCandidates($afterId, $batchSize, $organizationCode);
            foreach ($candidates as $candidate) {
                $afterId = $candidate->getId();
                ++$total;
                $this->line(sprintf(
                    'id=%d project_id=%d organization_code=%s deleted=%s external_id=message_schedule_%d',
                    $afterId,
                    $candidate->getProjectId(),
                    $candidate->getOrganizationCode(),
                    $candidate->getDeletedAt() === null ? 'false' : 'true',
                    $afterId
                ));
                if (! $execute) {
                    continue;
                }
                try {
                    if ($this->cleanupAppService->cleanupSchedule($afterId, 'system')) {
                        ++$cleaned;
                    } else {
                        ++$skipped;
                    }
                } catch (Throwable $exception) {
                    ++$failed;
                    $this->error(sprintf('清理失败 schedule_id=%d: %s', $afterId, $exception->getMessage()));
                }
            }
        } while (count($candidates) === $batchSize);

        $this->line(sprintf('candidates=%d cleaned=%d skipped=%d failed=%d last_id=%d', $total, $cleaned, $skipped, $failed, $afterId));
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}

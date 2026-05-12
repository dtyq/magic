<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Command;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;
use Dtyq\SuperMagic\Domain\Agent\Service\MagicClawDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class RestartAllMagicClawSandboxCommand extends HyperfCommand
{
    protected ?string $name = 'magic-claw:restart-sandbox-all';

    private LoggerInterface $logger;

    public function __construct(
        private readonly MagicClawDomainService $magicClawDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly AgentAppService $agentAppService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('magic-claw-restart-sandbox-all');
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Restart sandboxes for all valid Magic Claws');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'List targets without restarting sandboxes');
        $this->addOption('code', null, InputOption::VALUE_OPTIONAL, 'Restart only the Magic Claw with this code');
        $this->addOption('page-size', null, InputOption::VALUE_OPTIONAL, 'Page size for scanning Magic Claws', 100);
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, 'Maximum records to scan, 0 means unlimited', 0);
        $this->addOption('sleep-ms', null, InputOption::VALUE_OPTIONAL, 'Sleep milliseconds after each restart', 0);
    }

    public function handle(): void
    {
        $dryRun = (bool) $this->input->getOption('dry-run');
        $pageSize = max(1, (int) $this->input->getOption('page-size'));
        $limit = max(0, (int) $this->input->getOption('limit'));
        $sleepMs = max(0, (int) $this->input->getOption('sleep-ms'));
        $code = trim((string) $this->input->getOption('code'));

        $stats = [
            'scanned' => 0,
            'eligible' => 0,
            'restarted' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];

        $this->info('Scanning Magic Claws for sandbox restart...');
        $this->line(sprintf(
            'Options: dry_run=%s, code=%s, page_size=%d, limit=%d, sleep_ms=%d',
            $dryRun ? 'true' : 'false',
            $code === '' ? 'all' : $code,
            $pageSize,
            $limit,
            $sleepMs
        ));

        $page = 1;
        while (true) {
            $result = $this->magicClawDomainService->getAllValidList($page, $pageSize);
            /** @var MagicClawEntity[] $claws */
            $claws = $result['list'];
            if (empty($claws)) {
                break;
            }

            $topicIdMap = $this->resolveTopicIdMap($claws);

            foreach ($claws as $claw) {
                if ($code !== '' && $claw->getCode() !== $code) {
                    continue;
                }

                if ($limit > 0 && $stats['scanned'] >= $limit) {
                    $this->printSummary($stats);
                    return;
                }

                ++$stats['scanned'];

                $projectId = $claw->getProjectId();
                if ($projectId === null) {
                    $this->skip($stats, $claw, 'project_id is empty');
                    continue;
                }

                if (! array_key_exists($projectId, $topicIdMap)) {
                    $this->skip($stats, $claw, 'project not found or deleted');
                    continue;
                }

                $topicId = $topicIdMap[$projectId];
                if ($topicId === null) {
                    $this->skip($stats, $claw, 'current_topic_id is empty');
                    continue;
                }

                ++$stats['eligible'];
                $this->line(sprintf(
                    '[TARGET] code=%s, user_id=%s, organization_code=%s, project_id=%d, topic_id=%d',
                    $claw->getCode(),
                    $claw->getUserId(),
                    $claw->getOrganizationCode(),
                    $projectId,
                    $topicId
                ));

                if ($dryRun) {
                    if ($code !== '') {
                        $this->printSummary($stats);
                        return;
                    }
                    continue;
                }

                try {
                    $sandboxId = $this->agentAppService->restartSandbox(
                        $this->createDataIsolation($claw),
                        $topicId
                    );
                    ++$stats['restarted'];
                    $this->info(sprintf('[OK] code=%s, sandbox_id=%s', $claw->getCode(), $sandboxId));
                    $this->logger->info('Magic Claw sandbox restarted', [
                        'code' => $claw->getCode(),
                        'user_id' => $claw->getUserId(),
                        'organization_code' => $claw->getOrganizationCode(),
                        'project_id' => $projectId,
                        'topic_id' => $topicId,
                        'sandbox_id' => $sandboxId,
                    ]);

                    if ($sleepMs > 0) {
                        usleep($sleepMs * 1000);
                    }
                } catch (Throwable $e) {
                    ++$stats['failed'];
                    $this->error(sprintf(
                        '[FAIL] code=%s, project_id=%d, topic_id=%d, error=%s',
                        $claw->getCode(),
                        $projectId,
                        $topicId,
                        $e->getMessage()
                    ));
                    $this->logger->error('Failed to restart Magic Claw sandbox', [
                        'code' => $claw->getCode(),
                        'user_id' => $claw->getUserId(),
                        'organization_code' => $claw->getOrganizationCode(),
                        'project_id' => $projectId,
                        'topic_id' => $topicId,
                        'exception' => get_class($e),
                        'error' => $e->getMessage(),
                    ]);
                }

                if ($code !== '') {
                    $this->printSummary($stats);
                    return;
                }
            }

            if ($stats['scanned'] >= (int) $result['total']) {
                break;
            }
            ++$page;
        }

        if ($code !== '' && $stats['scanned'] === 0) {
            $this->line(sprintf('[NOT_FOUND] Magic Claw code not found: %s', $code));
        }

        $this->printSummary($stats);
    }

    /**
     * @param MagicClawEntity[] $claws
     * @return array<int, null|int>
     */
    private function resolveTopicIdMap(array $claws): array
    {
        $projectIds = array_values(array_unique(array_filter(
            array_map(static fn (MagicClawEntity $claw): ?int => $claw->getProjectId(), $claws)
        )));

        if (empty($projectIds)) {
            return [];
        }

        return $this->projectDomainService->getTopicIdMapByProjectIds($projectIds);
    }

    private function createDataIsolation(MagicClawEntity $claw): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($claw->getUserId());
        $dataIsolation->setCurrentOrganizationCode($claw->getOrganizationCode());
        $dataIsolation->setThirdPartyOrganizationCode($claw->getOrganizationCode());
        return $dataIsolation;
    }

    /**
     * @param array{scanned: int, eligible: int, restarted: int, skipped: int, failed: int} $stats
     */
    private function skip(array &$stats, MagicClawEntity $claw, string $reason): void
    {
        ++$stats['skipped'];
        $this->line(sprintf(
            '[SKIP] code=%s, user_id=%s, organization_code=%s, project_id=%s, reason=%s',
            $claw->getCode(),
            $claw->getUserId(),
            $claw->getOrganizationCode(),
            $claw->getProjectId() === null ? 'null' : (string) $claw->getProjectId(),
            $reason
        ));
    }

    /**
     * @param array{scanned: int, eligible: int, restarted: int, skipped: int, failed: int} $stats
     */
    private function printSummary(array $stats): void
    {
        $this->line('');
        $this->info('Magic Claw sandbox restart summary:');
        $this->line('  scanned: ' . $stats['scanned']);
        $this->line('  eligible: ' . $stats['eligible']);
        $this->line('  restarted: ' . $stats['restarted']);
        $this->line('  skipped: ' . $stats['skipped']);
        $this->line('  failed: ' . $stats['failed']);

        $this->logger->info('Magic Claw sandbox restart command finished', $stats);
    }
}

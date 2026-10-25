<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Crontab;

use App\Application\SuperMagic\Agent\Service\AdminSuperMagicAgentAppService;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

#[Crontab(
    rule: '0 3 * * *',
    name: 'AgentMarketVectorIndexDailySyncCrontab',
    singleton: true,
    mutexExpires: 3600,
    onOneServer: true,
    callback: 'execute',
    memo: '每日补偿同步数字员工市场向量索引',
)]
final class AgentMarketVectorIndexDailySyncCrontab
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly AdminSuperMagicAgentAppService $adminAgentAppService,
        ?LoggerFactory $loggerFactory = null,
    ) {
        $this->logger = $loggerFactory?->get('agent-market-vector-sync') ?? new NullLogger();
    }

    public function execute(): void
    {
        $organizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($organizationCode === '') {
            $this->logger->warning('Agent market vector daily sync skipped because official organization is not configured');
            return;
        }

        $dataIsolation = SuperMagicAgentDataIsolation::create($organizationCode, 'system');
        $dataIsolation->setContainOfficialOrganization(true);
        $this->adminAgentAppService->reconcileMarketVectorIndex($dataIsolation);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Crontab;

use App\Application\SuperMagic\Skill\Service\AdminSkillAppService;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

#[Crontab(
    rule: '0 3 * * *',
    name: 'SkillMarketVectorIndexDailySyncCrontab',
    singleton: true,
    mutexExpires: 3600,
    onOneServer: true,
    callback: 'execute',
    memo: '每日补偿同步 Skill 市场向量索引',
)]
final class SkillMarketVectorIndexDailySyncCrontab
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly AdminSkillAppService $skillAppService,
        ?LoggerFactory $loggerFactory = null,
    ) {
        $this->logger = $loggerFactory?->get('skill-market-vector-sync') ?? new NullLogger();
    }

    public function execute(): void
    {
        $organizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($organizationCode === '') {
            $this->logger->warning('Skill market vector daily sync skipped because official organization is not configured');
            return;
        }

        $dataIsolation = new SkillDataIsolation();
        $dataIsolation->setCurrentOrganizationCode($organizationCode);
        $dataIsolation->setCurrentUserId('system');
        $dataIsolation->setOfficialOrganizationCodes([$organizationCode]);
        $dataIsolation->setContainOfficialOrganization(true);
        $this->skillAppService->reconcileMarketVectorIndex($dataIsolation);
    }
}

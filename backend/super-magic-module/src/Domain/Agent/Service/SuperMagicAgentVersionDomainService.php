<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;

/**
 * Agent 版本领域服务.
 */
class SuperMagicAgentVersionDomainService
{
    public function __construct(
        protected AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }

    /**
     * @return array{total:int, list: array<AgentVersionEntity>}
     */
    public function queriesByCode(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array {
        return $this->agentVersionRepository->queriesByCode($dataIsolation, $code, $publishTargetType, $reviewStatus, $page);
    }

    public function getCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCode($dataIsolation, $code);
    }
}

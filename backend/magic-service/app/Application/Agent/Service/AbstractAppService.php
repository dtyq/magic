<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Agent\Service\AgentDomainService;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Agent\Service\MagicAgentVersionDomainService;
use App\Domain\Agent\Service\MagicBotThirdPlatformChatDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowVersionDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Util\Locker\RedisLocker;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;

abstract class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    protected LoggerInterface $logger;

    public function __construct(
        protected readonly MagicAgentDomainService $magicAgentDomainService,
        protected readonly MagicAgentVersionDomainService $magicAgentVersionDomainService,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly MagicFlowVersionDomainService $magicFlowVersionDomainService,
        protected readonly FileDomainService $fileDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
        protected readonly RedisLocker $redisLocker,
        protected readonly MagicAccountDomainService $magicAccountDomainService,
        protected readonly MagicBotThirdPlatformChatDomainService $magicBotThirdPlatformChatDomainService,
        protected readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        protected readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        protected readonly AgentDomainService $agentDomainService,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        public readonly LoggerFactory $loggerFactory,
        protected readonly Redis $redis,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    protected function getAgentOperation(PermissionDataIsolation $permissionDataIsolation, int|string $agentId): Operation
    {
        if (empty($agentId)) {
            return Operation::None;
        }
        return $this->operationPermissionAppService->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::AgentCode,
            (string) $agentId,
            $permissionDataIsolation->getCurrentUserId()
        );
    }
}

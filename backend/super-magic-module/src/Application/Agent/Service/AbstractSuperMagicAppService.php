<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractSuperMagicAppService extends AbstractKernelAppService
{
    protected readonly LoggerInterface $logger;

    public function __construct(
        protected SuperMagicAgentDomainService $superMagicAgentDomainService,
        protected MicroAgentFactory $microAgentFactory,
        protected LoggerFactory $loggerFactory,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    protected function createSuperMagicDataIsolation(Authenticatable|BaseDataIsolation $authorization): SuperMagicAgentDataIsolation
    {
        $dataIsolation = new SuperMagicAgentDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createContactDataIsolation(Authenticatable|BaseDataIsolation $authorization): ContactDataIsolation
    {
        // 先创建SuperMagicDataIsolation，然后转换为ContactDataIsolation
        $superMagicDataIsolation = $this->createSuperMagicDataIsolation($authorization);
        return $this->createContactDataIsolationByBase($superMagicDataIsolation);
    }
}

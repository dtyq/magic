<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractSuperMagicAppService extends AbstractKernelAppService
{
    public function __construct(
        protected SuperMagicAgentDomainService $superMagicAgentDomainService
    ) {
        parent::__construct();
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
}

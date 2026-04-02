<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\IngestThirdPartyMessageRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class TaskApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly TopicTaskAppService $topicTaskAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Ingest a third-party user message and dispatch it through the standard task flow.
     */
    public function ingestThirdPartyMessage(): array
    {
        $authorization = $this->getAuthorization();
        $requestDTO = IngestThirdPartyMessageRequestDTO::fromRequest($this->request);

        $dataIsolation = DataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        return $this->topicTaskAppService->ingestThirdPartyMessage(
            $dataIsolation,
            $requestDTO->toCreateTaskRequestDTO(),
            $requestDTO->getSource()
        );
    }
}

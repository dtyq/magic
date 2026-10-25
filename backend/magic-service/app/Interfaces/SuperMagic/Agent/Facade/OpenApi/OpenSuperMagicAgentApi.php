<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\Facade\OpenApi;

use App\Application\SuperMagic\Agent\Service\OpenDigitalEmployeeAppService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Agent\DTO\Request\GetMyAvailableAgentsRequestDTO;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class OpenSuperMagicAgentApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly SuperMagicAgentAppService $superMagicAgentAppService,
        private readonly OpenDigitalEmployeeAppService $openDigitalEmployeeAppService,
    ) {
        parent::__construct($request);
    }

    public function getMyAvailableAgents(): array
    {
        $requestDTO = GetMyAvailableAgentsRequestDTO::fromRequest($this->request);

        return $this->superMagicAgentAppService->getMyAvailableAgents($this->getCurrentAuthorization(), $requestDTO);
    }

    public function sortListQueries(): array
    {
        return $this->openDigitalEmployeeAppService->getSortList($this->getCurrentAuthorization());
    }

    public function getModels(string $code): array
    {
        return $this->openDigitalEmployeeAppService->getModels($this->getCurrentAuthorization(), $code);
    }

    public function getDefaultConfig(string $code): array
    {
        return $this->openDigitalEmployeeAppService->getDefaultConfig($this->getCurrentAuthorization(), $code);
    }

    public function hireAgent(string $code): array
    {
        $this->superMagicAgentAppService->hireAgent($this->getCurrentAuthorization(), $code);

        return [];
    }

    public function fireAgent(string $code): array
    {
        $result = $this->superMagicAgentAppService->delete($this->getCurrentAuthorization(), $code);

        return ['success' => $result];
    }

    private function getCurrentAuthorization(): MagicUserAuthorization
    {
        $authorization = RequestCoContext::getUserAuthorization();
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        return $authorization;
    }
}

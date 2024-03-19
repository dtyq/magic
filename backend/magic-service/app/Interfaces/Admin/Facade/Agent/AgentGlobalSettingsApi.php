<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Facade\Agent;

use App\Application\Admin\Agent\Service\AdminAgentAppService;
use App\Interfaces\Admin\DTO\Request\EditAgentGlobalSettingsRequestDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse('low_code')]
class AgentGlobalSettingsApi extends AbstractApi
{
    public function __construct(
        protected AdminAgentAppService $globalSettingsAppService,
        RequestInterface $request,
        AuthManager $authManager,
    ) {
        parent::__construct(
            $authManager,
            $request,
        );
    }

    public function updateGlobalSettings(): array
    {
        $settingsDTO = EditAgentGlobalSettingsRequestDTO::fromRequest($this->request);
        return $this->globalSettingsAppService->updateGlobalSettings(
            $this->getAuthorization(),
            $settingsDTO->getSettings()
        );
    }

    public function getGlobalSettings(): array
    {
        /** @var MagicUserAuthorization $userAuthorization */
        $userAuthorization = $this->getAuthorization();
        return $this->globalSettingsAppService->getGlobalSettings($userAuthorization);
    }
}

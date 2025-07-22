<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\Contact\Service\MagicUserSettingAppService;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MCPSuperMagicProjectSettingAdminApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MagicUserSettingAppService $magicUserSettingAppService;

    public function save(string $projectId)
    {
        $authorization = $this->getAuthorization();
        $userSetting = $this->magicUserSettingAppService->saveProjectMcpServerConfig($authorization, $projectId, $this->request->input('servers', []));
        return $userSetting->getValue();
    }

    public function get(string $projectId)
    {
        $authorization = $this->getAuthorization();
        $userSetting = $this->magicUserSettingAppService->getProjectMcpServerConfig($authorization, $projectId);
        if ($userSetting) {
            return $userSetting->getValue();
        }
        return [];
    }
}

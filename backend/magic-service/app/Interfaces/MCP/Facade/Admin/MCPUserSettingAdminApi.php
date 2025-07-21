<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\MCP\Service\MCPUserSettingAppService;
use App\Interfaces\MCP\Assembler\MCPUserSettingAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MCPUserSettingAdminApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MCPUserSettingAppService $mcpUserSettingAppService;

    /**
     * 保存用户MCP服务的required fields.
     */
    public function saveRequiredFields(string $code)
    {
        $authorization = $this->getAuthorization();
        $input = $this->request->all();

        // Extract required fields from input
        $requireFields = $input['require_fields'] ?? [];

        // Validate required fields is an array
        if (! is_array($requireFields)) {
            $requireFields = [];
        }

        $entity = $this->mcpUserSettingAppService->saveUserRequiredFields(
            $authorization,
            $code,
            $requireFields
        );

        return MCPUserSettingAssembler::createSaveResultDTO($entity);
    }

    /**
     * 获取用户MCP服务的设置信息.
     */
    public function getUserSettings(string $code)
    {
        $authorization = $this->getAuthorization();
        $redirectUrl = $this->request->input('redirect_url', '');

        $settings = $this->mcpUserSettingAppService->getUserSettings(
            $authorization,
            $code,
            $redirectUrl
        );

        return MCPUserSettingAssembler::createDTO($settings);
    }
}

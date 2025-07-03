<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ServiceConfigInterface;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Qbhy\HyperfAuth\Authenticatable;

class MCPUserSettingAppService extends AbstractMCPAppService
{
    /**
     * Save user MCP service required fields.
     */
    public function saveUserRequiredFields(Authenticatable $authorization, string $mcpServerCode, array $requireFields): MCPUserSettingEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        // Check user permission for this MCP server
        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('r', $mcpServerCode);

        // Validate MCP server exists and user has access
        $mcpServer = $this->mcpServerDomainService->getByCode($dataIsolation, $mcpServerCode);
        if (! $mcpServer) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $mcpServerCode]);
        }

        // Get or create user setting
        $userSetting = $this->mcpUserSettingDomainService->getByUserAndMcpServer(
            $dataIsolation,
            $dataIsolation->getCurrentUserId(),
            $mcpServer->getCode()
        );

        if (! $userSetting) {
            $userSetting = new MCPUserSettingEntity();
            $userSetting->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $userSetting->setUserId($dataIsolation->getCurrentUserId());
            $userSetting->setMcpServerId($mcpServer->getCode());
        }

        // Update required fields
        $userSetting->setRequireFieldsFromArray($requireFields);

        return $this->mcpUserSettingDomainService->save($dataIsolation, $userSetting);
    }

    /**
     * Get user MCP service settings with OAuth status.
     */
    public function getUserSettings(Authenticatable $authorization, string $mcpServerCode): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        // Check user permission for this MCP server
        $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
        $operation->validate('r', $mcpServerCode);

        // Validate MCP server exists and user has access
        $mcpServer = $this->mcpServerDomainService->getByCode($dataIsolation, $mcpServerCode);
        if (! $mcpServer) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $mcpServerCode]);
        }

        // Get user setting
        $userSetting = $this->mcpUserSettingDomainService->getByUserAndMcpServer(
            $dataIsolation,
            $dataIsolation->getCurrentUserId(),
            $mcpServer->getCode()
        );

        $requireFields = $userSetting ? $userSetting->getRequireFieldsAsArray() : [];

        // Check service configuration and authentication status
        $serviceConfig = $mcpServer->getServiceConfig();

        $authType = ServiceConfigAuthType::NONE;
        if ($serviceConfig instanceof ExternalSSEServiceConfig) {
            $authType = $serviceConfig->getAuthType();
        }

        return [
            'require_fields' => $requireFields,
            'auth_type' => $authType->value,
            'auth_config' => $this->generateAuthConfig($serviceConfig, $userSetting),
        ];
    }

    private function generateAuthConfig(ServiceConfigInterface $serviceConfig, ?MCPUserSettingEntity $userSetting): array
    {
        $result = [
            'is_authenticated' => false,
            'oauth_url' => '',
        ];

        // Only handle ExternalSSEServiceConfig with OAuth2
        if (! $serviceConfig instanceof ExternalSSEServiceConfig) {
            return $result;
        }

        $authType = $serviceConfig->getAuthType();
        if ($authType !== ServiceConfigAuthType::OAUTH2) {
            return $result;
        }

        // Check if user is already authenticated
        if ($userSetting && $userSetting->getOauth2AuthResult() !== null) {
            $oauth2Result = $userSetting->getOauth2AuthResult();
            $result['is_authenticated'] = ! $oauth2Result->isExpired();
        }
        if ($result['is_authenticated']) {
            // User is authenticated, no need for OAuth URL
            return $result;
        }

        $result['oauth_url'] = $serviceConfig->getOauth2Config()?->getAuthorizationUrl();

        // Return OAuth2 configuration for unauthenticated users
        return $result;
    }
}

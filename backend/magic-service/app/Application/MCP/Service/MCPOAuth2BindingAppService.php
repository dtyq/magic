<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\MCP\Service\Oauth2\MCPOAuth2Client;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

class MCPOAuth2BindingAppService extends AbstractMCPAppService
{
    #[Inject]
    protected MCPOAuth2Client $oauth2Client;

    /**
     * Bind OAuth2 service using authorization code.
     *
     * @param string $code OAuth2 authorization code
     * @param string $state OAuth2 state parameter
     * @return array{success: bool, data?: array, error?: string, errorMessage?: string}
     */
    public function bindOAuth2Service(Authenticatable $authorization, string $code, string $state): array
    {
        // Validate required parameters
        if (empty($code)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingCodeEmpty);
        }

        if (empty($state)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingStateEmpty);
        }

        // Get and validate state data
        $stateData = $this->oauth2Client->getStateData($state);
        if (! $stateData) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }

        // Extract data from state
        $userId = $stateData['user_id'] ?? null;
        $mcpServerCode = $stateData['mcp_server_code'] ?? null;
        $codeVerifier = $stateData['code_verifier'] ?? null;
        $redirectUrl = $stateData['redirect_url'] ?? null;

        if (! $userId || ! $mcpServerCode) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }

        // Verify that the requesting user matches the user in state
        if ($authorization->getId() !== $userId) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }

        $mcpDataIsolation = $this->createMCPDataIsolation($authorization);
        $mcpDataIsolation->disabled();

        // Get MCP server configuration
        $mcpServer = $this->mcpServerDomainService->getByCode($mcpDataIsolation, $mcpServerCode);

        // Get OAuth2 configuration
        $serviceConfig = $mcpServer->getServiceConfig();
        if (! $serviceConfig instanceof ExternalSSEServiceConfig || $serviceConfig->getAuthType() !== ServiceConfigAuthType::OAUTH2) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }

        $oauth2Config = $serviceConfig->getOauth2Config();
        if (! $oauth2Config) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2CallbackHandlingFailed);
        }

        // Prepare callback parameters
        $callbackParams = ['code' => $code];
        if ($codeVerifier) {
            $callbackParams['code_verifier'] = $codeVerifier;
        }

        // Handle the OAuth2 code verification
        $authResult = $this->oauth2Client->handleCallback($oauth2Config, $callbackParams, $redirectUrl);

        // Save the authentication result
        $userSetting = $this->mcpUserSettingDomainService->getByUserAndMcpServer($mcpDataIsolation, $userId, $mcpServerCode);
        if (! $userSetting) {
            $userSetting = new MCPUserSettingEntity();
            $userSetting->setOrganizationCode($mcpServer->getOrganizationCode());
            $userSetting->setUserId($userId);
            $userSetting->setMcpServerId($mcpServerCode);
        }
        $userSetting->setOauth2AuthResult($authResult);

        // Save updated user setting with OAuth2 result
        $this->mcpUserSettingDomainService->save($mcpDataIsolation, $userSetting);

        // Clear state data
        $this->oauth2Client->clearStateData($state);

        // Prepare authentication info for response
        $authInfo = [
            'access_token_expires_at' => $authResult->getExpiresAt()
                ? $authResult->getExpiresAt()->format('Y-m-d H:i:s') : 'never',
            'refresh_token_expires_at' => 'never', // OAuth2AuthResult doesn't have separate refresh token expiry
            'scope' => $authResult->getScope() ?: 'default',
            'token_type' => $authResult->getTokenType() ?: 'Bearer',
            'is_authenticated' => true,
        ];

        return [
            'success' => true,
            'data' => [
                'auth_info' => $authInfo,
                'message' => 'OAuth2 service bound successfully',
            ],
        ];
    }

    /**
     * Unbind OAuth2 service for the user.
     *
     * @param string $mcpServerCode MCP server code
     */
    public function unbindOAuth2Service(Authenticatable $authorization, string $mcpServerCode): array
    {
        // Validate required parameters
        if (empty($mcpServerCode)) {
            ExceptionBuilder::throw(MCPErrorCode::OAuth2BindingMcpServerCodeEmpty);
        }

        $dataIsolation = $this->createMCPDataIsolation($authorization);
        $dataIsolation->disabled();
        $userId = $authorization->getId();

        // Get user setting
        $userSetting = $this->mcpUserSettingDomainService->getByUserAndMcpServer($dataIsolation, $userId, $mcpServerCode);
        if (! $userSetting || ! $userSetting->getOauth2AuthResult()) {
            return [
                'success' => true,
                'data' => [
                    'message' => 'OAuth2 service unbind completed (no existing binding)',
                ],
            ];
        }

        // Clear OAuth2 authentication result
        $userSetting->setOauth2AuthResult(null);

        // Save updated user setting
        $this->mcpUserSettingDomainService->save($dataIsolation, $userSetting);

        return [
            'success' => true,
            'data' => [
                'message' => 'OAuth2 service unbound successfully',
            ],
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Application\MCP\Service\Oauth2\MCPOAuth2Client;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MCPUserSettingAppService extends AbstractMCPAppService
{
    #[Inject]
    protected MCPOAuth2Client $oauth2Client;

    /**
     * Save user MCP service required fields.
     */
    public function saveUserRequiredFields(Authenticatable $authorization, string $mcpServerCode, array $requireFields): MCPUserSettingEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        // Validate MCP server exists and user has access
        $allDataIsolation = clone $dataIsolation;
        $allDataIsolation->disabled();
        $mcpServer = $this->mcpServerDomainService->getByCode($allDataIsolation, $mcpServerCode);
        if (! $mcpServer) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $mcpServerCode]);
        }

        if (! in_array($mcpServer->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes())) {
            // Check user permission for this MCP server
            $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
            $operation->validate('r', $mcpServerCode);
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
    public function getUserSettings(Authenticatable $authorization, string $mcpServerCode, string $redirectUrl): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        // Validate redirect URL is provided
        if (empty($redirectUrl)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'redirect_url']);
        }

        // Validate MCP server exists and user has access
        $allDataIsolation = clone $dataIsolation;
        $allDataIsolation->disabled();
        $mcpServer = $this->mcpServerDomainService->getByCode($allDataIsolation, $mcpServerCode);
        if (! $mcpServer) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $mcpServerCode]);
        }

        if (! in_array($mcpServer->getOrganizationCode(), $dataIsolation->getOfficialOrganizationCodes())) {
            // Check user permission for this MCP server
            $operation = $this->getMCPServerOperation($dataIsolation, $mcpServerCode);
            $operation->validate('r', $mcpServerCode);
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
            'auth_config' => $this->generateAuthConfig($dataIsolation, $mcpServer, $userSetting, $redirectUrl),
        ];
    }

    private function generateAuthConfig(MCPDataIsolation $dataIsolation, MCPServerEntity $mcpServer, ?MCPUserSettingEntity $userSetting, string $redirectUrl): array
    {
        $result = [
            'is_authenticated' => false,
            'oauth_url' => '',
        ];

        // Check service configuration and authentication status
        $serviceConfig = $mcpServer->getServiceConfig();

        // Only handle ExternalSSEServiceConfig with OAuth2
        if (! $serviceConfig instanceof ExternalSSEServiceConfig) {
            return $result;
        }

        $authType = $serviceConfig->getAuthType();
        if ($authType !== ServiceConfigAuthType::OAUTH2) {
            return $result;
        }

        $oauth2Config = $serviceConfig->getOauth2Config();
        if (! $oauth2Config) {
            return $result;
        }

        // Check if user is already authenticated
        if ($userSetting && $userSetting->getOauth2AuthResult() !== null) {
            $oauth2Result = $userSetting->getOauth2AuthResult();

            // Check if current token is still valid
            if (! $oauth2Result->isExpired()) {
                $result['is_authenticated'] = true;
                return $result;
            }

            // Try to refresh token if possible
            if ($oauth2Result->hasRefreshToken()) {
                try {
                    $newTokens = $this->oauth2Client->refreshToken(
                        $oauth2Config,
                        $oauth2Result->getRefreshToken()
                    );

                    // Update user setting with new tokens
                    $userSetting->setOauth2AuthResult($newTokens);
                    $this->mcpUserSettingDomainService->save($dataIsolation, $userSetting);

                    $result['is_authenticated'] = true;
                    return $result;
                } catch (Throwable $e) {
                    // Token refresh failed, continue to generate new OAuth URL
                    $this->logger->warning('OAuth2TokenRefreshFailed', [
                        'error' => $e->getMessage(),
                        'client_id' => $oauth2Config->getClientId(),
                    ]);
                }
            }
        }

        // Generate new OAuth2 authorization URL
        try {
            $state = $this->oauth2Client->generateState();
            $codeVerifier = null;
            $codeChallenge = null;

            if ($oauth2Config->shouldUsePKCE()) {
                $codeVerifier = $this->oauth2Client->generateCodeVerifier();
                $codeChallenge = $this->oauth2Client->generateCodeChallenge($codeVerifier);
            }

            // Store state data for later validation
            $this->oauth2Client->storeStateData($state, [
                'user_id' => $dataIsolation->getCurrentUserId(),
                'mcp_server_code' => $mcpServer->getCode(),
                'code_verifier' => $codeVerifier,
                'created_at' => time(),
                'language' => CoContext::getLanguage(),
                'redirect_url' => $redirectUrl,
            ]);

            $result['oauth_url'] = $this->oauth2Client->createOauthUrl(
                $oauth2Config,
                $state,
                $codeChallenge,
                $redirectUrl
            );
            $result['state'] = $state;
            $result['expires_in'] = 600; // State expires in 10 minutes
        } catch (Throwable $e) {
            $this->logger->error('OAuth2AuthorizationUrlGenerationFailed', [
                'error' => $e->getMessage(),
                'client_id' => $oauth2Config->getClientId(),
            ]);
        }

        return $result;
    }
}

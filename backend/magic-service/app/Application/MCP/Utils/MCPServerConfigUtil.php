<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStreamableHttpServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\HeaderConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ServiceConfigInterface;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\MCP\Service\MCPUserSettingDomainService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;
use Throwable;

class MCPServerConfigUtil
{
    public static function create(
        MCPDataIsolation $dataIsolation,
        MCPServerEntity $MCPServerEntity,
        string $localHttpUrl = '',
        bool $supportStdio = true
    ): ?McpServerConfig {
        if (! $MCPServerEntity->isEnabled()) {
            return null;
        }

        self::validateAndApplyUserConfiguration($dataIsolation, $MCPServerEntity);

        $localHttpUrl = $localHttpUrl ?: LOCAL_HTTP_URL;
        switch ($MCPServerEntity->getType()) {
            case ServiceType::SSE:
                return new McpServerConfig(
                    type: McpType::Http,
                    name: $MCPServerEntity->getName(),
                    url: $localHttpUrl . '/api/v1/mcp/sse/' . $MCPServerEntity->getCode(),
                );
            case ServiceType::ExternalSSE:
            case ServiceType::ExternalStreamableHttp:
                /** @var ExternalStreamableHttpServiceConfig $serviceConfig */
                $serviceConfig = $MCPServerEntity->getServiceConfig();

                $url = $serviceConfig->getUrl();
                if (empty($url)) {
                    return null;
                }

                return new McpServerConfig(
                    type: McpType::Http,
                    name: $MCPServerEntity->getName(),
                    url: $url,
                    headers: $serviceConfig->getHeadersArray(),
                );
            case ServiceType::ExternalStdio:
                if (! $supportStdio) {
                    return null;
                }
                /** @var ExternalStdioServiceConfig $serviceConfig */
                $serviceConfig = $MCPServerEntity->getServiceConfig();

                return new McpServerConfig(
                    type: McpType::Stdio,
                    name: $MCPServerEntity->getName(),
                    command: $serviceConfig->getCommand(),
                    args: $serviceConfig->getArguments(),
                    env: $serviceConfig->getEnvArray(),
                );
            default:
                return null;
        }
    }

    /**
     * Batch validate user configurations for multiple MCP servers.
     * Returns validation status for each server.
     *
     * @param array<MCPServerEntity> $entities
     * @return array<string, array{check_require_fields: bool, check_auth: bool}>
     */
    public static function batchValidateUserConfigurations(
        BaseDataIsolation $dataIsolation,
        array $entities
    ): array {
        if (empty($entities)) {
            return [];
        }

        $mcpDataIsolation = MCPDataIsolation::createByBaseDataIsolation($dataIsolation);
        $userSettingService = di(MCPUserSettingDomainService::class);

        // Get all user settings for this user
        $allUserSettings = $userSettingService->getByUserId($mcpDataIsolation, $dataIsolation->getCurrentUserId());

        // Create a map of mcp_server_code => user setting
        $userSettingsMap = [];
        foreach ($allUserSettings as $setting) {
            $userSettingsMap[$setting->getMcpServerId()] = $setting;
        }

        $results = [];

        foreach ($entities as $entity) {
            $code = $entity->getCode();
            $serviceConfig = $entity->getServiceConfig();
            $userSetting = $userSettingsMap[$code] ?? null;

            $checkRequireFields = self::shouldCheckRequiredFields($serviceConfig, $userSetting);
            $checkAuth = self::shouldCheckAuth($serviceConfig, $userSetting);

            $results[$code] = [
                'check_require_fields' => $checkRequireFields,
                'check_auth' => $checkAuth,
            ];
        }

        return $results;
    }

    public static function validateAndApplyUserConfiguration(
        BaseDataIsolation $dataIsolation,
        MCPServerEntity $entity,
        bool $throwException = true
    ): void {
        try {
            $mcpDataIsolation = MCPDataIsolation::createByBaseDataIsolation($dataIsolation);
            $userSetting = di(MCPUserSettingDomainService::class)->getByUserAndMcpServer(
                $mcpDataIsolation,
                $dataIsolation->getCurrentUserId(),
                $entity->getCode()
            );

            // Get required fields from service configuration
            $serviceConfig = $entity->getServiceConfig();
            $requiredFields = $serviceConfig->getRequireFields();

            // Add OAuth2 authentication if available
            if ($serviceConfig instanceof ExternalSSEServiceConfig && $userSetting?->getOauth2AuthResult()?->isValid()) {
                $serviceConfig->addHeader(HeaderConfig::create('Authorization', 'Bearer ' . $userSetting->getOauth2AuthResult()->getAccessToken()));
            }

            if (empty($requiredFields)) {
                return; // No required fields to validate
            }

            // If no user setting exists, all required fields are missing
            if (! $userSetting) {
                ExceptionBuilder::throw(MCPErrorCode::RequiredFieldsMissing, 'mcp.required_fields.missing', ['fields' => implode(', ', $requiredFields)]);
            }

            // Parse and validate user field values
            $userFieldValues = self::parseUserFieldValues($userSetting);
            self::validateRequiredFieldValues($requiredFields, $userFieldValues);

            // Apply user field values to service configuration
            if (! empty($userFieldValues)) {
                $serviceConfig->replaceRequiredFields($userFieldValues);
            }
        } catch (Throwable $throwable) {
            if ($throwException) {
                throw $throwable;
            }
            simple_logger('MCPServerConfigUtil')->info('ValidateAndApplyUserConfigurationError', [
                'mcp_code' => $entity->getCode(),
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * Parse user field values from user setting.
     *
     * @return array<string, string>
     */
    private static function parseUserFieldValues(?MCPUserSettingEntity $userSetting): array
    {
        if (! $userSetting) {
            return [];
        }

        $userRequiredFields = $userSetting->getRequireFieldsAsArray();
        $userFieldValues = [];

        foreach ($userRequiredFields as $field) {
            $fieldName = $field['field_name'] ?? '';
            $fieldValue = $field['field_value'] ?? '';
            if (! empty($fieldName)) {
                $userFieldValues[$fieldName] = $fieldValue;
            }
        }

        return $userFieldValues;
    }

    /**
     * Check if required fields validation is needed.
     */
    private static function shouldCheckRequiredFields(ServiceConfigInterface $serviceConfig, ?MCPUserSettingEntity $userSetting): bool
    {
        $requiredFields = $serviceConfig->getRequireFields();

        if (empty($requiredFields)) {
            return false;
        }

        if (! $userSetting) {
            return true;
        }

        $userFieldValues = self::parseUserFieldValues($userSetting);

        // Check for missing or empty fields
        foreach ($requiredFields as $requiredField) {
            if (empty($userFieldValues[$requiredField])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if OAuth2 authentication validation is needed.
     */
    private static function shouldCheckAuth(ServiceConfigInterface $serviceConfig, ?MCPUserSettingEntity $userSetting): bool
    {
        if (! $serviceConfig instanceof ExternalSSEServiceConfig) {
            return false;
        }
        if ($serviceConfig->getAuthType() !== ServiceConfigAuthType::OAUTH2) {
            return false;
        }

        return ! $userSetting || ! $userSetting->getOauth2AuthResult()?->isValid();
    }

    /**
     * Validate required field values and throw exceptions if validation fails.
     *
     * @param array<string> $requiredFields
     * @param array<string, string> $userFieldValues
     * @throws Throwable
     */
    private static function validateRequiredFieldValues(array $requiredFields, array $userFieldValues): void
    {
        $missingFields = [];
        $emptyFields = [];

        foreach ($requiredFields as $requiredField) {
            if (! isset($userFieldValues[$requiredField])) {
                $missingFields[] = $requiredField;
            } elseif (empty($userFieldValues[$requiredField])) {
                $emptyFields[] = $requiredField;
            }
        }

        if (! empty($missingFields)) {
            ExceptionBuilder::throw(MCPErrorCode::RequiredFieldsMissing, 'mcp.required_fields.missing', ['fields' => implode(', ', $missingFields)]);
        }

        if (! empty($emptyFields)) {
            ExceptionBuilder::throw(MCPErrorCode::RequiredFieldsEmpty, 'mcp.required_fields.empty', ['fields' => implode(', ', $emptyFields)]);
        }
    }
}

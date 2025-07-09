<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStreamableHttpServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\HeaderConfig;
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

            // Check if all required fields are filled
            $userRequiredFields = $userSetting->getRequireFieldsAsArray();
            $userFieldValues = [];
            foreach ($userRequiredFields as $field) {
                $fieldName = $field['field_name'] ?? '';
                $fieldValue = $field['field_value'] ?? '';
                if (! empty($fieldName)) {
                    $userFieldValues[$fieldName] = $fieldValue;
                }
            }

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
}

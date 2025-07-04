<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\PhpMcp\Client\McpClient;
use Dtyq\PhpMcp\Shared\Kernel\Application;
use Dtyq\PhpMcp\Types\Core\ProtocolConstants;
use Dtyq\PhpMcp\Types\Tools\Tool;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MCPServerAppService extends AbstractMCPAppService
{
    public function show(Authenticatable $authorization, string $code): MCPServerEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('r', $code);

        $entity = $this->mcpServerDomainService->getByCode(
            $this->createMCPDataIsolation($authorization),
            $code
        );
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
        $entity->setUserOperation($operation->value);
        return $entity;
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>, icons: array<string, FileLink>, users: array<string, MagicUserEntity>}
     */
    public function queries(Authenticatable $authorization, MCPServerQuery $query, Page $page, bool $office = false): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);
        if ($office) {
            $dataIsolation->setOnlyOfficialOrganization(true);
        } else {
            $resources = $this->operationPermissionAppService->getResourceOperationByUserIds(
                $dataIsolation,
                ResourceType::MCPServer,
                [$authorization->getId()]
            )[$authorization->getId()] ?? [];
            $resourceIds = array_keys($resources);

            if (! empty($query->getCodes())) {
                $resourceIds = array_intersect($resourceIds, $query->getCodes());
            }

            $query->setCodes($resourceIds);
        }

        $data = $this->mcpServerDomainService->queries(
            $dataIsolation,
            $query,
            $page
        );
        $filePaths = [];
        $userIds = [];
        foreach ($data['list'] ?? [] as $item) {
            $filePaths[] = $item->getIcon();
            $operation = $resources[$item->getCode()] ?? Operation::None;
            $item->setUserOperation($operation->value);
            $userIds[] = $item->getCreator();
            $userIds[] = $item->getModifier();
        }
        $data['icons'] = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $filePaths);
        $data['users'] = $this->getUsers($dataIsolation->getCurrentOrganizationCode(), $userIds);
        return $data;
    }

    public function save(Authenticatable $authorization, MCPServerEntity $entity): MCPServerEntity
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        if (! $entity->shouldCreate()) {
            $operation = $this->getMCPServerOperation($dataIsolation, $entity->getCode());
            $operation->validate('w', $entity->getCode());
        } else {
            $operation = Operation::Owner;
        }

        $entity = $this->mcpServerDomainService->save(
            $this->createMCPDataIsolation($authorization),
            $entity
        );
        $entity->setUserOperation($operation->value);
        return $entity;
    }

    public function destroy(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('d', $code);

        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        return $this->mcpServerDomainService->delete($dataIsolation, $code);
    }

    public function checkStatus(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createMCPDataIsolation($authorization);

        $operation = $this->getMCPServerOperation($dataIsolation, $code);
        $operation->validate('r', $code);

        $entity = $this->mcpServerDomainService->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
        if (! $entity->getType()->canCheckStatus()) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status', ['label' => $code]);
        }

        /** @var ExternalSSEServiceConfig $serviceConfig */
        $serviceConfig = $entity->getServiceConfig();

        $userSetting = $this->mcpUserSettingDomainService->getByUserAndMcpServer(
            $dataIsolation,
            $dataIsolation->getCurrentUserId(),
            $entity->getCode()
        );

        // Validate and apply user configuration
        $this->validateAndApplyUserConfiguration($entity, $userSetting);

        // Prepare base connection options
        $connectionOptions = [
            'base_url' => $serviceConfig->getUrl(),
            'timeout' => 15.0,
            'sse_timeout' => 300.0,
            'max_retries' => 1,
        ];

        // Add headers from service configuration
        $headers = [];
        foreach ($serviceConfig->getHeaders() as $header) {
            if (! empty($header->getKey()) && ! empty($header->getValue())) {
                $headers[$header->getKey()] = $header->getValue();
            }
        }

        if (! empty($headers)) {
            $connectionOptions['headers'] = $headers;
        }

        // Generate authentication configuration
        $auth = $this->generateAuth($userSetting);
        if ($auth) {
            $connectionOptions['auth'] = $auth;
        }

        $tools = [];
        $error = '';
        try {
            $app = new Application(di());
            $client = new McpClient('magic-client', '1.0.0', $app);
            $session = $client->connect(ProtocolConstants::TRANSPORT_TYPE_HTTP, $connectionOptions);
            $session->initialize();
            $toolsResult = $session->listTools();
            $status = 'success';
            $tools = array_map(function (Tool $tool) use ($code) {
                return [
                    'mcp_server_code' => $code,
                    'name' => $tool->getName(),
                    'description' => $tool->getDescription(),
                    'input_schema' => $tool->getInputSchema(),
                    'version' => '',
                    'enabled' => true,
                    'source_version' => [
                        'latest_version_code' => '',
                        'latest_version_name' => '',
                    ],
                ];
            }, $toolsResult->getTools());
        } catch (Throwable $throwable) {
            $status = 'error';
            $error = $throwable->getMessage();
        }

        return [
            'success' => $status,
            'tools' => $tools,
            'error' => $error,
        ];
    }

    /**
     * Validate required fields and apply user configuration.
     */
    private function validateAndApplyUserConfiguration(
        MCPServerEntity $entity,
        ?MCPUserSettingEntity $userSetting
    ): void {
        // Get required fields from service configuration
        $serviceConfig = $entity->getServiceConfig();
        $requiredFields = $serviceConfig->getRequireFields();

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
    }

    /**
     * Generate authentication configuration for MCP connection.
     */
    private function generateAuth(?MCPUserSettingEntity $userSetting): ?array
    {
        // Add OAuth2 authentication if available
        if ($userSetting && $userSetting->getOauth2AuthResult()) {
            $oauth2Result = $userSetting->getOauth2AuthResult();

            // Check if token is valid
            if ($oauth2Result->isValid()) {
                return [
                    'type' => 'bearer',
                    'token' => $oauth2Result->getAccessToken(),
                ];
            }
        }

        return null;
    }
}

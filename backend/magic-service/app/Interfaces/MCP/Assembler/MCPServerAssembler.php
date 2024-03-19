<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Assembler;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalStdioServiceConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\MCP\DTO\MCPServerDTO;
use App\Interfaces\MCP\DTO\MCPServerSelectListDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class MCPServerAssembler
{
    public static function createDTO(MCPServerEntity $mcpServerEntity, array $icons = [], array $users = []): MCPServerDTO
    {
        $DTO = new MCPServerDTO();
        $DTO->setId($mcpServerEntity->getCode());
        $DTO->setName($mcpServerEntity->getName());
        $DTO->setDescription($mcpServerEntity->getDescription());
        $DTO->setIcon(FileAssembler::getUrl($icons[$mcpServerEntity->getIcon()] ?? null));
        $DTO->setType($mcpServerEntity->getType()->value);
        $DTO->setEnabled($mcpServerEntity->isEnabled());

        $serviceConfig = $mcpServerEntity->getServiceConfig();

        if ($serviceConfig instanceof ExternalSSEServiceConfig) {
            // For backward compatibility, extract externalSseUrl from service_config
            $DTO->setExternalSseUrl($serviceConfig->getUrl());
        }

        // Handle service_config - convert from ServiceConfigInterface to array
        $DTO->setServiceConfig($serviceConfig->toArray());
        if ($serviceConfig instanceof ExternalStdioServiceConfig) {
            $DTO->setServiceConfig($serviceConfig->toWebArray());
        }

        $DTO->setCreator($mcpServerEntity->getCreator());
        $DTO->setCreatedAt($mcpServerEntity->getCreatedAt());
        $DTO->setModifier($mcpServerEntity->getModifier());
        $DTO->setUpdatedAt($mcpServerEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$mcpServerEntity->getCreator()] ?? null, $mcpServerEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$mcpServerEntity->getModifier()] ?? null, $mcpServerEntity->getUpdatedAt()));
        $DTO->setUserOperation($mcpServerEntity->getUserOperation());
        $DTO->setToolsCount($mcpServerEntity->getToolsCount());
        return $DTO;
    }

    public static function createDO(MCPServerDTO $mcpServerDTO): MCPServerEntity
    {
        $mcpServerEntity = new MCPServerEntity();
        $mcpServerEntity->setCode((string) $mcpServerDTO->getId());
        $mcpServerEntity->setName($mcpServerDTO->getName());
        $mcpServerEntity->setDescription($mcpServerDTO->getDescription());
        $mcpServerEntity->setIcon(FileAssembler::formatPath($mcpServerDTO->getIcon()));

        if ($mcpServerDTO->getType()) {
            $mcpServerEntity->setType(ServiceType::from($mcpServerDTO->getType()));
        }

        if ($mcpServerDTO->getEnabled() !== null) {
            $mcpServerEntity->setEnabled($mcpServerDTO->getEnabled());
        }

        // Handle service_config with backward compatibility for externalSseUrl
        if ($mcpServerDTO->getServiceConfig() !== null && $mcpServerDTO->getType()) {
            // Use service_config from DTO
            $mcpServerEntity->setServiceConfig($mcpServerDTO->getServiceConfig());
        } elseif (! empty($mcpServerDTO->getExternalSseUrl()) && $mcpServerDTO->getType()) {
            // For backward compatibility, create service_config from externalSseUrl
            $serviceType = ServiceType::from($mcpServerDTO->getType());
            if ($serviceType === ServiceType::ExternalSSE || $serviceType === ServiceType::ExternalStreamableHttp) {
                $serviceConfigData = ['url' => $mcpServerDTO->getExternalSseUrl()];
                $mcpServerEntity->setServiceConfig($serviceConfigData);
            }
        } else {
            // Ensure we always have a serviceConfig
            if ($mcpServerDTO->getType()) {
                $serviceType = ServiceType::from($mcpServerDTO->getType());
                $mcpServerEntity->setServiceConfig($serviceType->createServiceConfig([]));
            }
        }

        return $mcpServerEntity;
    }

    /**
     * Create tool entities from raw tools data.
     *
     * @param null|array $toolsData Raw tools data from request
     * @param string $mcpServerCode MCP server code to associate with tools
     * @return array<MCPServerToolEntity> Array of tool entities
     */
    public static function createToolEntities(?array $toolsData, string $mcpServerCode): array
    {
        if ($toolsData === null) {
            return [];
        }

        $toolEntities = [];
        foreach ($toolsData as $toolData) {
            $toolEntity = new MCPServerToolEntity();
            $toolEntity->setMcpServerCode($mcpServerCode);
            $toolEntity->setName($toolData['name'] ?? '');
            $toolEntity->setDescription($toolData['description'] ?? '');
            $toolEntity->setSource(ToolSource::fromValue($toolData['source'] ?? 0) ?? ToolSource::Unknown);
            $toolEntity->setRelCode($toolData['rel_code'] ?? '');
            $toolEntity->setRelVersionCode($toolData['rel_version_code'] ?? '');
            $toolEntity->setVersion($toolData['version'] ?? '');

            if (isset($toolData['enabled'])) {
                $toolEntity->setEnabled($toolData['enabled']);
            }

            $toolEntities[] = $toolEntity;
        }

        return $toolEntities;
    }

    /**
     * @param array<string, FileLink> $icons
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = [], array $icons = []): PageDTO
    {
        $list = array_map(fn (MCPServerEntity $mcpServerEntity) => self::createDTO($mcpServerEntity, $icons, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createSelectListDTO(MCPServerEntity $mcpServerEntity, array $icons = [], array $validationResult = []): MCPServerSelectListDTO
    {
        $DTO = new MCPServerSelectListDTO();
        $DTO->setId($mcpServerEntity->getCode());
        $DTO->setName($mcpServerEntity->getName());
        $DTO->setDescription($mcpServerEntity->getDescription());
        $DTO->setIcon(FileAssembler::getUrl($icons[$mcpServerEntity->getIcon()] ?? null));
        $DTO->setType($mcpServerEntity->getType()->value);
        $DTO->setRequireFields($mcpServerEntity->getServiceConfig()->getRequireFields());
        $DTO->setOffice($mcpServerEntity->isOffice());
        $DTO->setUserOperation($mcpServerEntity->getUserOperation());

        // Set validation results
        $DTO->setCheckRequireFields($validationResult['check_require_fields'] ?? false);
        $DTO->setCheckAuth($validationResult['check_auth'] ?? false);

        return $DTO;
    }

    /**
     * @param array<string, FileLink> $icons
     * @param array<string, array{check_require_fields: bool, check_auth: bool}> $validationResults
     */
    public static function createSelectPageListDTO(int $total, array $list, Page $page, array $icons = [], array $validationResults = []): PageDTO
    {
        $list = array_map(fn (MCPServerEntity $mcpServerEntity) => self::createSelectListDTO($mcpServerEntity, $icons, $validationResults[$mcpServerEntity->getCode()] ?? []), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\MCP\Service\MCPServerAppService;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\Provider\Entity\ValueObject\Query\Page;
use App\Interfaces\MCP\Assembler\MCPServerAssembler;
use App\Interfaces\MCP\DTO\MCPServerDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MCPServerAdminApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MCPServerAppService $mcpServerAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();

        $requestData = $this->request->all();
        $DTO = new MCPServerDTO($requestData);

        $DO = MCPServerAssembler::createDO($DTO);

        // Prepare tool entities at API layer only if tools parameter exists
        $toolEntities = null;
        if (array_key_exists('tools', $requestData)) {
            $toolEntities = MCPServerAssembler::createToolEntities($requestData['tools'], $DO->getCode());
        }

        $entity = $this->mcpServerAppService->save($authorization, $DO, $toolEntities);
        $icons = $this->mcpServerAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        $users = $this->mcpServerAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        $mcpServerDTO = MCPServerAssembler::createDTO($entity, $icons, $users);

        // For SSE type servers, include tools in response
        if ($entity->getType()->value === 'sse') {
            $result = $mcpServerDTO->toArray();
            $tools = $this->mcpServerAppService->getToolsForServer($authorization, $entity->getCode());
            $result['tools'] = $tools;
            if ($result['tools']) {
                $result['tools'] = array_map(function ($tool) {
                    return [
                        'id' => (string) $tool->getId(),
                        'name' => $tool->getName(),
                        'description' => $tool->getDescription(),
                        'source' => $tool->getSource()->value,
                        'rel_code' => $tool->getRelCode(),
                        'rel_info' => $tool->getRelInfo(),
                        'rel_version_code' => $tool->getRelVersionCode(),
                        'version' => $tool->getVersion(),
                        'enabled' => $tool->isEnabled(),
                    ];
                }, $result['tools']);
            }
            return $result;
        }

        return $mcpServerDTO;
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();

        $query = new MCPServerQuery($this->request->all());
        $query->setOrder(['id' => 'desc']);
        $query->setWithToolCount(true);
        $result = $this->mcpServerAppService->queries($authorization, $query, $page);

        return MCPServerAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $page,
            users: $result['users'],
            icons: $result['icons'],
        );
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $data = $this->mcpServerAppService->show($authorization, $code);
        $entity = $data['mcp_server'];
        $icons = $this->mcpServerAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        $users = $this->mcpServerAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        $mcpServerDTO = MCPServerAssembler::createDTO($entity, $icons, $users);
        $result = $mcpServerDTO->toArray();
        $result['tools'] = $data['tools'] ?? null;
        if ($result['tools']) {
            $result['tools'] = array_map(function ($tool) {
                return [
                    'id' => (string) $tool->getId(),
                    'name' => $tool->getName(),
                    'description' => $tool->getDescription(),
                    'source' => $tool->getSource()->value,
                    'rel_code' => $tool->getRelCode(),
                    'rel_info' => $tool->getRelInfo(),
                    'rel_version_code' => $tool->getRelVersionCode(),
                    'version' => $tool->getVersion(),
                    'enabled' => $tool->isEnabled(),
                ];
            }, $result['tools']);
        }
        return $result;
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        return $this->mcpServerAppService->destroy($authorization, $code);
    }

    public function updateStatus(string $code)
    {
        $authorization = $this->getAuthorization();
        $requestData = $this->request->all();

        // enabled 参数默认为 false
        $enabled = (bool) ($requestData['enabled'] ?? false);
        $entity = $this->mcpServerAppService->updateStatus($authorization, $code, $enabled);

        $icons = $this->mcpServerAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        $users = $this->mcpServerAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return MCPServerAssembler::createDTO($entity, $icons, $users);
    }

    public function checkStatus(string $code)
    {
        $authorization = $this->getAuthorization();

        return $this->mcpServerAppService->checkStatus($authorization, $code);
    }

    public function availableQueries()
    {
        $authorization = $this->getAuthorization();
        $query = new MCPServerQuery($this->request->all());
        $query->setEnabled(true);
        $query->setOrder(['id' => 'desc']);
        $page = Page::createNoPage();
        $result = $this->mcpServerAppService->availableQueries($authorization, $query, $page);

        return MCPServerAssembler::createSelectPageListDTO(
            $result['total'],
            $result['list'],
            $page,
            $result['icons'],
            $result['validation_results'] ?? []
        );
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\Admin;

use App\Application\MCP\Service\MCPServerToolAppService;
use App\Interfaces\MCP\Assembler\MCPServerToolAssembler;
use App\Interfaces\MCP\DTO\MCPServerToolDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MCPServerToolAdminApi extends AbstractMCPAdminApi
{
    #[Inject]
    protected MCPServerToolAppService $mcpServerToolAppService;

    /**
     * 获取MCP服务下的工具列表.
     */
    public function queries(string $code)
    {
        $authorization = $this->getAuthorization();
        $result = $this->mcpServerToolAppService->queries($authorization, $code);

        return MCPServerToolAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $this->createPage(),
            users: $result['users'],
            sourcesInfo: $result['sources_info'],
        );
    }

    /**
     * 保存MCP服务工具.
     */
    public function save(string $code)
    {
        $authorization = $this->getAuthorization();

        $dto = new MCPServerToolDTO($this->request->all());
        $entity = MCPServerToolAssembler::createDO($dto);
        $entity = $this->mcpServerToolAppService->save($authorization, $code, $entity);

        $users = $this->mcpServerToolAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return MCPServerToolAssembler::createDTO($entity, $users);
    }

    /**
     * 获取MCP服务工具详情.
     */
    public function show(string $code, int $id)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->mcpServerToolAppService->show($authorization, $code, $id);

        $users = $this->mcpServerToolAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return MCPServerToolAssembler::createDTO($entity, $users);
    }

    /**
     * 删除MCP服务工具.
     */
    public function destroy(string $code, int $id)
    {
        $authorization = $this->getAuthorization();
        return $this->mcpServerToolAppService->destroy($authorization, $code, $id);
    }
}

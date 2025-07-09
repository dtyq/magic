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

        $DTO = new MCPServerDTO($this->request->all());

        $DO = MCPServerAssembler::createDO($DTO);
        $entity = $this->mcpServerAppService->save($authorization, $DO);
        $icons = $this->mcpServerAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        $users = $this->mcpServerAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return MCPServerAssembler::createDTO($entity, $icons, $users);
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
        $entity = $this->mcpServerAppService->show($authorization, $code);
        $icons = $this->mcpServerAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        $users = $this->mcpServerAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return MCPServerAssembler::createDTO($entity, $icons, $users);
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        return $this->mcpServerAppService->destroy($authorization, $code);
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

        return MCPServerAssembler::createSelectPageListDTO($result['total'], $result['list'], $page, $result['icons']);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin;

use Dtyq\SuperMagic\Application\Agent\Service\SuperMagicAgentAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\SuperMagicAgentAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class SuperMagicAgentAdminApi extends AbstractSuperMagicAdminApi
{
    #[Inject]
    protected SuperMagicAgentAppService $superMagicAgentAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();

        $requestData = $this->request->all();
        $DTO = new SuperMagicAgentDTO($requestData);

        $DO = SuperMagicAgentAssembler::createDO($DTO);

        $entity = $this->superMagicAgentAppService->save($authorization, $DO);
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        
        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();

        $query = new SuperMagicAgentQuery($this->request->all());
        $query->setSelect(['id', 'code', 'name', 'description']); // Only select necessary fields for list
        $page = $this->createPage();

        $result = $this->superMagicAgentAppService->queries($authorization, $query, $page);

        return SuperMagicAgentAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: ['page' => $page->getPage(), 'page_size' => $page->getPageNum()],
        );
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->superMagicAgentAppService->show($authorization, $code);
        
        $withPromptString = (bool) $this->request->input('with_prompt_string', false);
        
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        
        return SuperMagicAgentAssembler::createDTO($entity, $users, $withPromptString);
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        $result = $this->superMagicAgentAppService->delete($authorization, $code);
        
        return ['success' => $result];
    }

    public function enable(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->superMagicAgentAppService->enable($authorization, $code);
        
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        
        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }

    public function disable(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->superMagicAgentAppService->disable($authorization, $code);
        
        $users = $this->superMagicAgentAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        
        return SuperMagicAgentAssembler::createDTO($entity, $users);
    }
}

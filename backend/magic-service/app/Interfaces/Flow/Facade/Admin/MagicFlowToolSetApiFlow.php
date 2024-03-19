<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowToolSetAppService;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Interfaces\Flow\Assembler\ToolSet\MagicFlowToolSetAssembler;
use App\Interfaces\Flow\DTO\ToolSet\MagicFlowToolSetDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowToolSetApiFlow extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowToolSetAppService $magicFlowToolSetAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();

        $DTO = new MagicFlowToolSetDTO($this->request->all());

        $DO = MagicFlowToolSetAssembler::createDO($DTO);
        $entity = $this->magicFlowToolSetAppService->save($authorization, $DO);
        $icons = $this->magicFlowToolSetAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        return MagicFlowToolSetAssembler::createDTO($entity, $icons);
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();

        $query = new MagicFlowToolSetQuery($this->request->all());
        $query->withToolsSimpleInfo = true;
        $result = $this->magicFlowToolSetAppService->queries($authorization, $query, $page);
        return MagicFlowToolSetAssembler::createPageListDTO(
            total: $result['total'],
            list: $result['list'],
            page: $page,
            users: [],
            icons: $result['icons'] ?? []
        );
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->magicFlowToolSetAppService->getByCode($authorization, $code);
        $icons = $this->magicFlowToolSetAppService->getIcons($entity->getOrganizationCode(), [$entity->getIcon()]);
        return MagicFlowToolSetAssembler::createDTO($entity, $icons);
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        $this->magicFlowToolSetAppService->destroy($authorization, $code);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowTriggerTestcaseAppService;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowTriggerTestcaseQuery;
use App\Interfaces\Flow\Assembler\TriggerTestcase\MagicFlowTriggerTestcaseAssembler;
use App\Interfaces\Flow\DTO\TriggerTestcase\MagicFlowTriggerTestcaseDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowTriggerTestcaseFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowTriggerTestcaseAppService $magicFlowTriggerTestcaseAppService;

    public function save(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $magicFlowTriggerTestcaseDTO = new MagicFlowTriggerTestcaseDTO($this->request->all());
        $magicFlowTriggerTestcaseDTO->setFlowCode($flowId);

        $magicFlowTriggerTestcaseEntity = MagicFlowTriggerTestcaseAssembler::createMagicFlowTriggerTestcaseDO($magicFlowTriggerTestcaseDTO);

        $magicFlowTriggerTestcaseEntity = $this->magicFlowTriggerTestcaseAppService->save($authorization, $magicFlowTriggerTestcaseEntity);

        return MagicFlowTriggerTestcaseAssembler::createMagicFlowTriggerTestcaseDTO($magicFlowTriggerTestcaseEntity);
    }

    public function show(string $flowId, string $testcaseId)
    {
        $magicFlowTriggerTestcaseEntity = $this->magicFlowTriggerTestcaseAppService->show($this->getAuthorization(), $flowId, $testcaseId);

        return MagicFlowTriggerTestcaseAssembler::createMagicFlowTriggerTestcaseDTO($magicFlowTriggerTestcaseEntity);
    }

    public function remove(string $flowId, string $testcaseId)
    {
        $this->magicFlowTriggerTestcaseAppService->remove($this->getAuthorization(), $flowId, $testcaseId);
    }

    public function queries(string $flowId)
    {
        $authorization = $this->getAuthorization();
        $magicFlowTriggerTestcaseQuery = new MagicFLowTriggerTestcaseQuery($this->request->all());
        $magicFlowTriggerTestcaseQuery->flowCode = $flowId;
        $magicFlowTriggerTestcaseQuery->setOrder(['id' => 'desc']);

        $page = $this->createPage();

        $result = $this->magicFlowTriggerTestcaseAppService->queries($authorization, $magicFlowTriggerTestcaseQuery, $page);

        return MagicFlowTriggerTestcaseAssembler::createPageListDTO($result['total'], $result['list'], $page, $result['users']);
    }
}

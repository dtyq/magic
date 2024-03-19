<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Admin;

use App\Application\ModelGateway\Service\ApplicationAppService;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ApplicationQuery;
use App\Interfaces\ModelGateway\Assembler\ApplicationAssembler;
use App\Interfaces\ModelGateway\DTO\ApplicationDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class ApplicationModelGatewayAdminApi extends AbstractModelGatewayAdminApi
{
    #[Inject]
    protected ApplicationAssembler $LLMApplicationAssembler;

    #[Inject]
    protected ApplicationAppService $LLMApplicationAppService;

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $query = new ApplicationQuery();
        $page = $this->createPage();
        $data = $this->LLMApplicationAppService->queries($authorization, $query, $page);
        return $this->LLMApplicationAssembler->createPageDTO($data, $page);
    }

    public function save()
    {
        $authorization = $this->getAuthorization();

        $DTO = new ApplicationDTO($this->request->all());
        $DO = $this->LLMApplicationAssembler->createDO($DTO);
        $data = $this->LLMApplicationAppService->save($authorization, $DO);
        return $this->LLMApplicationAssembler->createDTO($data['llm_application'], $data['users'], $data['icons']);
    }

    public function show(string $id)
    {
        $data = $this->LLMApplicationAppService->show($this->getAuthorization(), (int) $id);
        return $this->LLMApplicationAssembler->createDTO($data['llm_application'], $data['users'], $data['icons']);
    }

    public function destroy(string $id)
    {
        $this->LLMApplicationAppService->destroy($this->getAuthorization(), (int) $id);
    }
}

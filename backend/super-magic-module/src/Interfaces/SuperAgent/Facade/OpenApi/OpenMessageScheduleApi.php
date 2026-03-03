<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\OpenMessageScheduleAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Assembler\OpenMessageScheduleAssembler;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateOpenMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateOpenMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest\CreateOpenMessageScheduleFormRequest;
use Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest\QueryOpenMessageScheduleFormRequest;
use Dtyq\SuperMagic\Interfaces\SuperAgent\FormRequest\UpdateOpenMessageScheduleFormRequest;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class OpenMessageScheduleApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly OpenMessageScheduleAppService $openMessageScheduleAppService,
    ) {
        parent::__construct($request);
    }

    public function createMessageSchedule(CreateOpenMessageScheduleFormRequest $request): array
    {
        $authorization = $this->getAuthorization();
        $dto = CreateOpenMessageScheduleRequestDTO::fromArray($request->validated());
        $entity = OpenMessageScheduleAssembler::createEntity($dto);

        return $this->openMessageScheduleAppService->create($authorization, $entity);
    }

    public function updateMessageSchedule(string $id, UpdateOpenMessageScheduleFormRequest $request): array
    {
        $authorization = $this->getAuthorization();
        $dto = UpdateOpenMessageScheduleRequestDTO::fromArray($request->validated());
        $entity = OpenMessageScheduleAssembler::updateEntity($dto);

        return $this->openMessageScheduleAppService->update($authorization, (int) $id, $entity);
    }

    public function queryMessageSchedules(QueryOpenMessageScheduleFormRequest $request): array
    {
        $authorization = $this->getAuthorization();
        $query = OpenMessageScheduleAssembler::createQueryFromArray($request->validated());

        return $this->openMessageScheduleAppService->queries($authorization, $query);
    }

    public function getMessageScheduleDetail(string $id): array
    {
        $authorization = $this->getAuthorization();
        return $this->openMessageScheduleAppService->show($authorization, (int) $id);
    }

    public function deleteMessageSchedule(string $id): array
    {
        $authorization = $this->getAuthorization();
        return $this->openMessageScheduleAppService->delete($authorization, (int) $id);
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\PersonaAvatarOpenAppService;
use App\Domain\ModelGateway\Entity\Dto\PersonaAvatarRequestDTO;
use App\Interfaces\Asset\DTO\Request\GetPersonaAvatarRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class PersonaAvatarApi extends AbstractOpenApi
{
    #[Inject]
    protected PersonaAvatarOpenAppService $personaAvatarOpenAppService;

    public function getCatalog(GetPersonaAvatarRequest $request): array
    {
        $request->validated();
        return $this->personaAvatarOpenAppService->getCatalog($this->createRequestDTO($request));
    }

    public function getFileUrl(GetPersonaAvatarRequest $request, string $id): array
    {
        $request->validated();
        return $this->personaAvatarOpenAppService->getFileUrl($this->createRequestDTO($request), $id);
    }

    private function createRequestDTO(GetPersonaAvatarRequest $request): PersonaAvatarRequestDTO
    {
        $requestDTO = new PersonaAvatarRequestDTO();
        $requestDTO->setAccessToken($this->getAccessToken());
        $requestDTO->setIps($this->getClientIps());
        $requestDTO->setBusinessParams($request->getAccessContext());
        $this->enrichRequestDTO($requestDTO, $this->request->getHeaders());
        return $requestDTO;
    }
}

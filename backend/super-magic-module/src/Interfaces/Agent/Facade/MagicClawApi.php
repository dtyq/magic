<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\MagicClawAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\MagicClawAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryMagicClawListRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use RuntimeException;

use function Hyperf\Support\retry;

#[ApiResponse('low_code')]
class MagicClawApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly MagicClawAppService $magicClawAppService,
        private readonly ProjectAppService $projectAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Create a magic claw.
     * Aggregation: insert claw → create project → bind project_id.
     *
     * @return array<string,mixed>
     */
    public function create(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $dto = CreateMagicClawRequestDTO::fromRequest($this->request);

        // 1. Insert claw record
        $clawEntity = $this->magicClawAppService->create($authorization, $dto);

        // 2. Create project (with retry for resilience)
        $projectResult = retry(3, function () use ($requestContext, $clawEntity) {
            $projectRequestDTO = new CreateAgentProjectRequestDTO();
            $projectRequestDTO->setProjectName($clawEntity->getName());
            $projectRequestDTO->setInitTemplateFiles(true);

            $result = $this->projectAppService->createAgentProject(
                $requestContext,
                $projectRequestDTO,
                ProjectMode::MAGICLAW
            );

            $projectId = (int) ($result['project']['id'] ?? 0);
            if ($projectId <= 0) {
                throw new RuntimeException('Failed to create project: project ID is invalid');
            }

            return $result;
        }, 1000);

        // 3. Bind project_id back to claw record
        $projectId = (int) ($projectResult['project']['id'] ?? 0);
        if ($projectId > 0) {
            $this->magicClawAppService->bindProject($authorization, $clawEntity->getCode(), $projectId);
            $clawEntity->setProjectId($projectId);
        }

        return MagicClawAssembler::toItem($clawEntity, [
            'project' => $projectResult['project'] ?? [],
            'topic' => $projectResult['topic'] ?? [],
        ]);
    }

    /**
     * Get magic claw detail.
     *
     * @return array<string,mixed>
     */
    public function show(RequestContext $requestContext, string $code): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $entity = $this->magicClawAppService->show($authorization, $code);

        return MagicClawAssembler::toItem($entity);
    }

    /**
     * Update a magic claw.
     *
     * @return array<string,mixed>
     */
    public function update(RequestContext $requestContext, string $code): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $dto = UpdateMagicClawRequestDTO::fromRequest($this->request);
        $entity = $this->magicClawAppService->update($authorization, $code, $dto);

        return MagicClawAssembler::toItem($entity);
    }

    /**
     * Delete a magic claw.
     *
     * @return array<string,mixed>
     */
    public function destroy(RequestContext $requestContext, string $code): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $this->magicClawAppService->delete($authorization, $code);

        return [];
    }

    /**
     * Query paginated magic claw list.
     *
     * @return array<string,mixed>
     */
    public function queries(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $dto = QueryMagicClawListRequestDTO::fromRequest($this->request);
        $result = $this->magicClawAppService->queries($authorization, $dto->getPage(), $dto->getPageSize());

        $list = [];
        foreach ($result['list'] as $item) {
            $list[] = MagicClawAssembler::toListItem($item['entity'], $item['status']);
        }

        return [
            'total' => $result['total'],
            'page' => $result['page'],
            'page_size' => $result['page_size'],
            'list' => $list,
        ];
    }
}

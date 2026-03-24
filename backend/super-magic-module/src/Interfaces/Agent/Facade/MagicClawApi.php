<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Facade;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\AgentErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Agent\Service\MagicClawAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Interfaces\Agent\Assembler\MagicClawAssembler;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryMagicClawListRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\SandboxStatusResponseDTO;
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
        private readonly TopicAppService $topicAppService,
        private readonly AgentAppService $agentAppService,
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

    /**
     * Stop (delete) the sandbox for a magic-claw topic.
     *
     * @return array<string,mixed>
     */
    public function stopSandbox(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        // 权限校验：确保话题属于当前用户
        $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
        $sandboxId = $topic->getSandboxId();

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $this->agentAppService->stopSandbox($sandboxId);

        return [];
    }

    /**
     * Get sandbox status for a magic-claw topic.
     *
     * @return array<string,mixed>
     */
    public function getSandboxStatus(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        // 权限校验：确保话题属于当前用户
        $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
        $sandboxId = $topic->getSandboxId();

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $result = $this->agentAppService->getSandboxStatus($sandboxId);
        if (! $result->isSuccess()) {
            ExceptionBuilder::throw(AgentErrorCode::SANDBOX_NOT_FOUND, $result->getMessage());
        }

        return SandboxStatusResponseDTO::fromSandboxStatusResult($result)->toArray();
    }

    /**
     * Upgrade sandbox to the latest agent image.
     *
     * @return array<string,mixed>
     */
    public function upgradeSandbox(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        $topic = $this->topicAppService->getTopic($requestContext, (int) $topicId);
        $sandboxId = $topic->getSandboxId();

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id is required');
        }

        $project = $this->projectAppService->getProjectNotUserId((int) $topic->getProjectId());
        $workDir = $project->getWorkDir() ?? '';

        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($authorization->getId());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $result = $this->agentAppService->upgradeSandbox($dataIsolation, $sandboxId, (string) $topic->getProjectId(), $workDir);

        return $result->toArray();
    }

    /**
     * Check sandbox image version (current vs latest).
     *
     * @return array<string,mixed>
     */
    public function checkSandboxVersion(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        // 权限校验：确保话题属于当前用户
        $this->topicAppService->getTopic($requestContext, (int) $topicId);

        return $this->agentAppService->checkSandboxVersion((int) $topicId);
    }
}

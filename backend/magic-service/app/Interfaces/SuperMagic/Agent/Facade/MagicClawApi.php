<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\Facade;

use App\Application\SuperMagic\Agent\Service\MagicClawAppService;
use App\Application\SuperMagic\Project\DTO\Request\CreateAgentProjectRequestDTO;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Topic\Service\TopicAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\ErrorCode\AgentErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Agent\Assembler\MagicClawAssembler;
use App\Interfaces\SuperMagic\Agent\DTO\Request\CreateMagicClawRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryMagicClawListRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\UpdateMagicClawRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\SandboxStatusResponseDTO;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use RuntimeException;
use Throwable;

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
        private readonly LoggerFactory $loggerFactory,
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

        try {
            // 1. Insert claw record (dispatches BeforeCreateClawEvent; listeners may throw EventException)
            $clawEntity = $this->magicClawAppService->create($authorization, $dto);

            // 2. Create project (with retry for resilience)
            $projectResult = retry(3, function () use ($requestContext, $clawEntity) {
                $projectRequestDTO = new CreateAgentProjectRequestDTO();
                $projectRequestDTO->setProjectName($clawEntity->getName());
                $projectRequestDTO->setInitTemplateFiles(false);
                $projectRequestDTO->setAgentCode($clawEntity->getCode());

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
        } catch (EventException $e) {
            $this->loggerFactory->get(self::class)->warning(sprintf(
                '创建 Magic Claw 时事件处理失败: %s, code: %d',
                $e->getMessage(),
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->loggerFactory->get(self::class)->error(sprintf(
                '创建 Magic Claw 失败: %s, User: %s, file: %s, line: %s, trace: %s',
                $e->getMessage(),
                (string) $authorization->getId(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'super_magic.magic_claw.create_system_error');
        }
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
        $result = $this->magicClawAppService->queries($authorization, $dto->getPage(), $dto->getPageSize(), $dto->getKeyword());

        $list = [];
        foreach ($result['list'] as $item) {
            $list[] = MagicClawAssembler::toListItem(
                $item['entity'],
                $item['status'],
                $item['topic_id'] ?? null,
                $item['need_upgrade'] ?? null
            );
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

        // 权限校验：确保话题属于当前用户
        $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $dataIsolation = DataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $sandboxId = $this->agentAppService->upgradeSandbox($dataIsolation, (int) $topicId);

        return ['sandbox_id' => $sandboxId];
    }

    /**
     * Start sandbox without deleting existing one (no image version check).
     *
     * @return array<string,mixed>
     */
    public function startSandbox(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        // 权限校验：确保话题属于当前用户
        $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $dataIsolation = DataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $sandboxId = $this->agentAppService->startSandbox($dataIsolation, (int) $topicId);

        return ['sandbox_id' => $sandboxId];
    }

    /**
     * Restart sandbox unconditionally (no image version check).
     *
     * @return array<string,mixed>
     */
    public function restartSandbox(RequestContext $requestContext): array
    {
        $authorization = $this->getAuthorization();
        $requestContext->setUserAuthorization($authorization);

        $topicId = $this->request->input('topic_id', '');
        if (empty($topicId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id is required');
        }

        // 权限校验：确保话题属于当前用户
        $this->topicAppService->getTopic($requestContext, (int) $topicId);

        $dataIsolation = DataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $dataIsolation->setThirdPartyOrganizationCode($authorization->getOrganizationCode());

        $sandboxId = $this->agentAppService->restartMagicClawSandbox($dataIsolation, (int) $topicId);

        return ['sandbox_id' => $sandboxId];
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

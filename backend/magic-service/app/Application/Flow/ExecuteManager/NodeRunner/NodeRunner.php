<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\Attachment;
use App\Application\Flow\ExecuteManager\Attachment\ExternalAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionDataCollector;
use App\Application\Flow\ExecuteManager\Memory\FlowMemoryManager;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\MemoryType;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeDebugResult;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Contract\Flow\NodeRunnerInterface;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use Dtyq\FlowExprEngine\ComponentFactory;
use Hyperf\Context\Context;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

abstract class NodeRunner implements NodeRunnerInterface
{
    protected Node $node;

    protected FlowMemoryManager $flowMemoryManager;

    protected MagicFlowDomainService $magicFlowDomainService;

    protected FileDomainService $fileDomainService;

    protected OperationPermissionAppService $operationPermissionAppService;

    protected LoggerInterface $logger;

    protected CacheInterface $cache;

    protected MagicChatFileDomainService $magicChatFileDomainService;

    protected MsgLogDomainService $msgLogDomainService;

    protected MagicUserDomainService $userDomainService;

    protected ModelGatewayMapper $modelGatewayMapper;

    protected LLMAppService $llmAppService;

    protected string $organizationCode = '';

    public function __construct(Node $node)
    {
        $this->logger = di(LoggerFactory::class)->get('NodeRunner');
        $this->cache = di(CacheInterface::class);
        $this->flowMemoryManager = di(FlowMemoryManager::class);
        $this->magicFlowDomainService = di(MagicFlowDomainService::class);
        $this->fileDomainService = di(FileDomainService::class);
        $this->operationPermissionAppService = di(OperationPermissionAppService::class);
        $this->magicChatFileDomainService = di(MagicChatFileDomainService::class);
        $this->msgLogDomainService = di(MsgLogDomainService::class);
        $this->userDomainService = di(MagicUserDomainService::class);
        $this->modelGatewayMapper = di(ModelGatewayMapper::class);
        $this->llmAppService = di(LLMAppService::class);

        $this->node = $node;
        // 初始化运行结果
        if (! $this->node->getNodeDebugResult()) {
            $this->node->setNodeDebugResult(new NodeDebugResult($this->node->getNodeVersion()));
        }
    }

    public function execute(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults = []): void
    {
        // 节点运行最大次数限制，防止死循环
        $max = 10000;
        $executeNum = $executionData->getExecuteNum($this->node->getNodeId());
        if ($executeNum >= $max) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.execute_num_limit');
        }
        $this->organizationCode = $executionData->getDataIsolation()->getCurrentOrganizationCode();

        // 忽略执行
        if ($this->node->getNodeParamsConfig()->isSkipExecute()) {
            return;
        }
        $throw = (bool) ($frontResults['isThrowException'] ?? true);

        $debugResult = $this->node->getNodeDebugResult();
        $debugResult->setStartTime(microtime(true));
        try {
            if (ExecutionDataCollector::isMaxNodeExecuteCountReached($executionData->getId())) {
                $this->logger->warning('NodeExecuteCountReached', [
                    'executor_id' => $executionData->getId(),
                    'node_id' => $this->node->getNodeId(),
                    'node_name' => $this->node->getName(),
                    'max_count' => ExecutionDataCollector::MAX_COUNT,
                ]);
                ExceptionBuilder::throw(
                    FlowErrorCode::ExecuteFailed,
                    'flow.executor.node_execute_count_reached',
                    ['node_id' => $this->node->getNodeId(), 'max_count' => ExecutionDataCollector::MAX_COUNT]
                );
            }

            $debugResult->setParams($this->node->getParams());
            if ($this->node->hasCallback()) {
                $callback = $this->node->getCallback();
                $callback($vertexResult, $executionData, $frontResults);
            } else {
                $this->node->validate();
                // 提前获取本次的结果，如果有，则直接使用
                $nextExecuteNum = $executeNum + 1;
                $historyVertexResult = $executionData->getNodeHistoryVertexResult($this->node->getNodeId(), $nextExecuteNum);
                if ($historyVertexResult) {
                    $vertexResult->copy($historyVertexResult);
                    $vertexResult->addDebugLog('history_vertex_result', $nextExecuteNum);
                } else {
                    $this->run($vertexResult, $executionData, $frontResults);
                }
            }
            $debugResult->setSuccess(true);
            $debugResult->setInput($vertexResult->getInput() ?? []);
            $debugResult->setOutput($vertexResult->getResult() ?? []);

            ExecutionDataCollector::incrementNodeExecuteCount($executionData->getId());
        } catch (Throwable $throwable) {
            $debugResult->setSuccess(false);
            $debugResult->setErrorCode((int) $throwable->getCode());
            $debugResult->setErrorMessage($throwable->getMessage());
            // 出现异常时不运行后续节点
            $vertexResult->setChildrenIds([]);
            $this->logger->warning('NodeRunnerFailed', [
                'node_id' => $this->node->getNodeId(),
                'node_version' => $this->node->getNodeVersion(),
                'message' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
                'trace' => $throwable->getTraceAsString(),
            ]);
            // 默认是要抛异常的
            if ($throw) {
                throw $throwable;
            }
        } finally {
            $debugResult->setDebugLog($vertexResult->getDebugLog());
            $debugResult->setEndTime(microtime(true));
            $debugResult->setChildrenIds($vertexResult->getChildrenIds());
            $debugResult->addLoopDebugResult($debugResult);

            // 记录节点次数的结果
            $executionData->increaseExecuteNum($this->node->getNodeId(), $vertexResult);
        }
    }

    protected function getModelName(string $paramKey, ExecutionData $executionData): string
    {
        if (empty($paramKey)) {
            return '';
        }
        $modelName = $this->node->getParams()[$paramKey] ?? '';
        if (is_array($modelName)) {
            $modelComponent = ComponentFactory::fastCreate($modelName);
            if (! $modelComponent?->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.component.format_error', ['label' => $paramKey]);
            }
            $modelComponent->getValue()->getExpressionValue()->setIsStringTemplate(true);
            $modelName = $modelComponent->getValue()->getResult($executionData->getExpressionFieldData());
        }
        if (empty($modelName)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.model.empty');
        }
        return $modelName;
    }

    protected function formatJson(string $json): array
    {
        $response = trim($json);
        // 如果 $response 以 ```json 开头则去除
        if (str_starts_with($response, '```json')) {
            $response = substr($response, 7);
        }
        // 如果 $response 以 ``` 结尾则去除
        if (str_ends_with($response, '```')) {
            $response = substr($response, 0, -3);
        }
        $response = trim($response, '\\');
        $response = str_replace('\\\\\"', '\"', $response);
        // 如果 $response 本身就是 JSON 格式的，那么直接返回
        $data = json_decode(trim($response), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }
        return $data;
    }

    protected function isNodeDebug(ExecutionData $executionData): bool
    {
        return $this->node->getDebug() && $executionData->isDebug();
    }

    abstract protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void;

    /**
     * todo 这里暂不实现重复上传的问题，均当做新文件上传
     * 记录流程所产生的文件，均会同时上传到云端，后续节点需要使用时从执行流程数据中优先匹配.
     * @return AbstractAttachment[]
     * @throws SSRFException
     */
    protected function recordFlowExecutionAttachments(ExecutionData $executionData, array $attachments, bool $lazyUpload = false): array
    {
        if (empty($attachments)) {
            return [];
        }
        $flowExecutionAttachments = [];

        $parallel = new Parallel(20);
        foreach ($attachments as $attachment) {
            if (! is_string($attachment)) {
                continue;
            }
            // 如果已经存在，直接添加到结果中
            $path = get_path_by_url($attachment);
            if ($attachmentObj = $executionData->getAttachmentRecord($path)) {
                $flowExecutionAttachments[] = $attachmentObj;
                continue;
            }
            // 如果是一个链接，那么需要对 url 进行限制
            if (EasyFileTools::isUrl($attachment)) {
                SSRFUtil::getSafeUrl($attachment, replaceIp: false);
            }

            $fromCoroutineId = Coroutine::id();
            $parallel->add(function () use ($fromCoroutineId, $lazyUpload, $attachment, $executionData, &$flowExecutionAttachments) {
                Context::copy($fromCoroutineId, ['request-id', 'x-b3-trace-id']);
                try {
                    if (! $lazyUpload) {
                        $uploadFile = new UploadFile($attachment, 'flow-execute/' . $executionData->getAgentId());
                        $this->fileDomainService->uploadByCredential($executionData->getDataIsolation()->getCurrentOrganizationCode(), $uploadFile);
                        $url = $this->fileDomainService->getLink($executionData->getDataIsolation()->getCurrentOrganizationCode(), $uploadFile->getKey())->getUrl();

                        $attachmentObj = new Attachment(
                            name: $uploadFile->getName(),
                            url: $url,
                            ext: $uploadFile->getExt(),
                            size: $uploadFile->getSize(),
                            originAttachment: $attachment,
                        );
                    } else {
                        $attachmentObj = new ExternalAttachment($attachment);
                    }

                    $flowExecutionAttachments[] = $attachmentObj;
                    $executionData->addAttachmentRecord($attachmentObj);
                } catch (Throwable $throwable) {
                    $this->logger->error('upload_attachment_error', [
                        'error' => $throwable->getMessage(),
                        'file' => $throwable->getFile(),
                        'line' => $throwable->getLine(),
                        'trace' => $throwable->getTraceAsString(),
                        'attachment' => $attachment,
                    ]);
                }
            });
        }
        $parallel->wait(false);

        return $flowExecutionAttachments;
    }

    protected function executeNodeIntroverted(VertexResult $vertexResult, Node $nextNode, ExecutionData $executionData, array $frontResults = []): void
    {
        $nextNodeVertexResult = new VertexResult();
        NodeRunnerFactory::make($nextNode)->execute($nextNodeVertexResult, $executionData, $frontResults);
        $vertexResult->addDebugLog('IntrovertedExecuteNode.' . $nextNode->getNodeId(), [
            'node_id' => $nextNode->getNodeId(),
            'node_type' => $nextNode->getNodeTypeName(),
            'debug' => $nextNodeVertexResult->getDebugLog(),
            'result' => $nextNodeVertexResult->getResult(),
        ]);
        foreach ($nextNodeVertexResult->getDebugLog() as $key => $value) {
            $vertexResult->addDebugLog($key, $value);
        }

        $nextNode->getNodeParamsConfig()->setSkipExecute(true);
    }

    protected function getMemoryType(ExecutionData $executionData): MemoryType
    {
        if ($executionData->getExecutionType()->isFlowMemory()) {
            return MemoryType::Chat;
        }
        if ($executionData->getExecutionType()->isImChat()) {
            return MemoryType::IMChat;
        }
        return MemoryType::None;
    }
}

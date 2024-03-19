<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Http\V1;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Http\V1\HttpNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Structure\Api\ApiSend;
use Dtyq\FlowExprEngine\Structure\Api\Safe\DefenseAgainstSSRFOptions;
use Throwable;

#[FlowNodeDefine(
    type: NodeType::Http->value,
    code: NodeType::Http->name,
    name: 'HTTP 请求',
    paramsConfig: HttpNodeParamsConfig::class,
    version: 'v1',
    singleDebug: true,
    needInput: false,
    needOutput: true,
)]
class HttpNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $apiSend = null;
        try {
            /** @var HttpNodeParamsConfig $paramsConfig */
            $paramsConfig = $this->node->getNodeParamsConfig();

            $apiComponent = $paramsConfig->getApi();

            $api = $apiComponent->getApi();
            $apiRequestOptions = $api->getApiRequestOptions($executionData->getExpressionFieldData());

            $apiSend = new ApiSend($apiRequestOptions, 60, new DefenseAgainstSSRFOptions(allowRedirect: true));
            $apiSend->run();
            $vertexResult->addDebugLog('api_info', $apiSend->show());
            if ($apiSend->getResponse()->isErr()) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.http.api_request_fail', [
                    'error' => $apiSend->getResponse()->getErrMessage(),
                ]);
            }

            $output = $this->node->getOutput()?->getForm()?->getForm();

            if ($output) {
                $output->removeAllValues();
                $output->appendConstValue($apiSend->getResponse()->getArrayBody(false));
                $responseResult = $output->getKeyValue(check: true);
                $executionData->saveNodeContext($this->node->getNodeId(), $responseResult);
                $vertexResult->setResult($responseResult);
            }
        } catch (Throwable $e) {
            // 不抛出异常
            $vertexResult->addDebugLog('error_message', $e->getMessage());
        } finally {
            $executionData->saveNodeContext($this->node->getSystemNodeId(), [
                'body' => $apiSend?->getResponse()?->getBody() ?: ($apiSend?->getResponse()?->getErrMessage() ?: ''),
                'status_code' => $apiSend?->getResponse()?->getCode() ?? 500,
            ]);
            $vertexResult->addDebugLog('system_response', $executionData->getNodeContext($this->node->getSystemNodeId()));
        }
    }
}

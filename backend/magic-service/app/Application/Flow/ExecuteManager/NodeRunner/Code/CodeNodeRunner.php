<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Code;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Code\CodeNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Code\Structure\CodeMode;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\CodeLanguage;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PHPExecutorInterface;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\PythonExecutorInterface;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Throwable;

#[FlowNodeDefine(
    type: NodeType::Code->value,
    code: NodeType::Code->name,
    name: '代码执行',
    paramsConfig: CodeNodeParamsConfig::class,
    version: 'v0',
    singleDebug: true,
    needInput: true,
    needOutput: true
)]
class CodeNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        $input = $this->node->getInput()?->getFormComponent()?->getForm();
        $output = $this->node->getOutput()?->getFormComponent()?->getForm();

        /** @var CodeNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $code = match ($paramsConfig->getMode()) {
            CodeMode::ImportCode => $paramsConfig->getImportCode()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '',
            default => $paramsConfig->getCode(),
        };

        if (empty($code)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.code.empty');
        }

        $inputResult = $input?->getKeyValue($executionData->getExpressionFieldData()) ?? [];
        $outputResult = [];
        if (! is_array($inputResult)) {
            $inputResult = [];
        }
        $vertexResult->setInput($inputResult);

        try {
            $executeResult = match ($paramsConfig->getLanguage()) {
                CodeLanguage::PHP => di(PHPExecutorInterface::class)
                    ->execute($executionData->getDataIsolation()->getCurrentOrganizationCode(), $code, $inputResult),
                CodeLanguage::PYTHON => di(PythonExecutorInterface::class)
                    ->execute($executionData->getDataIsolation()->getCurrentOrganizationCode(), $code, $inputResult),
                default => ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.code.language_not_supported'),
            };
        } catch (Throwable $exception) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.code.execution_error', ['error' => $exception->getMessage()]);
        }

        if (is_array($executeResult->getResult())) {
            $output?->appendConstValue($executeResult->getResult());
            $outputResult = $output?->getKeyValue() ?? [];
            if (! is_array($outputResult)) {
                $outputResult = [];
            }
        }

        $vertexResult->addDebugLog('code_debug', $executeResult->getDebug());
        $executionData->saveNodeContext($this->node->getNodeId(), $outputResult);
        $vertexResult->setResult($outputResult);
    }
}

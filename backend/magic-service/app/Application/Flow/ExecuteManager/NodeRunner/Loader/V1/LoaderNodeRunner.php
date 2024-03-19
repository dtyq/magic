<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Loader\V1;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Application\Kernel\Proxy\FileParserProxy;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loader\V1\LoaderNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\FileType;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;

#[FlowNodeDefine(
    type: NodeType::Loader->value,
    code: NodeType::Loader->name,
    name: '文档解析',
    paramsConfig: LoaderNodeParamsConfig::class,
    version: 'v1',
    singleDebug: true,
    needInput: false,
    needOutput: true,
)]
class LoaderNodeRunner extends NodeRunner
{
    /**
     * @throws FlowExprEngineException
     * @throws SSRFException
     */
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var LoaderNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $filesComponent = $paramsConfig->getFiles();
        $files = $filesComponent->getForm()->getKeyValue($executionData->getExpressionFieldData()) ?? [];
        if (! is_array($files)) {
            $files = [];
        }
        $files = array_filter($files);

        $filesContent = [];
        $resultContent = '';
        foreach ($files as $file) {
            $fileUrl = $file['file_url'] ?? ($file['url'] ?? '');
            if (empty($fileUrl)) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'file_url']);
            }
            $fileName = $file['file_name'] ?? ($file['name'] ?? $fileUrl);

            $fileExtension = FileType::getType($fileUrl);

            $content = di(FileParserProxy::class)->parse($fileUrl);
            $filesContent[] = [
                'name' => $fileName,
                'url' => $fileUrl,
                'extension' => $fileExtension,
                'content' => $content,
            ];

            $resultContent .= '# ' . $fileName . "\n" . $content . "\n\n";
        }

        $result = [
            'content' => $resultContent,
            'files' => $filesContent,
        ];
        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}

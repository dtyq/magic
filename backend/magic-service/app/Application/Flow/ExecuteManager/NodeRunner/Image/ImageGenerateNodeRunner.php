<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Image;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Image\ImageGenerateNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

#[FlowNodeDefine(
    type: NodeType::ImageGenerate->value,
    code: NodeType::ImageGenerate->name,
    name: '图像生成',
    paramsConfig: ImageGenerateNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class ImageGenerateNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var ImageGenerateNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $userPrompt = $paramsConfig->getUserPrompt()->getValue()->getResult($executionData->getExpressionFieldData());
        $vertexResult->addDebugLog('user_prompt', $userPrompt);

        $wide = $paramsConfig->getWidth()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '512';
        $vertexResult->addDebugLog('width', $wide);

        $height = $paramsConfig->getHeight()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '512';
        $vertexResult->addDebugLog('height', $height);

        $negativePrompt = $paramsConfig->getNegativePrompt()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? '';
        $vertexResult->addDebugLog('negative_prompt', $negativePrompt);

        $referenceImages = $paramsConfig->getReferenceImages()?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? [];
        $vertexResult->addDebugLog('reference_images', $referenceImages);

        $defaultRatio = '1:1';
        $ratio = $paramsConfig->getRatio()?->getValue()?->getResult($executionData->getExpressionFieldData())[0]['id'] ?? $defaultRatio;

        $vertexResult->addDebugLog('ratio', $ratio);

        $useSr = $paramsConfig->getUseSr();
        $vertexResult->addDebugLog('useSr', $negativePrompt);

        $model = $paramsConfig->getModel();
        $vertexResult->addDebugLog('model', $model);
        $data = [
            'model' => $model,
            'height' => $height,
            'width' => $wide,
            'user_prompt' => $userPrompt,
            'negative_prompt' => $negativePrompt,
            'ratio' => $ratio,
            'use_sr' => $useSr,
            'reference_images' => $referenceImages,
            'generate_num' => 1,
        ];

        $agentId = $executionData->getAgentId();
        $data['agent_id'] = $agentId;
        $flowDataIsolation = $executionData->getDataIsolation();
        $magicUserAuthorization = new MagicUserAuthorization();
        $magicUserAuthorization->setOrganizationCode($flowDataIsolation->getCurrentOrganizationCode());
        $magicUserAuthorization->setId($flowDataIsolation->getCurrentUserId());
        $data['source_type'] = ImageGenerateSourceEnum::FLOW_NODE;
        $data['source_id'] = $executionData->getAgentId() ?? $executionData->getFlowCode();
        $images = $this->llmAppService->imageGenerate($magicUserAuthorization, $model, '', $data);
        // 流程只取一个
        $image = $images[0];
        // 这里可能是 url、base64，均记录到流程执行附件中（此时会进行上传到云服务端）。上传失败的文件会直接跳过
        $attachments = $this->recordFlowExecutionAttachments($executionData, [$image], true);
        $vertexResult->addDebugLog('attachments', array_map(fn (AbstractAttachment $attachment) => $attachment->toArray(), $attachments));

        $result = [
            'image_url' => $attachments[0]->getUrl(),
        ];
        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}

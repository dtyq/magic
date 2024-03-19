<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Image;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class ImageGenerateNodeParamsConfig extends NodeParamsConfig
{
    private string $model;

    private ?Component $height;

    private ?Component $width;

    private ?Component $userPrompt;

    private ?Component $negativePrompt;

    private ?Component $ratio;

    private bool $useSr = false;

    private ?Component $referenceImages;

    public function validate(): array
    {
        $params = $this->node->getParams();

        $userPrompt = ComponentFactory::fastCreate($params['user_prompt'] ?? []);
        if ($userPrompt && (! $userPrompt->isValue())) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'flow.component.format_error', ['user_prompt']);
        }
        $this->userPrompt = $userPrompt;

        if (empty($params['model'])) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.empty', ['label' => 'model']);
        }
        $this->model = $params['model'];
        $this->height = ComponentFactory::fastCreate($params['height'] ?? []);
        $this->width = ComponentFactory::fastCreate($params['width'] ?? []);
        $this->negativePrompt = ComponentFactory::fastCreate($params['negative_prompt'] ?? []);
        $this->ratio = ComponentFactory::fastCreate($params['ratio'] ?? []);
        $this->useSr = (bool) ($params['use_sr'] ?? false);
        $this->referenceImages = ComponentFactory::fastCreate($params['reference_images'] ?? []);

        return [
            'model' => $this->model,
            'height' => $this->height?->toArray(),
            'width' => $this->width?->toArray(),
            'user_prompt' => $this->userPrompt?->toArray(),
            'negative_prompt' => $this->negativePrompt?->toArray(),
            'ratio' => $this->ratio?->toArray(),
            'use_sr' => $this->useSr,
            'reference_images' => $this->referenceImages,
        ];
    }

    public function generateTemplate(): void
    {
        $ratioStructure = [
            'type' => 'const',
            'const_value' => null,
        ];
        $this->node->setParams([
            'model' => ImageGenerateModelType::Midjourney->value,
            'height' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'width' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'user_prompt' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'negative_prompt' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'ratio' => ComponentFactory::generateTemplate(StructureType::Value, $ratioStructure)?->jsonSerialize(),
            'use_sr' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
            'reference_images' => ComponentFactory::generateTemplate(StructureType::Value)?->jsonSerialize(),
        ]);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(
            <<<'JSON'
    {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": "root节点",
        "description": "",
        "items": null,
        "value": null,
        "required": [
            "images"
        ],
        "properties": {
            "images": {
                "type": "array",
                "key": "images",
                "sort": 0,
                "title": "图片数据",
                "description": "",
                "items": {
                    "type": "string",
                    "key": "",
                    "sort": 0,
                    "title": "图片链接",
                    "description": "",
                    "items": null,
                    "properties":null, 
                    "required": null,
                    "value": null
                },
                "properties": null,
                "required": null,
                "value": null
            }
        }
    }
JSON
        )));
        $this->node->setOutput($output);
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getHeight(): ?Component
    {
        return $this->height;
    }

    public function setHeight(Component $height): void
    {
        $this->height = $height;
    }

    public function getWidth(): ?Component
    {
        return $this->width;
    }

    public function setWidth(Component $width): void
    {
        $this->width = $width;
    }

    public function getUserPrompt(): ?Component
    {
        return $this->userPrompt;
    }

    public function setUserPrompt(Component $userPrompt): void
    {
        $this->userPrompt = $userPrompt;
    }

    public function getNegativePrompt(): ?Component
    {
        return $this->negativePrompt;
    }

    public function setNegativePrompt(Component $negativePrompt): void
    {
        $this->negativePrompt = $negativePrompt;
    }

    public function getRatio(): ?Component
    {
        return $this->ratio;
    }

    public function setRatio(Component $ratio): void
    {
        $this->ratio = $ratio;
    }

    public function getUseSr(): bool
    {
        return $this->useSr;
    }

    public function setUseSr(bool $useSr): void
    {
        $this->useSr = $useSr;
    }

    public function getReferenceImages(): ?Component
    {
        return $this->referenceImages;
    }

    public function setReferenceImages(?Component $referenceImages): void
    {
        $this->referenceImages = $referenceImages;
    }
}

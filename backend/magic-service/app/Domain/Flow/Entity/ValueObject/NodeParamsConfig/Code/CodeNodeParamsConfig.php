<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Code;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Code\Structure\CodeMode;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Contract\Flow\CodeExecutor\CodeLanguage;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class CodeNodeParamsConfig extends NodeParamsConfig
{
    private CodeLanguage $language = CodeLanguage::PHP;

    private CodeMode $mode = CodeMode::Normal;

    private ?Component $importCode = null;

    private string $code = '';

    public function getLanguage(): CodeLanguage
    {
        return $this->language;
    }

    public function getMode(): CodeMode
    {
        return $this->mode;
    }

    public function getImportCode(): ?Component
    {
        return $this->importCode;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $language = CodeLanguage::tryFrom($params['language'] ?? 'php');
        if (empty($language)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.code.empty_language');
        }
        $this->language = $language;
        if (! $this->language->isSupport()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.code.unsupported_code_language', ['language' => $this->language->value]);
        }

        $codeMode = CodeMode::tryFrom($params['mode'] ?? 'normal');
        if (empty($codeMode)) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.node.code.empty_mode');
        }
        $this->mode = $codeMode;

        if ($codeMode === CodeMode::ImportCode) {
            $this->importCode = ComponentFactory::fastCreate($params['import_code'] ?? []);
            if (! $this->importCode?->isValue()) {
                ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'import_code']);
            }
        }
        if ($codeMode === CodeMode::Normal) {
            $code = $params['code'] ?? '';
            // 这里的 code 可能是混淆后的
            is_string($code) && $this->code = ShadowCode::unShadow($code);
        }

        return [
            'language' => $this->language->value,
            'mode' => $this->mode->value,
            'code' => $this->code,
            'import_code' => $this->importCode?->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'language' => CodeLanguage::PHP->value,
            'mode' => CodeMode::Normal->value,
            'code' => '',
            'import_code' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
        ]);
        $input = new NodeInput();
        $output = new NodeOutput();

        $input->setForm(ComponentFactory::generateTemplate(StructureType::Form));
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form));

        $this->node->setInput($input);
        $this->node->setOutput($output);
    }
}

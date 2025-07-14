<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\Validation\Request\FormRequest;
use Hyperf\HttpServer\Contract\RequestInterface;
use App\Infrastructure\Core\AbstractRequestDTO;

class CreateScriptTaskRequestDTO extends AbstractRequestDTO
{
    protected string $taskId = '';
    protected string $scriptName = '';
    protected array $arguments = [];

    protected string $sandboxId = '';

    /**
     * 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'task_id' => 'string',
            'script_name' => 'required|string',
            'arguments' => 'required|array',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'task_id.string' => '任务ID不能为空',
            'script_name.required' => '脚本名称不能为空',
            'arguments.required' => '脚本参数不能为空',
        ];
    }


    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'task_id' => '任务ID',
            'script_name' => '脚本名称',
            'arguments' => '脚本参数',
        ];
    }


    public function getTaskId(): string
    {
        return $this->taskId;
    }


    public function getScriptName(): string
    {
        return $this->scriptName;
    }

    public function setScriptName(string $scriptName): void
    {
        $this->scriptName = $scriptName;
    }

    public function getArguments(): array
    {
        return $this->arguments;
    }

    public function setArguments(array $arguments): void
    {
        $this->arguments = $arguments;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): void
    {
        $this->sandboxId = $sandboxId;
    }


}

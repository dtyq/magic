<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Request;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Admin\DTO\AgentGlobalSettingsDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use InvalidArgumentException;

class EditAgentGlobalSettingsRequestDTO extends AbstractDTO
{
    /**
     * @var AgentGlobalSettingsDTO[]
     */
    private array $settings = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $instance = new self();
        $data = ['settings' => $request->all()];

        $validator = di(ValidatorFactoryInterface::class)->make(
            $data,
            $instance->rules(),
            $instance->messages()
        );

        if ($validator->fails()) {
            throw new InvalidArgumentException($validator->errors()->first());
        }

        $instance->formatData($data);
        return $instance;
    }

    public function rules(): array
    {
        $typeValues = array_map(fn ($case) => (string) $case->value, AdminGlobalSettingsType::cases());
        $statusValues = array_map(fn ($case) => (string) $case->value, AdminGlobalSettingsStatus::cases());

        return [
            'settings.*' => ['required', 'array'],
            'settings.*.type' => [
                'required',
                'integer',
                'in:' . implode(',', $typeValues),
            ],
            'settings.*.status' => [
                'required',
                'integer',
                'in:' . implode(',', $statusValues),
            ],
            'settings.*.extra' => ['nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            '*.required' => 'Agent全局设置不能为空',
            '*.array' => 'Agent全局设置必须是数组',
            '*.type.required' => '类型不能为空',
            '*.type.integer' => '类型必须为整数',
            '*.type.in' => '类型值无效',
            '*.status.required' => '状态不能为空',
            '*.status.integer' => '状态必须为整数',
            '*.status.in' => '状态值无效',
            '*.extra.array' => '额外参数必须是数组',
        ];
    }

    /**
     * @return AgentGlobalSettingsDTO[]
     */
    public function getSettings(): array
    {
        return $this->settings;
    }

    protected function formatData(array $data): void
    {
        foreach ($data['settings'] as $setting) {
            $this->settings[] = new AgentGlobalSettingsDTO([
                'type' => $setting['type'],
                'status' => $setting['status'],
                'extra' => $setting['extra'] ?? null,
            ]);
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Common\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

class BatchGenerateIdRequestDTO extends AbstractDTO
{
    public int $count = 1;

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();
        $validator = di(ValidatorFactoryInterface::class)->make($data, $dto->rules(), $dto->messages());
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $dto->count = (int) $request->input('count', 1);

        return $dto;
    }

    public function getCount(): int
    {
        return $this->count;
    }

    public function rules(): array
    {
        return [
            'count' => 'required|integer|min:1|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'count.required' => '数量不能为空',
            'count.integer' => '数量必须是整数',
            'count.min' => '数量最少为1',
            'count.max' => '数量最多为1000',
        ];
    }

    public function attributes(): array
    {
        return [
            'count' => '生成数量',
        ];
    }
}

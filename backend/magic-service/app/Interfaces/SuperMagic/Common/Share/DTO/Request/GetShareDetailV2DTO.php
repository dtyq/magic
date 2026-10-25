<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Common\Share\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\SuperMagic\Message\DTO\Request\MessageCursorRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetShareDetailV2DTO extends GetShareDetailDTO
{
    protected ?int $afterId = null;

    protected int $limit = 10;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $password = $request->input('pwd', '');
        if (! is_string($password)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'message_cursor.invalid_password');
        }
        $dto->password = $password;
        $pagination = new MessageCursorRequestDTO($request->all(), 10);
        $dto->afterId = $pagination->getAfterId();
        $dto->limit = $pagination->getLimit();
        return $dto;
    }

    public function getAfterId(): ?int
    {
        return $this->afterId;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }
}

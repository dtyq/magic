<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetTopicMessagesByCursorRequestDTO extends MessageCursorRequestDTO
{
    protected int $topicId;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
        $this->topicId = self::parsePositiveInteger($data['topic_id'] ?? null, 'topic_id');
    }

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();
        $data['topic_id'] = $request->route('id');
        return new self($data);
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }
}

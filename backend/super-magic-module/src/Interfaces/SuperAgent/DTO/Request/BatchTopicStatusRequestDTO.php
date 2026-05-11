<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class BatchTopicStatusRequestDTO extends AbstractDTO
{
    /**
     * @var int[]
     */
    protected array $topicIds = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $topicIds = array_map(
            'intval',
            array_filter((array) $request->input('topic_ids', []), static fn ($topicId) => $topicId !== null && $topicId !== '')
        );
        $dto->setTopicIds(array_values(array_unique(array_filter($topicIds, static fn (int $topicId) => $topicId > 0))));
        return $dto;
    }

    public function getTopicIds(): array
    {
        return $this->topicIds;
    }

    public function setTopicIds(array $topicIds): self
    {
        $this->topicIds = $topicIds;
        return $this;
    }
}

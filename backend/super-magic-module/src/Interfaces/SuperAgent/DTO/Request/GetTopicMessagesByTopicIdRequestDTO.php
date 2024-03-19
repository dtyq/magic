<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Exception;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetTopicMessagesByTopicIdRequestDTO
{
    /**
     * 有效的排序方向.
     */
    private const VALID_SORT_DIRECTIONS = ['asc', 'desc'];

    /**
     * @var int 话题ID
     */
    protected int $topicId = 0;

    /**
     * @var int 页码
     */
    protected int $page = 1;

    /**
     * @var int 每页大小
     */
    protected int $pageSize = 20;

    /**
     * @var string 排序方向
     */
    protected string $sortDirection = 'asc';

    /**
     * 从请求数组构造.
     */
    public function __construct(array $data = [])
    {
        $this->topicId = (int) ($data['topic_id'] ?? 0);
        $this->page = (int) ($data['page'] ?? 1);
        $this->pageSize = (int) ($data['page_size'] ?? 20);
        $this->setSortDirection($data['sort_direction'] ?? 'asc');
    }

    /**
     * 从 HTTP 请求对象创建实例.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $id = $request->route('id'); // 从路由参数获取 topic_id

        return new self([
            'topic_id' => $id,
            'page' => $request->input('page', 1),
            'page_size' => $request->input('page_size', 20),
            'sort_direction' => $request->input('sort_direction', 'asc'),
        ]);
    }

    /**
     * 获取话题ID.
     */
    public function getTopicId(): int
    {
        return $this->topicId;
    }

    /**
     * 获取页码.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 获取每页大小.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * 获取排序方向.
     */
    public function getSortDirection(): string
    {
        return $this->sortDirection;
    }

    /**
     * 设置排序方向.
     *
     * @param string $sortDirection 排序方向
     * @throws Exception 如果排序方向无效则抛出异常
     */
    protected function setSortDirection(string $sortDirection): void
    {
        $sortDirection = strtolower(trim($sortDirection));

        if (! in_array($sortDirection, self::VALID_SORT_DIRECTIONS, true)) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterMissing,
                'sort_direction.invalid_value'
            );
        }

        $this->sortDirection = $sortDirection;
    }
}

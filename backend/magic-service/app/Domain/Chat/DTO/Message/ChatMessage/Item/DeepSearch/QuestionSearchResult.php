<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch;

use App\Infrastructure\Core\AbstractObject;

/**
 * 某个问题的搜索结果.
 */
class QuestionSearchResult extends AbstractObject
{
    /**
     * 问题 id.
     */
    protected string $questionId;

    /**
     * @var SearchDetailItem[]
     */
    protected array $search;

    /**
     * 总词数.
     */
    protected int $totalWords;

    /**
     * 匹配词数.
     */
    protected int $matchCount;

    /**
     * 页数.
     */
    protected int $pageCount;

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function setQuestionId(string $questionId): void
    {
        $this->questionId = $questionId;
    }

    public function getSearch(): array
    {
        return $this->search;
    }

    public function setSearch(array $search): void
    {
        foreach ($search as $key => $item) {
            if (! $item instanceof SearchDetailItem) {
                $item = new SearchDetailItem($item);
            }
            // 移除详情
            $item->setDetail(null);
            $search[$key] = $item;
        }
        $this->search = $search;
    }

    public function getTotalWords(): int
    {
        return $this->totalWords;
    }

    public function setTotalWords(int $totalWords): void
    {
        $this->totalWords = $totalWords;
    }

    public function getMatchCount(): int
    {
        return $this->matchCount;
    }

    public function setMatchCount(int $matchCount): void
    {
        $this->matchCount = $matchCount;
    }

    public function getPageCount(): int
    {
        return $this->pageCount;
    }

    public function setPageCount(int $pageCount): void
    {
        $this->pageCount = $pageCount;
    }
}

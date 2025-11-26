<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use Dtyq\FlowExprEngine\Kernel\Utils\Functions;

class NodeDebugResult extends AbstractValueObject
{
    /**
     * Maximum number of loop results to keep at the beginning.
     */
    private const MAX_LOOP_RESULTS_HEAD = 10;

    /**
     * Maximum number of loop results to keep at the end.
     */
    private const MAX_LOOP_RESULTS_TAIL = 10;

    /**
     *  节点是否执行成功
     */
    protected bool $success = false;

    protected float $startTime = 0;

    protected float $endTime = 0;

    protected int $errorCode = 0;

    /**
     *  节点执行失败时的错误信息.
     */
    protected string $errorMessage = '';

    protected string $nodeVersion = '';

    /**
     *  节点执行参数.
     */
    protected array $params = [];

    /**
     *  节点执行输入.
     */
    protected array $input = [];

    /**
     *  节点执行输出.
     */
    protected array $output = [];

    protected array $childrenIds = [];

    protected array $debugLog = [];

    protected ?array $loopDebugResults = null;

    protected bool $throwException = true;

    /**
     * The total count of loop iterations, including omitted ones.
     */
    protected int $totalLoopCount = 0;

    /**
     * The number of omitted loop results in the middle.
     */
    protected int $omittedLoopCount = 0;

    public function __construct(string $nodeVersion)
    {
        $this->nodeVersion = $nodeVersion;
        parent::__construct();
    }

    public function hasExecute(): bool
    {
        return isset($this->success);
    }

    public function getElapsedTime(): string
    {
        if (isset($this->startTime, $this->endTime)) {
            return (string) Functions::calculateElapsedTime($this->startTime, $this->endTime);
        }
        return '0';
    }

    public function setSuccess(bool $success): void
    {
        $this->success = $success;
    }

    public function isSuccess(): bool
    {
        return $this->success ?? false;
    }

    public function addLoopDebugResult(NodeDebugResult $nodeDebugResult): void
    {
        if ($this->loopDebugResults === null) {
            $this->loopDebugResults = [];
        }

        $debugResult = new NodeDebugResult($nodeDebugResult->getNodeVersion());
        $debugResult->setSuccess($nodeDebugResult->isSuccess());
        $debugResult->setStartTime($nodeDebugResult->getStartTime());
        $debugResult->setEndTime($nodeDebugResult->getEndTime());
        $debugResult->setErrorCode($nodeDebugResult->getErrorCode());
        $debugResult->setErrorMessage($nodeDebugResult->getErrorMessage());
        $debugResult->setParams($nodeDebugResult->getParams());
        $debugResult->setInput($nodeDebugResult->getInput());
        $debugResult->setOutput($nodeDebugResult->getOutput());
        $debugResult->setChildrenIds($nodeDebugResult->getChildrenIds());
        $debugResult->setDebugLog($nodeDebugResult->getDebugLog());

        ++$this->totalLoopCount;
        $currentCount = count($this->loopDebugResults);
        $maxTotal = self::MAX_LOOP_RESULTS_HEAD + self::MAX_LOOP_RESULTS_TAIL;

        if ($currentCount < $maxTotal) {
            // Still within the limit, just add it
            $this->loopDebugResults[] = $debugResult;
        } else {
            // We need to maintain sliding window: keep first 5 and last 5
            // Remove the item at position MAX_LOOP_RESULTS_HEAD (the 6th item, which is the first of the tail section)
            array_splice($this->loopDebugResults, self::MAX_LOOP_RESULTS_HEAD, 1);
            // Add the new item at the end
            $this->loopDebugResults[] = $debugResult;
            // Increment omitted count
            ++$this->omittedLoopCount;
        }
    }

    public function isUnAuthorized(): bool
    {
        return $this->errorCode == 40101;
    }

    public function setThrowException(bool $throwException): void
    {
        $this->throwException = $throwException;
    }

    public function isThrowException(): bool
    {
        return $this->throwException;
    }

    public function getStartTime(): float
    {
        return $this->startTime;
    }

    public function setStartTime(float $startTime): void
    {
        $this->startTime = $startTime;
    }

    public function getEndTime(): float
    {
        return $this->endTime;
    }

    public function setEndTime(float $endTime): void
    {
        $this->endTime = $endTime;
    }

    public function getErrorCode(): int
    {
        return $this->errorCode;
    }

    public function setErrorCode(int $errorCode): void
    {
        $this->errorCode = $errorCode;
    }

    public function getErrorMessage(): string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getNodeVersion(): string
    {
        return $this->nodeVersion;
    }

    public function setNodeVersion(string $nodeVersion): void
    {
        $this->nodeVersion = $nodeVersion;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    public function getInput(): array
    {
        return $this->input;
    }

    public function setInput(array $input): void
    {
        $this->input = $input;
    }

    public function getOutput(): array
    {
        return $this->output;
    }

    public function setOutput(array $output): void
    {
        $this->output = $output;
    }

    public function getChildrenIds(): array
    {
        return $this->childrenIds;
    }

    public function setChildrenIds(array $childrenIds): void
    {
        $this->childrenIds = $childrenIds;
    }

    public function getDebugLog(): array
    {
        return $this->debugLog;
    }

    public function setDebugLog(array $debugLog): void
    {
        $this->debugLog = $debugLog;
    }

    public function getLoopDebugResults(): ?array
    {
        return $this->loopDebugResults;
    }

    public function setLoopDebugResults(?array $loopDebugResults): void
    {
        $this->loopDebugResults = $loopDebugResults;
    }

    public function getTotalLoopCount(): int
    {
        return $this->totalLoopCount;
    }

    public function getOmittedLoopCount(): int
    {
        return $this->omittedLoopCount;
    }

    public function toArray(): array
    {
        $loopDebugResults = $this->loopDebugResults ?? [];
        // 有多个结果时，才需要有 loop_debug_results
        if (count($loopDebugResults) <= 1) {
            $loopDebugResults = [];
        }

        $formattedLoopResults = $this->formatLoopDebugResults($loopDebugResults, false);

        return [
            'success' => $this->success,
            'start_time' => $this->startTime,
            'end_time' => $this->endTime,
            'elapsed_time' => $this->getElapsedTime(),
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
            'node_version' => $this->nodeVersion,
            'params' => $this->params,
            'input' => $this->input,
            'output' => $this->output,
            'children_ids' => $this->childrenIds,
            'debug_log' => $this->debugLog,
            'loop_debug_results' => $formattedLoopResults,
        ];
    }

    public function toDesensitizationArray(): array
    {
        $loopDebugResults = $this->loopDebugResults ?? [];
        // 有多个结果时，才需要有 loop_debug_results
        if (count($loopDebugResults) <= 1) {
            $loopDebugResults = [];
        }

        $formattedLoopResults = $this->formatLoopDebugResults($loopDebugResults, true);

        return [
            'success' => $this->success,
            'start_time' => $this->startTime,
            'end_time' => $this->endTime,
            'elapsed_time' => $this->getElapsedTime(),
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
            'node_version' => $this->nodeVersion,
            'children_ids' => $this->childrenIds,
            'loop_debug_results' => $formattedLoopResults,
        ];
    }

    /**
     * Format loop debug results by inserting an omission placeholder when applicable.
     */
    private function formatLoopDebugResults(array $loopDebugResults, bool $desensitize): array
    {
        if (empty($loopDebugResults)) {
            return [];
        }

        // If no omission occurred, return all results
        if ($this->omittedLoopCount === 0) {
            return array_map(
                fn (NodeDebugResult $nodeDebugResult) => $desensitize ? $nodeDebugResult->toDesensitizationArray() : $nodeDebugResult->toArray(),
                $loopDebugResults
            );
        }

        // Split results into head and tail
        $headResults = array_slice($loopDebugResults, 0, self::MAX_LOOP_RESULTS_HEAD);
        $tailResults = array_slice($loopDebugResults, self::MAX_LOOP_RESULTS_HEAD);

        $formattedResults = [];

        // Add head results with loop index
        foreach ($headResults as $index => $result) {
            $resultArray = $desensitize ? $result->toDesensitizationArray() : $result->toArray();
            // Add loop iteration index to debug_log
            if (! $desensitize && isset($resultArray['debug_log'])) {
                $resultArray['debug_log']['_loop_index'] = $index + 1;
            }
            $formattedResults[] = $resultArray;
        }

        // Calculate time range for omitted iterations
        $lastHeadResult = end($headResults);
        $firstTailResult = reset($tailResults);
        $omissionStartTime = $lastHeadResult ? $lastHeadResult->getEndTime() : 0;
        $omissionEndTime = $firstTailResult ? $firstTailResult->getStartTime() : 0;
        $omissionElapsedTime = ($omissionStartTime > 0 && $omissionEndTime > 0)
            ? (string) Functions::calculateElapsedTime($omissionStartTime, $omissionEndTime)
            : '0';

        // Add omission placeholder with structure consistent with other results
        $omissionPlaceholder = [
            'success' => true,
            'start_time' => $omissionStartTime,
            'end_time' => $omissionEndTime,
            'elapsed_time' => $omissionElapsedTime,
            'error_code' => 0,
            'error_message' => '',
            'node_version' => '',
            'children_ids' => [],
        ];

        if (! $desensitize) {
            // For full output, include params, input, output, and debug_log
            $omittedStartIndex = self::MAX_LOOP_RESULTS_HEAD + 1;
            $omittedEndIndex = $this->totalLoopCount - self::MAX_LOOP_RESULTS_TAIL;
            $omissionPlaceholder['params'] = [];
            $omissionPlaceholder['input'] = [];
            $omissionPlaceholder['output'] = [];
            $omissionPlaceholder['debug_log'] = [
                '_omitted' => true,
                'omitted_count' => $this->omittedLoopCount,
                'omitted_range' => [$omittedStartIndex, $omittedEndIndex],
                'message' => "Omitted {$this->omittedLoopCount} loop iterations (#{$omittedStartIndex} to #{$omittedEndIndex}) to prevent memory overflow",
            ];
        }

        $formattedResults[] = $omissionPlaceholder;

        // Add tail results with correct loop index
        $tailStartIndex = $this->totalLoopCount - count($tailResults) + 1;
        foreach ($tailResults as $index => $result) {
            $resultArray = $desensitize ? $result->toDesensitizationArray() : $result->toArray();
            // Add loop iteration index to debug_log
            if (! $desensitize && isset($resultArray['debug_log'])) {
                $resultArray['debug_log']['_loop_index'] = $tailStartIndex + $index;
            }
            $formattedResults[] = $resultArray;
        }

        return $formattedResults;
    }
}

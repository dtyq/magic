<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Speech\Facade\Open;

use App\Application\Speech\Service\SpeechToTextStandardAppService;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\ModelGateway\Facade\Open\AbstractOpenApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

class SpeechToTextStandardApi extends AbstractOpenApi
{
    #[Inject]
    protected SpeechToTextStandardAppService $speechToTextStandardAppService;

    /**
     * 提交语音识别任务
     * POST /api/v1/speech/submit.
     */
    public function submit(RequestInterface $request): array
    {
        $requestData = $request->all();

        // 参数验证
        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        // 创建DTO对象
        $submitDTO = new SpeechSubmitDTO($requestData);
        $submitDTO->setAccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());

        // 调用应用服务提交任务
        return $this->speechToTextStandardAppService->submitTask($submitDTO);
    }

    /**
     * 查询语音识别结果
     * POST /api/v1/speech/query/{taskId}.
     */
    public function query(RequestInterface $request, string $taskId)
    {
        if (empty($taskId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, '任务ID不能为空');
        }

        // 创建DTO对象
        $queryDTO = new SpeechQueryDTO(['task_id' => $taskId]);
        $queryDTO->setAccessToken($this->getAccessToken());
        $queryDTO->setIps($this->getClientIps());

        // 调用应用服务查询结果
        return $this->speechToTextStandardAppService->queryResult($queryDTO);
    }
}

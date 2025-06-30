<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Speech\Facade\Open;

use App\Application\Speech\Service\SpeechToTextStandardAppService;
use App\Domain\Speech\Entity\Dto\BigModelSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechUserDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\ModelGateway\Facade\Open\AbstractOpenApi;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

class SpeechToTextStandardApi extends AbstractOpenApi
{
    #[Inject]
    protected SpeechToTextStandardAppService $speechToTextStandardAppService;

    public function submit(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        $submitDTO = new SpeechSubmitDTO($requestData);
        $submitDTO->setaccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));
        return $this->speechToTextStandardAppService->submitTask($submitDTO);
    }

    public function query(RequestInterface $request, string $taskId)
    {
        if (empty($taskId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, '任务ID不能为空');
        }

        $queryDTO = new SpeechQueryDTO(['task_id' => $taskId]);
        $queryDTO->setaccessToken($this->getAccessToken());
        $queryDTO->setIps($this->getClientIps());
        return $this->speechToTextStandardAppService->queryResult($queryDTO);
    }

    public function submitBigModel(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        $submitDTO = new BigModelSpeechSubmitDTO($requestData);
        $submitDTO->setaccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));
        return $this->speechToTextStandardAppService->submitBigModelTask($submitDTO);
    }

    public function queryBigModel(RequestInterface $request, string $requestId)
    {
        if (empty($requestId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, '请求ID不能为空');
        }

        $speechQueryDTO = new SpeechQueryDTO(['task_id' => $requestId]);
        $speechQueryDTO->setAccessToken($this->getAccessToken());
        $speechQueryDTO->setIps($this->getClientIps());
        return $this->speechToTextStandardAppService->queryBigModelResult($speechQueryDTO);
    }
}

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
use Hyperf\Context\Context;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Http\Message\ResponseInterface;

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

        $result = $this->speechToTextStandardAppService->submitTask($submitDTO);
        return $this->setVolcengineHeaders($result);
    }

    public function query(RequestInterface $request, string $taskId)
    {
        if (empty($taskId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.task_id_required');
        }

        $queryDTO = new SpeechQueryDTO(['task_id' => $taskId]);
        $queryDTO->setaccessToken($this->getAccessToken());
        $queryDTO->setIps($this->getClientIps());

        $result = $this->speechToTextStandardAppService->queryResult($queryDTO);
        return $this->setVolcengineHeaders($result);
    }

    public function submitBigModel(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        $submitDTO = new BigModelSpeechSubmitDTO($requestData);
        $submitDTO->setAccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));

        $result = $this->speechToTextStandardAppService->submitBigModelTask($submitDTO);
        return $this->setVolcengineHeaders($result);
    }

    public function queryBigModel(RequestInterface $request, string $requestId)
    {
        if (empty($requestId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.task_id_required');
        }

        $speechQueryDTO = new SpeechQueryDTO(['task_id' => $requestId]);
        $speechQueryDTO->setAccessToken($this->getAccessToken());
        $speechQueryDTO->setIps($this->getClientIps());

        $result = $this->speechToTextStandardAppService->queryBigModelResult($speechQueryDTO);
        return $this->setVolcengineHeaders($result);
    }

    private function setVolcengineHeaders(array $result): array
    {
        $response = Context::get(ResponseInterface::class);

        if (isset($result['volcengine_log_id'])) {
            $response = $response->withHeader('X-Volcengine-Log-Id', $result['volcengine_log_id']);
            unset($result['volcengine_log_id']);
        }

        if (isset($result['volcengine_status_code'])) {
            $response = $response->withHeader('X-Volcengine-Status-Code', $result['volcengine_status_code']);
            unset($result['volcengine_status_code']);
        }

        if (isset($result['volcengine_message'])) {
            $response = $response->withHeader('X-Volcengine-Message', $result['volcengine_message']);
            unset($result['volcengine_message']);
        }

        Context::set(ResponseInterface::class, $response);
        return $result;
    }
}

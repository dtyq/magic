<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition;

use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class VolcengineStandardClient
{
    // 火山引擎录音文件识别标准版API端点
    private const SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';

    private const QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';

    protected LoggerInterface $logger;

    protected Client $httpClient;

    protected array $config;

    public function __construct()
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class);
        $this->httpClient = new Client([
            'timeout' => 30,
            'connect_timeout' => 10,
        ]);
        $this->config = $this->getVolcengineConfig();
    }

    /**
     * 提交语音识别任务
     */
    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildSubmitRequest($submitDTO);

        $this->logger->info('调用火山引擎提交语音识别任务', [
            'audio_url' => $submitDTO->getAudio()->getUrl(),
            'request_data' => $requestData,
        ]);

        try {
            $response = $this->httpClient->post(self::SUBMIT_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('火山引擎响应JSON解析失败', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, '火山引擎响应格式错误');
            }

            $this->logger->info('火山引擎语音识别任务提交成功', [
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('调用火山引擎提交任务失败', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, '调用火山引擎失败: ' . $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('调用火山引擎提交任务异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, '调用火山引擎异常: ' . $e->getMessage());
        }
    }

    /**
     * 查询语音识别结果.
     */
    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        $requestData = $this->buildQueryRequest($queryDTO);

        $this->logger->info('调用火山引擎查询语音识别结果', [
            'task_id' => $queryDTO->getTaskId(),
            'request_data' => $requestData,
        ]);

        try {
            $response = $this->httpClient->post(self::QUERY_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('火山引擎响应JSON解析失败', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, '火山引擎响应格式错误');
            }

            $this->logger->info('火山引擎语音识别结果查询成功', [
                'task_id' => $queryDTO->getTaskId(),
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('调用火山引擎查询结果失败', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, '调用火山引擎失败: ' . $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('调用火山引擎查询结果异常', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, '调用火山引擎异常: ' . $e->getMessage());
        }
    }

    /**
     * 获取火山引擎配置.
     */
    private function getVolcengineConfig(): array
    {
        $config = config('asr.volcengine', []);

        if (empty($config['app_id']) || empty($config['token']) || empty($config['cluster'])) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, '火山引擎配置不完整');
        }

        return $config;
    }

    /**
     * 组装提交请求参数.
     */
    private function buildSubmitRequest(SpeechSubmitDTO $submitDTO): array
    {
        // 获取用户传入的完整参数结构（不包含app字段）
        $userRequestData = $submitDTO->toVolcengineRequestData();

        // 内部组装app认证信息
        $requestData = [
            'app' => [
                'appid' => $this->config['app_id'],
                'token' => $this->config['token'],
                'cluster' => $this->config['cluster'],
            ],
        ];

        // 合并用户参数（user、audio、additions等）
        return array_merge($requestData, $userRequestData);
    }

    /**
     * 组装查询请求参数.
     */
    private function buildQueryRequest(SpeechQueryDTO $queryDTO): array
    {
        return [
            'appid' => $this->config['app_id'],
            'token' => $this->config['token'],
            'cluster' => $this->config['cluster'],
            'id' => $queryDTO->getTaskId(),
        ];
    }
}

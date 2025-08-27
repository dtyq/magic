<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade;

use App\Application\Chat\Event\Publish\MessageDispatchPublisher;
use App\Application\Chat\Event\Publish\MessagePushPublisher;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Chat\Service\MagicControlMessageAppService;
use App\Application\Chat\Service\MagicIntermediateMessageAppService;
use App\Domain\Chat\Annotation\VerifyStructure;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\Domain\Chat\DTO\Request\ControlRequest;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessagePriority;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Chat\Event\Seq\SeqCreatedEvent;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\Guard\WebsocketChatUserGuard;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Amqp\Producer;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Coordinator\Timer;
use Hyperf\Redis\Redis;
use Hyperf\SocketIOServer\Annotation\Event;
use Hyperf\SocketIOServer\Annotation\SocketIONamespace;
use Hyperf\SocketIOServer\BaseNamespace;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\Socket;
use Hyperf\SocketIOServer\SocketIOConfig;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\WebSocketServer\Sender;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthGuard;
use Qbhy\HyperfAuth\AuthManager;
use Throwable;

use function Hyperf\Coroutine\co;

#[SocketIONamespace('/im')]
#[ApiResponse('low_code')]
class MagicChatWebSocketApi extends BaseNamespace
{
    /**
     * @var WebsocketChatUserGuard
     */
    protected AuthGuard $userGuard;

    public function __construct(
        Sender $sender,
        SidProviderInterface $sidProvider,
        private readonly MagicChatMessageAppService $magicChatMessageAppService,
        private readonly ValidatorFactoryInterface $validatorFactory,
        private readonly StdoutLoggerInterface $logger,
        private readonly SocketIOConfig $config,
        private readonly Redis $redis,
        private readonly Timer $timer,
        private readonly AuthManager $authManager,
        private readonly MagicControlMessageAppService $magicControlMessageAppService,
        private readonly MagicIntermediateMessageAppService $magicIntermediateMessageAppService,
        private readonly TranslatorInterface $translator
    ) {
        $this->config->setPingTimeout(2000); // ping 超时
        $this->config->setPingInterval(10 * 1000); // ping间隔
        parent::__construct($sender, $sidProvider, $config);
        $this->keepSubscribeAlive();
        /* @phpstan-ignore-next-line */
        $this->userGuard = $this->authManager->guard(name: 'websocket');
    }

    #[Event('connect')]
    #[VerifyStructure]
    public function onConnect(Socket $socket)
    {
        // 链接时刷新 sid 缓存的权限信息，避免极端情况下，用了以前的 sid 权限
        $this->logger->info(sprintf('sid:%s connect', $socket->getSid()));
    }

    #[VerifyStructure]
    #[Event('login')]
    /**
     * @throws Throwable
     */
    public function onLogin(Socket $socket, array $params)
    {
        $rules = [
            'context' => 'required',
            'context.organization_code' => 'string|nullable',
        ];
        $validator = $this->validatorFactory->make($params, $rules);
        if ($validator->fails()) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
        }
        $this->setLocale($params['context']['language'] ?? '');
        try {
            // 使用 magicChatContract 校验参数
            $context = new MagicContext($params['context']);
            // 兼容历史版本,从query中获取token
            $userToken = $socket->getRequest()->getQueryParams()['authorization'] ?? '';
            $this->magicChatMessageAppService->setUserContext($userToken, $context);
            // 调用 guard 获取用户信息
            $userAuthorization = $this->getAuthorization();
            // 将账号的所有设备加入同一个房间
            $this->magicChatMessageAppService->joinRoom($userAuthorization, $socket);
            return ['type' => 'user', 'user' => [
                'magic_id' => $userAuthorization->getMagicId(),
                'user_id' => $userAuthorization->getId(),
                'status' => $userAuthorization->getStatus(),
                'nickname' => $userAuthorization->getNickname(),
                'avatar' => $userAuthorization->getAvatar(),
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'sid' => $socket->getSid(),
            ]];
        } catch (BusinessException $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            $this->logger->error('onControlMessage ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            throw $exception;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            ExceptionBuilder::throw(
                ChatErrorCode::LOGIN_FAILED,
                Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                throwable: $exception
            );
        }
    }

    #[Event('control')]
    #[VerifyStructure]
    /**
     * 控制消息.
     * @throws Throwable
     */
    public function onControlMessage(Socket $socket, array $params)
    {
        $appendRules = [
            'data.refer_message_id' => 'string',
            'data.message' => 'required|array',
            'data.message.type' => 'required|string',
            'data.message.app_message_id' => 'string',
        ];
        try {
            $this->relationAppMsgIdAndRequestId($params['data']['message']['app_message_id'] ?? '');
            $this->checkParams($appendRules, $params);
            $this->setLocale($params['context']['language'] ?? '');
            // 使用 magicChatContract 校验参数
            $controlRequest = new ControlRequest($params);
            // 兼容历史版本,从query中获取token
            $userToken = $socket->getRequest()->getQueryParams()['authorization'] ?? '';
            $this->magicChatMessageAppService->setUserContext($userToken, $controlRequest->getContext());
            // 获取用户信息
            $userAuthorization = $this->getAuthorization();
            // 根据消息类型,分发到对应的处理模块
            $messageDTO = MessageAssembler::getControlMessageDTOByRequest($controlRequest, $userAuthorization, ConversationType::User);
            return $this->magicControlMessageAppService->dispatchClientControlMessage($messageDTO, $userAuthorization);
        } catch (BusinessException $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            $this->logger->error('onControlMessage ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            throw $exception;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            ExceptionBuilder::throw(
                ChatErrorCode::OPERATION_FAILED,
                Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                throwable: $exception
            );
        }
    }

    #[Event('chat')]
    #[VerifyStructure]
    /**
     * 聊天消息.
     * @throws Throwable
     */
    public function onChatMessage(Socket $socket, array $params)
    {
        // 判断消息类型,如果是控制消息,分发到对应的处理模块
        try {
            $appendRules = [
                'data.conversation_id' => 'required|string',
                'data.refer_message_id' => 'string',
                'data.message' => 'required|array',
                'data.message.type' => 'required|string',
                'data.message.app_message_id' => 'required|string',
            ];
            $this->relationAppMsgIdAndRequestId($params['data']['message']['app_message_id'] ?? '');
            $this->checkParams($appendRules, $params);
            $this->setLocale($params['context']['language'] ?? '');
            # 使用 magicChatContract 校验参数
            $chatRequest = new ChatRequest($params);
            // 兼容历史版本,从query中获取token
            $userToken = $socket->getRequest()->getQueryParams()['authorization'] ?? '';
            $this->magicChatMessageAppService->setUserContext($userToken, $chatRequest->getContext());
            // 根据消息类型,分发到对应的处理模块
            $userAuthorization = $this->getAuthorization();
            // 将账号的所有设备加入同一个房间
            $this->magicChatMessageAppService->joinRoom($userAuthorization, $socket);
            return $this->magicChatMessageAppService->onChatMessage($chatRequest, $userAuthorization);
        } catch (BusinessException $businessException) {
            throw $businessException;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            ExceptionBuilder::throw(
                ChatErrorCode::OPERATION_FAILED,
                Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                throwable: $exception
            );
        }
    }

    #[Event('intermediate')]
    #[VerifyStructure]
    /**
     * 不存入数据库的实时消息，用于一些临时消息场景。
     * @throws Throwable
     */
    public function onIntermediateMessage(Socket $socket, array $params)
    {
        try {
            // 查看是否混淆
            $isConfusion = $params['obfuscated'] ?? false;
            if ($isConfusion) {
                $rawData = ShadowCode::unShadow($params['shadow'] ?? '');
                $params = json_decode($rawData, true);
            }

            $appendRules = [
                'data.conversation_id' => 'required|string',
                'data.refer_message_id' => 'string',
                'data.message' => 'required|array',
                'data.message.type' => 'required|string',
                'data.message.app_message_id' => 'required|string',
            ];
            $this->relationAppMsgIdAndRequestId($params['data']['message']['app_message_id'] ?? '');
            $this->checkParams($appendRules, $params);
            $this->setLocale($params['context']['language'] ?? '');
            # 使用 magicChatContract 校验参数
            $chatRequest = new ChatRequest($params);
            // 兼容历史版本,从query中获取token
            $userToken = $socket->getRequest()->getQueryParams()['authorization'] ?? '';
            $this->magicChatMessageAppService->setUserContext($userToken, $chatRequest->getContext());
            // 根据消息类型,分发到对应的处理模块
            $userAuthorization = $this->getAuthorization();
            // 将账号的所有设备加入同一个房间
            $this->magicChatMessageAppService->joinRoom($userAuthorization, $socket);
            return $this->magicIntermediateMessageAppService->dispatchClientIntermediateMessage($chatRequest, $userAuthorization);
        } catch (BusinessException $businessException) {
            throw $businessException;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            ExceptionBuilder::throw(
                ChatErrorCode::OPERATION_FAILED,
                Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                throwable: $exception
            );
        }
    }

    /**
     * @return MagicUserAuthorization
     * @throws Throwable
     */
    protected function getAuthorization(): Authenticatable
    {
        return $this->userGuard->user();
    }

    private function checkParams(array $appendRules, array $params): void
    {
        $rules = $this->magicControlMessageAppService->getCommonRules();
        $rules = array_merge($rules, $appendRules);
        $validator = $this->validatorFactory->make($params, $rules);
        if ($validator->fails()) {
            foreach ($validator->errors()->getMessages() as $key => $error) {
                ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR, 'chat.common.param_error', ['param' => $key]);
            }
        }
    }

    private function relationAppMsgIdAndRequestId(?string $appMsgId): void
    {
        // 直接用 appMsgId 作为 requestId会导致很多无效 log，难以追踪。
        $requestId = empty($appMsgId) ? (string) IdGenerator::getSnowId() : $appMsgId;
        CoContext::setRequestId($requestId);
        $this->logger->info('relationAppMsgIdAndRequestId requestId:' . $requestId . ' appMsgId: ' . $appMsgId);
    }

    /**
     * 发布订阅/多个消息分发和推送的队列保活.
     */
    private function keepSubscribeAlive(): void
    {
        // 只需要一个进程能定时发布消息,让订阅的redis链接保活即可.
        // 不把锁放在最外层,是为了防止pod频繁重启时,没有任何一个进程能够发布消息
        co(function () {
            // 每 5 秒推一次消息
            $this->timer->tick(
                5,
                function () {
                    if (! $this->redis->set('magic-im:subscribe:keepalive', '1', ['ex' => 5, 'nx'])) {
                        return;
                    }
                    SocketIOUtil::sendIntermediate(SocketEventType::Chat, 'magic-im:subscribe:keepalive', ControlMessageType::Ping->value);

                    $producer = ApplicationContext::getContainer()->get(Producer::class);
                    // 对所有队列投一条消息,以保活链接/队列
                    $messagePriorities = MessagePriority::cases();
                    foreach ($messagePriorities as $priority) {
                        $seqCreatedEvent = new SeqCreatedEvent([ControlMessageType::Ping->value]);
                        $seqCreatedEvent->setPriority($priority);
                        // 消息分发. 一条seq可能会生成多条seq
                        $messageDispatch = new MessageDispatchPublisher($seqCreatedEvent);
                        // 消息推送. 一条seq只会推送给一个用户(的多个设备)
                        $messagePush = new MessagePushPublisher($seqCreatedEvent);
                        $producer->produce($messageDispatch);
                        $producer->produce($messagePush);
                    }
                },
                'magic-im:subscribe:keepalive'
            );
        });
    }

    // 设置语言
    private function setLocale(?string $language): void
    {
        ! empty($language) && $this->translator->setLocale($language);
    }
}

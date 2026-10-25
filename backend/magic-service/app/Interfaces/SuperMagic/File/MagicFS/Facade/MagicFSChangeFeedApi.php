<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\Facade;

use App\Application\Authentication\Service\AuthSandboxAppService;
use App\Application\SuperMagic\File\Service\MagicFSChangePublisher;
use App\Application\SuperMagic\File\Service\MagicFSFileAppService;
use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\SocketIOServer\Annotation\Event;
use Hyperf\SocketIOServer\Annotation\SocketIONamespace;
use Hyperf\SocketIOServer\BaseNamespace;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\SocketIOServer\Socket;
use Hyperf\SocketIOServer\SocketIO;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Hyperf\WebSocketServer\Sender;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * MagicFS 变更推送的 Socket.IO 命名空间。
 *
 * 推送只是加速器：客户端真正的游标来自 journal（HTTP change feed），
 * 丢一条推送最多退化成一个轮询周期，所以这里所有失败都只回 subscribe_error / 记日志，
 * 绝不让异常穿出 handler 把 worker 带下去。
 */
#[SocketIONamespace('/magicfs')]
class MagicFSChangeFeedApi extends BaseNamespace
{
    public const string ERROR_INVALID_REQUEST = 'invalid_request';

    public const string ERROR_UNAUTHORIZED = 'unauthorized';

    public const string ERROR_FORBIDDEN = 'forbidden';

    public const string ERROR_NOT_FOUND = 'not_found';

    public const string ERROR_INTERNAL = 'internal_error';

    /** 命名空间名：客户端握手后进这个 nsp，服务端用它反解实例。 */
    private const string NAMESPACE_NAME = '/magicfs';

    /** 一个 root 一个 room，订阅与扇出都以它为单位。 */
    private const string ROOM_PREFIX = 'magicfs:';

    /**
     * sid => 已订阅的 root 集合。
     *
     * 命名空间实例是容器单例（Container::get() 会缓存解析结果），所以这张表在 worker 内
     * 跨事件存活，只服务于以后定向补发 revoked（权限被回收时把受影响的连接踢出 room）。
     * 它永远不参与鉴权：鉴权只认每次 subscribe 时的实时校验。
     *
     * @var array<string, array<int, true>>
     */
    private array $socketRoots = [];

    private LoggerInterface $logger;

    private int $coalesceIntervalMs;

    public function __construct(
        Sender $sender,
        SidProviderInterface $sidProvider,
        private readonly MagicFSFileAppService $magicFSFileAppService,
        private readonly AuthSandboxAppService $sandboxAuthAppService,
        ConfigInterface $config,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
        // 把服务端的合并窗口告诉客户端，让两侧对"一次推送的粒度"有同一个预期。
        $this->coalesceIntervalMs = max(0, (int) $config->get(MagicFSChangePublisher::CONFIG_COALESCE_WINDOW_MS, 25));
        parent::__construct($sender, $sidProvider);

        // 连接断开时清掉本地索引，否则 worker 会随重连次数缓慢泄漏。
        $this->on('disconnect', function (Socket $socket): void {
            unset($this->socketRoots[$socket->getSid()]);
        });
    }

    /**
     * C→S subscribe {"root_file_id":"<id>","since_revision":<int>,
     *                 "authorization":"<token>","organization_code":"<org>"}.
     *
     * 凭证**只**随载荷下发：握手请求上下文在服务端不可靠，且可能带着前一个连接
     * 主人的身份（见 authenticate()）。
     */
    #[Event('subscribe')]
    public function onSubscribe(Socket $socket, ?array $params = null): void
    {
        $rootFileId = (int) (($params ?? [])['root_file_id'] ?? 0);

        try {
            if ($rootFileId <= 0) {
                $this->replyError($socket, $rootFileId, self::ERROR_INVALID_REQUEST, 'root_file_id is required');
                return;
            }

            $authorization = $this->authenticate($params ?? []);
            $sinceRevision = max(0, (int) (($params ?? [])['since_revision'] ?? 0));

            // 沙箱 token 是 30 天有效的用户级凭证，只标识 (user, organization)，
            // 既不绑定沙箱也不绑定项目，所以每次订阅都必须重新鉴权这个 root。
            // 复用 HTTP change feed 的同一条 VIEWER 校验，两个入口不可能给出不同答案。
            // 鉴权失败时绝不 join，客户端收不到 subscribed 会自己降级到轮询。
            $head = $this->magicFSFileAppService->getFileTreeChangeFeedHead(
                $authorization,
                (string) $rootFileId,
                $sinceRevision
            );

            $socket->join(self::room($rootFileId));
            $this->socketRoots[$socket->getSid()][$rootFileId] = true;

            $socket->emit('subscribed', [
                'root_file_id' => (string) $rootFileId,
                'head_revision' => $head['head_revision'],
                'oldest_revision' => $head['oldest_revision'],
                'cursor_expired' => $head['cursor_expired'],
                'interval_ms' => $this->coalesceIntervalMs,
            ]);
        } catch (BusinessException $exception) {
            // 业务异常带稳定错误码，客户端据此区分"重新登录"和"换一轮重试"。
            $this->replyError($socket, $rootFileId, self::errorCodeFor($exception), $exception->getMessage());
        } catch (Throwable $exception) {
            $this->logger->error('magicfs subscribe failed', [
                'sid' => $socket->getSid(),
                'root_file_id' => $rootFileId,
                'exception' => $exception->getMessage(),
            ]);
            $this->replyError($socket, $rootFileId, self::ERROR_INTERNAL, 'subscribe failed');
        }
    }

    /**
     * C→S unsubscribe {"root_file_id":"<id>"}.
     */
    #[Event('unsubscribe')]
    public function onUnsubscribe(Socket $socket, ?array $params = null): void
    {
        $rootFileId = (int) (($params ?? [])['root_file_id'] ?? 0);

        try {
            if ($rootFileId <= 0) {
                return;
            }

            $socket->leave(self::room($rootFileId));

            $sid = $socket->getSid();
            unset($this->socketRoots[$sid][$rootFileId]);
            if (($this->socketRoots[$sid] ?? []) === []) {
                unset($this->socketRoots[$sid]);
            }
        } catch (Throwable $exception) {
            $this->logger->error('magicfs unsubscribe failed', [
                'sid' => $socket->getSid(),
                'root_file_id' => $rootFileId,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * 把一个变更批次扇出给该 root 的全部订阅者，供 MagicFSChangePublisher 调用。
     *
     * 名字是 publish 而不是 broadcast：BaseNamespace 通过 Emitter trait 带进来一个
     * `broadcast(bool): self` 实例方法，PHP 不允许子类把它改成 static
     * （Fatal error: Cannot make non static method ... static），所以这个静态入口只能换名。
     * 本命名空间从不使用 Emitter 的 broadcast 标记，丢失的只是一个用不到的 fluent 开关。
     *
     * 走容器解析（SocketIO::of()）而不是自己 new：命名空间实例持有适配器，
     * 只有适配器知道怎么把包投给其它 worker / 其它 pod 上的连接。
     */
    public static function publish(int $rootFileId, array $payload): void
    {
        di(SocketIO::class)
            ->of(self::NAMESPACE_NAME)
            ->to(self::room($rootFileId))
            ->emit('changes', $payload);
    }

    /**
     * 用 subscribe 载荷里的凭证重建连接级鉴权上下文，再复用 HTTP 沙箱鉴权那套服务。
     *
     * 凭证只认载荷，不认握手请求。握手请求（$socket->getRequest()）读的是协程局部的
     * PSR-7 请求，Hyperf 只在握手时把它写进上下文；实测同一个 worker 上只有第一个连接
     * 能读到自己那份，后续连接读到的是**别人的残留请求**。拿它兜底不是"多一层保险"，
     * 而是多一条按别人身份通过鉴权的路径，所以这里不给这条路径：载荷缺凭证即未授权。
     *
     * 这里自己 set 再立刻读，是可靠的：WebSocketContext 为本协程私有，且每次订阅都
     * 覆盖写，读到的必然是本次载荷的内容。
     */
    private function authenticate(array $params): MagicUserAuthorization
    {
        $token = (string) ($params['authorization'] ?? '');
        if ($token === '') {
            throw new BusinessException('magicfs subscribe requires authorization', UserErrorCode::TOKEN_NOT_FOUND->value);
        }

        WebSocketContext::set(MagicContext::class, new MagicContext([
            'authorization' => $token,
            'organization_code' => (string) ($params['organization_code'] ?? ''),
        ]));

        // WebUserGuard 只认 WebSocket 上下文里的 MagicContext，而上面刚写好，所以这次
        // 调用必然走 web guard；headers 传空数组是明确的"不按 header 兜底"。
        $authorization = $this->sandboxAuthAppService->authenticate([]);
        if (! $authorization instanceof MagicUserAuthorization) {
            throw new BusinessException('magicfs subscribe unauthorized', UserErrorCode::TOKEN_NOT_FOUND->value);
        }

        return $authorization;
    }

    private function replyError(Socket $socket, int $rootFileId, string $code, string $message): void
    {
        try {
            $socket->emit('subscribe_error', [
                'root_file_id' => (string) $rootFileId,
                'code' => $code,
                'message' => $message,
            ]);
        } catch (Throwable $exception) {
            // 连接可能已经断了：连错误回复都发不出去时只能记日志。
            $this->logger->warning('magicfs subscribe_error reply failed', [
                'root_file_id' => $rootFileId,
                'code' => $code,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private static function errorCodeFor(BusinessException $exception): string
    {
        return match ($exception->getCode()) {
            UserErrorCode::TOKEN_NOT_FOUND->value,
            UserErrorCode::ACCOUNT_ERROR->value,
            UserErrorCode::USER_NOT_EXIST->value,
            UserErrorCode::ORGANIZATION_NOT_EXIST->value,
            UserErrorCode::ORGANIZATION_NOT_AUTHORIZE->value => self::ERROR_UNAUTHORIZED,
            SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value,
            SuperAgentErrorCode::FILE_PERMISSION_DENIED->value => self::ERROR_FORBIDDEN,
            MagicFSErrorCode::FILE_NOT_FOUND->value,
            MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND->value,
            MagicFSErrorCode::PARENT_NOT_DIRECTORY->value => self::ERROR_NOT_FOUND,
            default => self::ERROR_INTERNAL,
        };
    }

    private static function room(int $rootFileId): string
    {
        return self::ROOM_PREFIX . $rootFileId;
    }
}

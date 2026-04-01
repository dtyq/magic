from agentlang.logger import get_logger

VIDEO_LOG_PREFIX = "[SM_VIDEO]"


class _MessagePrefixLogger:
    def __init__(self, logger, prefix: str):
        self._logger = logger
        self._prefix = prefix

    def _process(self, msg):
        if not isinstance(msg, str):
            msg = str(msg)

        if self._prefix and not msg.startswith(self._prefix):
            msg = f"{self._prefix} {msg}"
        return msg

    def debug(self, msg, *args, **kwargs):
        self._logger.debug(self._process(msg), *args, **kwargs)

    def info(self, msg, *args, **kwargs):
        self._logger.info(self._process(msg), *args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        self._logger.warning(self._process(msg), *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        self._logger.error(self._process(msg), *args, **kwargs)

    def exception(self, msg, *args, **kwargs):
        # 视频链路只保留错误信息，避免在业务失败场景下刷出整段调用栈。
        kwargs.pop("exc_info", None)
        kwargs.pop("exception", None)
        self._logger.error(self._process(msg), *args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        self._logger.critical(self._process(msg), *args, **kwargs)

    def bind(self, *args, **kwargs):
        return _MessagePrefixLogger(self._logger.bind(*args, **kwargs), self._prefix)

    def __getattr__(self, item):
        return getattr(self._logger, item)


def get_video_logger(name: str) -> _MessagePrefixLogger:
    return _MessagePrefixLogger(get_logger(name), VIDEO_LOG_PREFIX)

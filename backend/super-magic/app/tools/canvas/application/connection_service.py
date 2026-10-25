"""Canvas Connection 用例服务。"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from app.tools.canvas.application.commands import ConnectionCommand
from app.tools.canvas.application.results import ConnectionResultItem, ConnectionsResult
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.infrastructure.connections import ConnectionOperationLedger
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.canvas.strategies import ConnectionStrategyRegistry


class ConnectionService:
    """Canvas ConnectionService 用例服务。"""

    def __init__(self, unit_of_work: CanvasUnitOfWork, connection_strategies: ConnectionStrategyRegistry):
        """显式绑定连线用例所需的事务和连线策略。"""
        self.unit_of_work = unit_of_work
        self.connection_strategies = connection_strategies

    async def connections(self, project_path: str, items: Sequence[ConnectionCommand]) -> ConnectionsResult:
        """新增、按 ID 删除或原子替换 Connection。"""
        CanvasApplicationOperations.validate_unique_item_refs(items)
        current_item_ref: str | None = None
        def mutate(project: CanvasProject, metadata: dict[str, Any]) -> tuple[ConnectionsResult, dict[str, Any]]:
            nonlocal current_item_ref
            ledger = ConnectionOperationLedger(metadata)
            results: list[ConnectionResultItem] = []
            for item in items:
                current_item_ref = item.item_ref
                remove_ids = item.remove_connection_ids
                replace = item.replace_existing_connections
                source = item.source_element_id
                target = item.target_element_id
                if remove_ids and replace and (not source or not target):
                    raise CanvasDomainError("CONNECTION_REPLACEMENT_INVALID", "Replacement requires new source and target Elements.")
                if remove_ids and not replace and source and target:
                    raise CanvasDomainError("CONNECTION_REPLACEMENT_INVALID", "Set replace_existing_connections=true when removing old lines before adding a new one.")
                old_connections = [CanvasApplicationOperations.get_connection(project, connection_id) for connection_id in remove_ids]
                existing_old_connections = [connection for connection in old_connections if connection is not None]
                missing_ids = [connection_id for connection_id, connection in zip(remove_ids, old_connections, strict=True) if connection is None]
                existing_new = None
                if source and target:
                    existing_new = next(
                        (
                            connection
                            for connection in project.canvas.connections
                            if connection.source_element_id == source and connection.target_element_id == target
                        ),
                        None,
                    )
                if missing_ids:
                    repeated_remove = (
                        not source
                        and not target
                        and all(ledger.was_removed(connection_id) for connection_id in missing_ids)
                    )
                    repeated_replace = replace and all(
                        ledger.replacement_matches(connection_id, source, target)
                        for connection_id in missing_ids
                    )
                    if repeated_remove:
                        results.append(ConnectionResultItem(
                            item_ref=item.item_ref,
                            status="already_removed",
                            connection_id=None,
                            removed_connection_ids=tuple(remove_ids),
                            source_element_id=None,
                            target_element_id=None,
                        ))
                        continue
                    if repeated_replace and existing_new is not None:
                        results.append(ConnectionResultItem(
                            item_ref=item.item_ref,
                            status="already_replaced",
                            connection_id=existing_new.connection_id,
                            removed_connection_ids=tuple(remove_ids),
                            source_element_id=source,
                            target_element_id=target,
                        ))
                        continue
                    raise CanvasDomainError("CONNECTION_NOT_FOUND", "One or more Connection IDs do not exist.")
                if source or target:
                    if not source or not target:
                        raise CanvasDomainError("INVALID_CONNECTION", "Both source_element_id and target_element_id are required.")
                    if replace:
                        for old in existing_old_connections:
                            project.canvas.connections.remove(old)
                    connection = CanvasApplicationOperations.add_connection(self.connection_strategies, project, source, target)
                    if replace:
                        for old_id in remove_ids:
                            ledger.mark_replaced(old_id, connection.connection_id, source, target)
                    results.append(ConnectionResultItem(
                        item_ref=item.item_ref,
                        status="replaced" if replace else "added",
                        connection_id=connection.connection_id,
                        removed_connection_ids=tuple(remove_ids),
                        source_element_id=source,
                        target_element_id=target,
                    ))
                else:
                    for old in existing_old_connections:
                        project.canvas.connections.remove(old)
                    for old_id in remove_ids:
                        ledger.mark_removed(old_id)
                    results.append(ConnectionResultItem(
                        item_ref=item.item_ref,
                        status="removed",
                        connection_id=None,
                        removed_connection_ids=tuple(remove_ids),
                        source_element_id=None,
                        target_element_id=None,
                    ))
            ledger.compact()
            return ConnectionsResult(results), metadata

        try:
            return await self.unit_of_work.transaction_with_sidecar(
                project_path,
                mutate,
                filename=".canvas-connection-ledger.json",
            )
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(items), current_item_ref, error) from error

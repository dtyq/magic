import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRowPendingController } from "../../../src/hooks/use-row-pending-ids.ts";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, reject, resolve };
}

describe("row pending controller", () => {
  it("keeps loading scoped to each concurrently running row", async () => {
    const snapshots: string[][] = [];
    const controller = createRowPendingController((pendingIds) => {
      snapshots.push([...pendingIds].sort());
    });
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const firstRun = controller.run("provider-1", () => first.promise);
    const secondRun = controller.run("provider-2", () => second.promise);

    assert.deepEqual([...controller.getPendingIds()].sort(), ["provider-1", "provider-2"]);
    first.resolve("first-done");
    assert.equal(await firstRun, "first-done");
    assert.deepEqual([...controller.getPendingIds()], ["provider-2"]);
    second.resolve("second-done");
    assert.equal(await secondRun, "second-done");
    assert.deepEqual([...controller.getPendingIds()], []);
    assert.deepEqual(snapshots, [
      ["provider-1"],
      ["provider-1", "provider-2"],
      ["provider-2"],
      [],
    ]);
  });

  it("suppresses duplicate submissions for the same row", async () => {
    const controller = createRowPendingController(() => undefined);
    const deferred = createDeferred<string>();
    let duplicateTaskCalls = 0;
    const firstRun = controller.run("provider-1", () => deferred.promise);
    const duplicateResult = await controller.run("provider-1", async () => {
      duplicateTaskCalls += 1;
      return "duplicate";
    });

    assert.equal(duplicateResult, undefined);
    assert.equal(duplicateTaskCalls, 0);
    deferred.resolve("done");
    assert.equal(await firstRun, "done");
  });

  it("clears the affected row after a failed request", async () => {
    const controller = createRowPendingController(() => undefined);
    const requestError = new Error("request failed");

    await assert.rejects(
      controller.run("provider-1", async () => {
        throw requestError;
      }),
      requestError,
    );
    assert.deepEqual([...controller.getPendingIds()], []);
  });
});

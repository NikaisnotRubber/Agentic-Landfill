import { describe, expect, it } from "vitest";

import { useAsyncTask } from "../src/features/vm-master/useAsyncTask";

describe("useAsyncTask", () => {
  it("wraps successful async work with loading state", async () => {
    const task = useAsyncTask();

    const result = await task.run(async () => 42);

    expect(result).toBe(42);
    expect(task.loading.value).toBe(false);
    expect(task.error.value).toBe("");
  });

  it("stores a readable error when async work throws", async () => {
    const task = useAsyncTask();

    const result = await task.run(async () => {
      throw new Error("network down");
    }, "fallback");

    expect(result).toBeUndefined();
    expect(task.loading.value).toBe(false);
    expect(task.error.value).toBe("network down");
  });
});

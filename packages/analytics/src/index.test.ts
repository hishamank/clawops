import { describe, it } from "node:test";
import assert from "node:assert";
import { formatBucketDateUtc } from "./index.js";

describe("analytics bucket formatting", () => {
  it("uses the Monday of the current ISO week for week buckets", () => {
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-06T10:15:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-07T09:30:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-12T18:45:00Z"), "week"), "2025-01-06");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-01-13T08:00:00Z"), "week"), "2025-01-13");
  });

  it("formats hour and month buckets deterministically in UTC", () => {
    assert.strictEqual(formatBucketDateUtc(new Date("2025-02-01T12:34:56Z"), "hour"), "2025-02-01 12:00:00");
    assert.strictEqual(formatBucketDateUtc(new Date("2025-02-01T12:34:56Z"), "month"), "2025-02-01");
  });
});

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { withRequiredTransaction } from "@/lib/mongodb-transaction";
import { createSupportTicket, encryptSupportBody } from "@/lib/support/tickets";
import { readSupportActivities } from "@/lib/admin/support";
import { SupportTicket, SupportTicketActivity } from "@/models/SupportTicket";

test("support ticket creation is atomic and activity history is cursor paginated", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replica.getUri("support_management_test");
  process.env.SUPPORT_TICKET_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.SUPPORT_TICKET_ENCRYPTION_KEY_ID = "test";
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await assert.rejects(withRequiredTransaction(async session => {
      await createSupportTicket({ submissionKey: "a".repeat(64), payloadHash: "b".repeat(64), name: "Alex", email: "alex@example.invalid", category: "Other", message: "A durable support message." }, session);
      throw new Error("rollback");
    }));
    assert.equal(await SupportTicket.countDocuments(), 0);
    assert.equal(await SupportTicketActivity.countDocuments(), 0);
    const ticket = await withRequiredTransaction(session => createSupportTicket({ submissionKey: "c".repeat(64), payloadHash: "d".repeat(64), name: "Alex", email: "alex@example.invalid", category: "Other", message: "A durable support message." }, session));
    const start = Date.now() + 1_000;
    await SupportTicketActivity.insertMany(Array.from({ length: 105 }, (_, index) => ({ ticketId: ticket._id, kind: "internal_note", body: encryptSupportBody(`note ${index}`), createdAt: new Date(start + index), updatedAt: new Date(start + index) })));
    const all: Awaited<ReturnType<typeof readSupportActivities>>["activities"] = []; let page = await readSupportActivities(String(ticket._id));
    for (;;) { all.unshift(...page.activities); if (!page.older) break; page = await readSupportActivities(String(ticket._id), page.older); }
    assert.equal(all.length, 106);
    assert.equal(new Set(all.map(row => row.id)).size, 106);
    assert.ok(all.every((row, index) => index === 0 || row.createdAt >= all[index - 1].createdAt));
    await assert.rejects(readSupportActivities(String(ticket._id), "not-a-cursor"));
    assert.equal(await SupportTicket.countDocuments({ submissionKey: "c".repeat(64) }), 1);
  } finally { await mongoose.disconnect(); await replica.stop(); }
});

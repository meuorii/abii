import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { parseUsersQuery, readAccountCounts, readUserDetail, readUsersPage, UsersQueryError, UsersSearchUnavailable } from "@/lib/admin/users";
import { accountReason, usersHref } from "@/lib/admin/users-contract";
import { ordinaryRoleFilter } from "@/models/User";

test("directory input accepts only supported values and reasons are bounded", () => {
  for (const params of [{ q: ["a", "b"] }, { q: "x".repeat(101) }, { status: "other" }, { sort: "$natural" }, { cursor: ["a"] }, { "q[$ne]": "a" }]) {
    assert.throws(() => parseUsersQuery(params), UsersQueryError);
  }
  const { query } = parseUsersQuery({ q: "  Al.*  ", sort: "name-asc", status: "suspended", verification: "verified" });
  assert.equal(usersHref(query, "opaque"), "/admin/users?q=Al.*&verification=verified&status=suspended&sort=name-asc&cursor=opaque");
  assert.equal(accountReason("  Account review  "), "Account review");
  assert.equal(accountReason("  "), null);
  assert.equal(accountReason("x".repeat(501)), null);
});

test("account directory keeps ordinary roles, deterministic page boundaries, and private learning data scoped", async t => {
  const mongo = await MongoMemoryServer.create();
  try {
    process.env.MONGODB_URI = mongo.getUri("phase_five_users_fixture");
    process.env.AUTH_SECRET = "isolated-fixture-secret-for-admin-users";
    const conn = await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    const db = conn.connection.db!;
    const users = db.collection("users");
    assert.deepEqual(await readAccountCounts(), { total: 0, verified: 0, unverified: 0, suspended: 0 });
    assert.deepEqual(await readUsersPage(parseUsersQuery({}).query), { rows: [], total: 0, start: 1, previous: null, next: null });
    const joined = new Date("2026-03-01T00:00:00Z");
    const suspendedAt = new Date("2026-05-01T00:00:00Z");
    const id = () => new mongoose.Types.ObjectId();
    const selectedId = id();
    const privateFields = { passwordHash: "private-hash", settings: { studyTimezone: "private-settings" }, profileImage: "https://private.invalid/" };
    const learnerRows = Array.from({ length: 44 }, (_, index) => ({
      _id: index === 0 ? selectedId : id(), name: index === 0 ? "Al.*ice" : index % 2 ? "Aria" : "aria",
      email: `learner${index}@example.invalid`, role: "user", createdAt: joined,
      emailVerifiedAt: index % 2 === 0 ? joined : null, suspendedAt: index % 4 === 0 ? suspendedAt : null, ...privateFields,
    }));
    await users.insertMany([
      ...learnerRows,
      { _id: id(), name: "A legacy learner", email: "legacy@example.invalid", emailVerifiedAt: "not a date" },
      { _id: id(), role: "admin", name: "Excluded" },
      { _id: id(), role: "USER", name: "Excluded" },
      { _id: id(), role: ["user"], name: "Excluded" },
      { _id: id(), role: "unknown", name: "Excluded" },
    ]);
    assert.deepEqual(await readAccountCounts(), { total: 45, verified: 22, unverified: 23, suspended: 11 });
    for (const sort of ["newest", "oldest", "name-asc", "name-desc"]) {
      const { query } = parseUsersQuery({ sort });
      const first = await readUsersPage(query);
      assert.equal(first.rows.length, 20);
      assert.equal(first.total, 45);
      assert.equal(first.previous, null);
      assert.ok(first.next);
      const second = await readUsersPage(query, first.next);
      assert.equal(second.start, 21);
      assert.ok(second.previous);
      assert.ok(second.next);
      assert.deepEqual((await readUsersPage(query, second.previous)).rows, first.rows);
      const third = await readUsersPage(query, second.next);
      assert.equal(third.rows.length, 5);
      assert.equal(third.next, null);
      const all = [...first.rows, ...second.rows, ...third.rows];
      assert.equal(new Set(all.map(row => row.id)).size, 45);
      assert.ok(all.every(row => row.name !== "Excluded"));
      assert.equal(all.findIndex(row => row.name === "A legacy learner"), sort === "newest" ? 44 : sort === "name-desc" ? 44 : 0);
      assert.deepEqual(Object.keys(first.rows[0]).sort(), ["email", "id", "joinedAt", "name", "suspendedAt", "verifiedAt"]);
      await assert.rejects(readUsersPage(query, first.next + "a"), UsersQueryError);
      await assert.rejects(readUsersPage({ ...query, q: "new filter" }, first.next), UsersQueryError);
    }
    const { query } = parseUsersQuery({ q: " AL.* ", verification: "verified", status: "suspended" });
    assert.deepEqual((await readUsersPage(query)).rows.map(row => row.id), [selectedId.toHexString()]);
    assert.equal((await readUsersPage({ ...query, q: "LEARNER0@" })).total, 1);
    assert.equal((await readUsersPage({ ...query, status: "active" })).total, 0);
    assert.equal((await readUsersPage({ ...query, q: "ice" })).total, 0);

    for (const collection of ["subjects", "topics", "flashcards", "reviewrecords"]) {
      await db.collection(collection).insertMany([
        { userId: selectedId, privateText: "selected-private-content", flashcardType: "enumeration" },
        { userId: learnerRows[1]._id, privateText: "different-learner-content" },
      ]);
    }
    const quiz = id();
    await db.collection("achievementevents").insertMany([
      { userId: selectedId, kind: "quiz-completed", idempotencyKey: `quiz-completed:${quiz}` },
      { userId: selectedId, kind: "resumed-quiz-completed", idempotencyKey: `resumed-quiz-completed:${quiz}` },
      { userId: learnerRows[1]._id, kind: "quiz-completed", idempotencyKey: `quiz-completed:${id()}` },
    ]);
    const detail = await readUserDetail(selectedId.toHexString());
    assert.deepEqual(detail?.learning, { subjects: 1, topics: 1, flashcards: 1, reviews: 1, quizzes: 1 });
    assert.match(detail?.revision ?? "", /^[A-Za-z0-9_-]+$/);
    assert.doesNotMatch(JSON.stringify(detail), /private|passwordHash|sessionVersion/);
    assert.equal(await readUserDetail("primary"), null);

    for (let batch = 0; batch < 10; batch++) {
      await users.insertMany(Array.from({ length: 5000 }, (_, position) => ({
        role: "user", name: `Learner ${batch}-${position}`, createdAt: new Date(+joined + position * 1000),
        email: `large-${batch}-${position}@example.invalid`, emailVerifiedAt: position % 2 ? joined : null,
      })));
    }
    const newest = parseUsersQuery({}).query;
    await assert.rejects(readUsersPage({ ...newest, q: "learner" }), UsersSearchUnavailable);
    await users.createIndex({ createdAt: -1, _id: -1 }, { name: "admin_users_joined_id" });
    await users.createIndex({ name: 1, _id: 1 }, { name: "admin_users_name_id", collation: { locale: "en", strength: 2 } });
    const plans = await Promise.all([
      users.find(ordinaryRoleFilter).sort({ createdAt: -1, _id: -1 }).hint("admin_users_joined_id").limit(21).explain("executionStats"),
      users.find(ordinaryRoleFilter).collation({ locale: "en", strength: 2 }).sort({ name: 1, _id: 1 }).hint("admin_users_name_id").limit(21).explain("executionStats"),
    ]);
    for (const plan of plans) {
      assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /IXSCAN/);
      assert.doesNotMatch(JSON.stringify(plan.queryPlanner.winningPlan), /"stage":"SORT"/);
      assert.equal(plan.executionStats.nReturned, 21);
    }
    for (const query of [newest, parseUsersQuery({ sort: "name-asc" }).query]) {
      const first = await readUsersPage(query);
      assert.equal(first.total, 50_045);
      assert.ok(first.next);
      const second = await readUsersPage(query, first.next);
      assert.equal(second.rows.length, 20);
      assert.ok(second.previous);
      assert.ok(second.rows.every(row => !first.rows.some(prior => prior.id === row.id)));
    }
    t.diagnostic(`Candidate sort plans examined ${plans.map(plan => plan.executionStats.totalKeysExamined).join(" and ")} keys for 21 rows.`);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

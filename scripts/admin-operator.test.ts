import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { verifyOperatorStorage } from "@/lib/auth/admin-operator";
import { Admin, ADMIN_ID } from "@/models/Admin";
import { User } from "@/models/User";

test("operator rejects standalone topology", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    const database = "admin_operator_fixture";
    await mongoose.connect(mongo.getUri(database), { autoCreate: false, autoIndex: false });
    await assert.rejects(verifyOperatorStorage({ database, replicaSet: "fixture" }), /topology/);
    assert.deepEqual(await mongoose.connection.db!.listCollections().toArray(), []);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

test("the Admin model validates a fixed string ID and ordinary Users reject the legacy admin role", () => {
  assert.equal(Admin.collection.name, "admins");
  assert.equal(Admin.schema.get("autoCreate"), false);
  assert.equal(Admin.schema.get("autoIndex"), false);
  assert.deepEqual(Admin.schema.indexes(), []);
  assert.ok(new Admin({ _id: "second" }).validateSync()?.errors._id);
  assert.ok(new Admin({}).validateSync()?.errors._id);
  assert.equal(new Admin({ _id: ADMIN_ID }).validateSync()?.errors._id, undefined);
  assert.ok(new User({ role: "admin" }).validateSync()?.errors.role);
  assert.equal(new User({ role: "user" }).validateSync()?.errors.role, undefined);
});

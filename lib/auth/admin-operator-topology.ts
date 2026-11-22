import "server-only";
import { checkServerIdentity } from "node:tls";
import mongoose, { type mongo } from "mongoose";

export type OperatorTarget = {
  database: string;
  replicaSet: string;
  atlas?: {
    clusterType: "REPLICASET";
    members: readonly string[];
    checkServerIdentity: NonNullable<mongo.MongoClientOptions["checkServerIdentity"]>;
  };
};

export function atlasIdentityCheck(members: readonly string[]): NonNullable<mongo.MongoClientOptions["checkServerIdentity"]> {
  const hosts = new Set(members.map(member => member.slice(0, member.lastIndexOf(":"))));
  return (host, certificate) => {
    if (!hosts.has(host.toLowerCase())) return Error("Server is outside the approved Atlas inventory.");
    return checkServerIdentity(host, certificate);
  };
}

function isCommandLineDenied(error: unknown) {
  return error instanceof mongoose.mongo.MongoServerError && (
    error.code === 13 ||
    (error.code === 8000 && error.codeName === "AtlasError" &&
      /insufficient privileges|not authorized|not allowed|unauthorized/i.test(error.message))
  );
}

export async function verifyOperatorTopology(target: OperatorTarget) {
  const db = mongoose.connection.db;
  if (!db || !target.database || db.databaseName !== target.database ||
      ["admin", "config", "local", "test"].includes(db.databaseName)) throw Error("Unexpected database.");
  const unsupported = () => Error("Unsupported deployment topology.");
  const client = mongoose.connection.getClient();
  if (client.options.directConnection || client.options.loadBalanced) throw unsupported();
  const admin = db.admin();
  const hello = await admin.command({ hello: 1 }, { readPreference: "primary" });
  if (!target.replicaSet || hello.setName !== target.replicaSet || hello.isWritablePrimary !== true ||
      hello.msg === "isdbgrid" || hello.configsvr !== undefined || hello.isreplicaset) throw unsupported();

  const atlas = target.atlas;
  if (atlas) {
    const { options } = client;
    if (atlas.clusterType !== "REPLICASET" || options.replicaSet !== target.replicaSet ||
        options.tls !== true || options.rejectUnauthorized !== true || options.checkServerIdentity !== atlas.checkServerIdentity ||
        options.proxyHost || options.readPreference.mode !== "primary") throw unsupported();
    const members: string[] = [];
    for (const group of [hello.hosts, hello.passives ?? [], hello.arbiters ?? []]) {
      if (!Array.isArray(group) || group.some(host => typeof host !== "string")) throw unsupported();
      members.push(...group.map((host: string) => host.toLowerCase()));
    }
    const approved = new Set(atlas.members);
    if (approved.size === 0 || members.length !== approved.size || new Set(members).size !== approved.size ||
        members.some(host => !approved.has(host)) || typeof hello.me !== "string" ||
        typeof hello.primary !== "string" || hello.primary.toLowerCase() !== hello.me.toLowerCase() ||
        !approved.has(hello.me.toLowerCase()) || !Number.isSafeInteger(hello.logicalSessionTimeoutMinutes) ||
        hello.logicalSessionTimeoutMinutes <= 0) throw unsupported();
    const status = await admin.command({ connectionStatus: 1 }, { readPreference: "primary" });
    if (!Array.isArray(status.authInfo?.authenticatedUsers) || !status.authInfo.authenticatedUsers.some(
      (identity: { user?: unknown; db?: unknown } | null) =>
        typeof identity?.user === "string" && identity.user.length > 0 && typeof identity.db === "string" && identity.db.length > 0,
    )) throw unsupported();
  }

  // hello alone cannot distinguish a shard member from a non-sharded replica set.
  let options: mongo.Document;
  try {
    options = await admin.command({ getCmdLineOpts: 1 }, { readPreference: "primary" });
  } catch (error) {
    if (atlas && isCommandLineDenied(error)) return db;
    throw unsupported();
  }
  if (!options.parsed || typeof options.parsed !== "object" || Array.isArray(options.parsed) ||
      options.parsed.sharding !== undefined || !Array.isArray(options.argv) || options.argv.length === 0 ||
      options.argv.some((arg: unknown) => typeof arg !== "string" || /^--(?:shardsvr|configsvr)(?:=|$)/.test(arg))) {
    throw unsupported();
  }
  return db;
}

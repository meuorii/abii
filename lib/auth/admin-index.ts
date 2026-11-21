import "server-only";
import type { mongo } from "mongoose";
import { SINGLE_ADMIN_INDEX } from "@/models/User";

export function oneKey(value: unknown, field: string, expected: unknown) {
  return !!value && typeof value === "object" && Object.keys(value).length === 1 &&
    Object.hasOwn(value, field) && Reflect.get(value, field) === expected;
}

export function isSingleAdminIndex(index: mongo.IndexDescriptionInfo) {
  return index.name === SINGLE_ADMIN_INDEX && oneKey(index.key, "role", 1) && index.unique === true &&
    oneKey(index.partialFilterExpression, "role", "admin") && !index.buildUUID && !index.prepareUnique &&
    !index.hidden && !index.sparse && index.expireAfterSeconds === undefined &&
    (!index.collation || index.collation.locale === "simple");
}

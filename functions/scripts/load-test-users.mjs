import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const { db, createPassword, now, sha256 } = require("../src/core.js");

const mode = String(process.env.PASSPORT_LOAD_USERS_MODE || "seed").trim().toLowerCase();
const confirmed = String(process.env.PASSPORT_LOAD_CONFIRM || "").trim().toUpperCase() === "SI";
const password = String(process.env.PASSPORT_LOAD_PASSWORD || "");
const count = Math.min(500, Math.max(1, Number(process.env.PASSPORT_LOAD_USER_COUNT || 300)));
const uad = String(process.env.PASSPORT_LOAD_UAD || "Prueba de carga").trim();
const base = 990000000000;

if (!confirmed) throw new Error('Operación detenida. Define PASSPORT_LOAD_CONFIRM="SI" para confirmar el lote aislado de pruebas.');
if (!["seed", "cleanup"].includes(mode)) throw new Error('PASSPORT_LOAD_USERS_MODE debe ser "seed" o "cleanup".');
if (mode === "seed" && password.length < 12) throw new Error("PASSPORT_LOAD_PASSWORD debe tener mínimo 12 caracteres.");

async function seed() {
  const writer = db.bulkWriter();
  writer.onWriteError((error) => error.failedAttempts < 3);
  for (let index = 1; index <= count; index += 1) {
    const cedula = String(base + index);
    const id = `LOADTEST-${String(index).padStart(4, "0")}`;
    const email = `loadtest-${index}@pasaporte.invalid`;
    const user = {
      id, name: `Prueba de carga ${index}`, cedula, phone: "0000000000", email,
      cargo: "Prueba técnica", uad, avatar: "avatar:v2:2:0:1:0:", role: "USER",
      active: true, isLoadTest: true, createdAt: now(), sessionVersion: 1,
      ...createPassword(password),
    };
    writer.set(db.collection("users").doc(id), user);
    writer.set(db.collection("userKeys").doc(`cedula_${sha256(cedula)}`), { userId: id, isLoadTest: true });
    writer.set(db.collection("userKeys").doc(`email_${sha256(email)}`), { userId: id, isLoadTest: true });
  }
  await writer.close();
  return { created: count, firstCedula: String(base + 1), lastCedula: String(base + count), uad };
}

async function deleteQuery(query, writer) {
  const snapshot = await query.get();
  snapshot.docs.forEach((item) => writer.delete(item.ref));
  return snapshot.size;
}

async function cleanup() {
  const users = await db.collection("users").where("isLoadTest", "==", true).get();
  const ids = users.docs.map((item) => item.id);
  const writer = db.bulkWriter();
  writer.onWriteError((error) => error.failedAttempts < 3);
  let dependents = 0;
  for (let offset = 0; offset < ids.length; offset += 30) {
    const part = ids.slice(offset, offset + 30);
    dependents += await deleteQuery(db.collection("progress").where("userId", "in", part), writer);
    dependents += await deleteQuery(db.collection("bonus").where("userId", "in", part), writer);
    dependents += await deleteQuery(db.collection("recoveries").where("userId", "in", part), writer);
  }
  for (const item of users.docs) {
    const user = item.data();
    writer.delete(item.ref);
    writer.delete(db.collection("userKeys").doc(`cedula_${sha256(user.cedula)}`));
    writer.delete(db.collection("userKeys").doc(`email_${sha256(user.email)}`));
  }
  await writer.close();
  return { deletedUsers: users.size, deletedDependents: dependents };
}

const result = mode === "seed" ? await seed() : await cleanup();
console.log(JSON.stringify({ ok: true, mode, ...result }, null, 2));

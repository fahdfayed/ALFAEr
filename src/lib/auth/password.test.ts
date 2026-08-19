import assert from "node:assert/strict";
import { test } from "node:test";

import { checkPasswordStrength, hashPassword, verifyPassword } from "./password";

test("a hash verifies against its own password", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", hash), true);
});

test("a wrong password does not verify", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse batteries", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("the same password hashes differently every time", async () => {
  const a = await hashPassword("same password here");
  const b = await hashPassword("same password here");
  assert.notEqual(a, b, "salts must differ");
  assert.equal(await verifyPassword("same password here", a), true);
  assert.equal(await verifyPassword("same password here", b), true);
});

test("the stored form carries its algorithm and salt", async () => {
  const hash = await hashPassword("another password");
  const [algo, salt, digest] = hash.split("$");
  assert.equal(algo, "scrypt");
  assert.ok(Buffer.from(salt, "base64").length === 16);
  assert.ok(Buffer.from(digest, "base64").length === 64);
});

test("a malformed stored hash is rejected rather than throwing", async () => {
  for (const bad of ["", "nonsense", "scrypt$only-two", "bcrypt$a$b", "scrypt$a$b"]) {
    assert.equal(await verifyPassword("anything", bad), false, bad);
  }
});

test("short passwords are refused", () => {
  assert.ok(checkPasswordStrength("short")?.message);
  assert.ok(checkPasswordStrength("123456789")?.message);
  assert.equal(checkPasswordStrength("1234567890a"), null);
});

test("passwords padded with spaces are refused, because they will be mistyped", () => {
  assert.ok(checkPasswordStrength(" leadingspace")?.message);
  assert.ok(checkPasswordStrength("trailingspace ")?.message);
});

// Gate A contract smoke test: real backend JSON -> frontend zod schema safeParse.
// Run with: node --experimental-strip-types gate_a_validate.mjs
import * as S from "/Users/chechuanku/Documents/aiproject/onepage_product/frontend/src/lib/types/schemas.ts";
import fs from "node:fs";

const SC = "/private/tmp/claude-501/-Users-chechuanku-Documents-aiproject-onepage-product/e511dd73-43d3-4c4f-9c78-0b3571bde825/scratchpad";

function load(name) {
  return JSON.parse(fs.readFileSync(`${SC}/${name}`, "utf8")).data;
}

const cases = [
  ["createPveRun -> PveRunStateResponse", S.PveRunStateResponse, load("run_create.json")],
  ["encounter after clear (stones=[]) -> PveEncounterStateResponse", S.PveEncounterStateResponse, load("encounter_cleared.json")],
  ["getPveShop -> PveShopStateResponse", S.PveShopStateResponse, load("shop.json")],
  ["skip -> PveShopSkipResponse (union, next encounter branch)", S.PveShopSkipResponse, load("skip.json")],
  ["abandon -> PveRunResultResponse", S.PveRunResultResponse, load("abandon_result.json")],
];

let fail = 0;
for (const [label, schema, data] of cases) {
  const r = schema.safeParse(data);
  if (r.success) {
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    console.log(JSON.stringify(r.error.issues, null, 2));
  }
}
console.log(fail === 0 ? "\nGate A: ALL PASS" : `\nGate A: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);

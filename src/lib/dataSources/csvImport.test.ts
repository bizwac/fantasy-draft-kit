import { describe, expect, it } from "vitest";
import { applyColumnMapping, parseCsvFile } from "./csvImport";

function csvFile(text: string, name = "test.csv"): File {
  return new File([text], name, { type: "text/csv" });
}

describe("parseCsvFile — formula injection guard (spec §7b.2)", () => {
  it("prefixes a leading =, +, -, or @ with a quote so it can never execute as a formula", async () => {
    const csv = "Player,Note\n" + 'Bijan Robinson,"=cmd|\'/c calc\'!A0"\n' + "Puka Nacua,+1+1\n" + "Ja'Marr Chase,-2\n" + "CeeDee Lamb,@SUM(A1:A2)\n";
    const result = await parseCsvFile(csvFile(csv));
    expect(result.rows[0].Note).toBe("'=cmd|'/c calc'!A0");
    expect(result.rows[1].Note).toBe("'+1+1");
    expect(result.rows[2].Note).toBe("'-2");
    expect(result.rows[3].Note).toBe("'@SUM(A1:A2)");
  });

  it("leaves ordinary cells untouched", async () => {
    const csv = "Player,Note\nBijan Robinson,Great value\n";
    const result = await parseCsvFile(csvFile(csv));
    expect(result.rows[0].Note).toBe("Great value");
  });
});

describe("parseCsvFile — size and row limits", () => {
  it("rejects files over the 5MB cap without parsing them", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.csv", { type: "text/csv" });
    const result = await parseCsvFile(big);
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/too large/i);
  });

  it("truncates to MAX_ROWS and reports it rather than silently dropping data", async () => {
    const header = "Player\n";
    const rows = Array.from({ length: 3005 }, (_, i) => `Player ${i}`).join("\n");
    const result = await parseCsvFile(csvFile(header + rows));
    expect(result.rows).toHaveLength(3000);
    expect(result.errors.some((e) => /truncated/i.test(e))).toBe(true);
  });
});

describe("parseCsvFile — malformed input degrades gracefully", () => {
  it("reports parse errors instead of throwing on a mismatched-column row", async () => {
    const csv = "Player,Team,Pos\nBijan Robinson,ATL\nPuka Nacua,LAR,WR,EXTRA\n";
    const result = await parseCsvFile(csvFile(csv));
    // Should not throw; PapaParse reports the ragged rows as errors.
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("never crashes on a file that isn't really CSV", async () => {
    const result = await parseCsvFile(csvFile("\x00\x01\x02 not csv at all ￿"));
    expect(() => result).not.toThrow();
  });
});

describe("applyColumnMapping", () => {
  it("coerces numeric columns and treats invalid numbers as null, not NaN", () => {
    const rows = [{ Name: "Bijan Robinson", Pts: "312.5" }, { Name: "Bad Row", Pts: "not-a-number" }];
    const mapped = applyColumnMapping(rows, { name: "Name", projPoints: "Pts" });
    expect(mapped[0].projPoints).toBe(312.5);
    expect(mapped[1].projPoints).toBeNull();
  });

  it("skips rows with no name", () => {
    const rows = [{ Name: "", Pts: "100" }, { Name: "Real Player", Pts: "50" }];
    const mapped = applyColumnMapping(rows, { name: "Name", projPoints: "Pts" });
    expect(mapped).toHaveLength(1);
    expect(mapped[0].name).toBe("Real Player");
  });

  it("leaves unmapped optional fields null rather than throwing", () => {
    const rows = [{ Name: "Bijan Robinson" }];
    const mapped = applyColumnMapping(rows, { name: "Name" });
    expect(mapped[0]).toMatchObject({
      projPoints: null,
      contractYear: null,
      sosSeason: null,
      snapPct: null
    });
  });
});

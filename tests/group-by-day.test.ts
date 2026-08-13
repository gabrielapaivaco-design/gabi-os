import { describe, it, expect } from "vitest";
import { groupMomentsByDay } from "@/lib/moments/group-by-day";
import type { Moment } from "@/types/db";

function moment(id: string, iso: string): Moment {
  return { id, workspace_id: "w1", body: `momento ${id}`, processed: false, created_at: iso };
}

describe("groupMomentsByDay", () => {
  it("agrupa por dia local, dias do mais recente ao mais antigo e ordem cronologica dentro do dia", () => {
    const groups = groupMomentsByDay([
      moment("1", "2026-08-01T12:00:00.000Z"),
      moment("2", "2026-08-04T13:00:00.000Z"),
      moment("3", "2026-08-04T12:00:00.000Z"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].moments.map((m) => m.id)).toEqual(["3", "2"]);
    expect(groups[1].moments.map((m) => m.id)).toEqual(["1"]);
  });

  it("retorna lista vazia quando nao ha momentos", () => {
    expect(groupMomentsByDay([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { initialStatuses, saveStatusOption, removeStatusOption } from "./status-options";

describe("status customization", () => {
  it("adds an option", () => {
    const options = saveStatusOption(initialStatuses, { id: "paused", label: "Pausado", tone: "alert" });
    expect(options).toHaveLength(4);
    expect(options.at(-1)).toEqual({ id: "paused", label: "Pausado", tone: "alert" });
  });
  it("edits name and color without changing the goal reference", () => {
    const options = saveStatusOption(initialStatuses, { id: "Planejado", label: "A iniciar", tone: "neutral" });
    expect(options.find((s) => s.id === "Planejado")).toEqual({ id: "Planejado", label: "A iniciar", tone: "neutral" });
    expect(options).toHaveLength(3);
  });
  it("removes an option and reassigns goals without changing semester completion", () => {
    const projects = [{ metas: [{ status: "Planejado", semestres: [true, false] }, { status: "Concluído", semestres: [true, true] }], custos: [50] }];
    const result = removeStatusOption(initialStatuses, projects, "Planejado", "Em Andamento");
    expect(result.statuses).toHaveLength(2);
    expect(result.projetos[0]?.metas).toEqual([{ status: "Em Andamento", semestres: [true, false] }, { status: "Concluído", semestres: [true, true] }]);
    expect(result.projetos[0]?.custos).toEqual([50]);
  });
  it("rejects empty and duplicate names", () => {
    expect(() => saveStatusOption(initialStatuses, { id: "new", label: " ", tone: "planned" })).toThrow();
    expect(() => saveStatusOption(initialStatuses, { id: "new", label: "planejado", tone: "planned" })).toThrow();
  });
  it("does not leave goals without a valid status", () => {
    expect(() => removeStatusOption(initialStatuses.slice(0, 1), [], "Planejado", "")).toThrow();
    expect(() => removeStatusOption(initialStatuses, [], "Planejado", "Planejado")).toThrow();
  });
});
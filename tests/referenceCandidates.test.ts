import { describe, expect, it } from "vitest";
import {
  buildReferenceCandidates,
  ReferenceCandidateCache,
  searchReferenceCandidates,
} from "../src/core/referenceCandidates";

describe("buildReferenceCandidates", () => {
  it("risolve un indice diretto univoco e conserva le cartelle ambigue", () => {
    const candidates = buildReferenceCandidates(
      [
        { path: "Progetti/_indice-progetti.md", basename: "_indice-progetti", parentPath: "Progetti" },
        { path: "Progetti/Alpha.md", basename: "Alpha", parentPath: "Progetti" },
        { path: "A/_indice-a.md", basename: "_indice-a", parentPath: "A" },
        { path: "A/_indice-altro.md", basename: "_indice-altro", parentPath: "A" },
      ],
      [
        { path: "Progetti", name: "Progetti" },
        { path: "A", name: "A" },
      ],
    );

    expect(candidates).toEqual([
      { kind: "file", label: "Alpha", target: "Progetti/Alpha.md", path: "Progetti/Alpha.md", indexed: false },
      { kind: "file", label: "Progetti", target: "Progetti/_indice-progetti.md", path: "Progetti", indexed: true },
      { kind: "folder", label: "A", target: "A", path: "A", indexed: false },
    ]);
  });

  it("disambigua etichette duplicate con la cartella padre", () => {
    const candidates = buildReferenceCandidates(
      [
        { path: "Uno/Nota.md", basename: "Nota", parentPath: "Uno" },
        { path: "Due/Nota.md", basename: "Nota", parentPath: "Due" },
      ],
      [],
    );
    expect(candidates.map((candidate) => candidate.label)).toEqual(["Nota · Uno", "Nota · Due"]);
  });
});

describe("searchReferenceCandidates", () => {
  it("normalizza la ricerca e mette gli indici prima degli altri risultati", () => {
    const candidates = buildReferenceCandidates(
      [
        { path: "Città/_indice-citta.md", basename: "_indice-citta", parentPath: "Città" },
        { path: "Altro/Citta vecchia.md", basename: "Citta vecchia", parentPath: "Altro" },
      ],
      [{ path: "Città", name: "Città" }],
    );
    expect(searchReferenceCandidates(candidates, "citta").map((candidate) => candidate.path))
      .toEqual(["Città", "Altro/Citta vecchia.md"]);
  });
});

describe("ReferenceCandidateCache", () => {
  it("riusa il catalogo e lo ricostruisce dopo l'invalidazione", () => {
    const cache = new ReferenceCandidateCache();
    let builds = 0;
    const build = () => {
      builds += 1;
      return [{ kind: "file" as const, label: "Nota", target: "Nota.md", path: "Nota.md", indexed: false }];
    };

    expect(cache.get(build)).toBe(cache.get(build));
    expect(builds).toBe(1);
    cache.invalidate();
    cache.get(build);
    expect(builds).toBe(2);
  });
});

// usage: node dump_species.mjs <animon_root> <out.json>
const root = process.argv[2], out = process.argv[3];
const S = await import(root + '/js/data/species.js');
const M = await import(root + '/js/data/moves.js');
const T = await import(root + '/js/data/types.js');
const fs = await import('fs');
const list = S.SPECIES.filter(Boolean).map(s => ({
  id: s.id, name: s.name, types: s.types, stage: s.stage, stages: s.stages, line: s.line, bst: s.bst, rarity: s.rarity,
  legend: s.legend, starter: s.starter, gen2: s.gen2, rare: s.rare, base: s.base, desc: s.desc, plan: s.plan, hab: s.hab,
  moves: s.moves.map(m => ({ id: m.id, name: M.MOVES[m.id]?.name, type: M.MOVES[m.id]?.type, pow: M.MOVES[m.id]?.pow ?? M.MOVES[m.id]?.power })),
}));
fs.writeFileSync(out, JSON.stringify(list));
console.log(list.length, Object.keys(M.MOVES).length);
console.log(Object.entries(M.MOVES).slice(0,3));

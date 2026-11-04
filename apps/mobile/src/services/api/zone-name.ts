/**
 * Nome da zona com a referência do servidor (C2, migration 20261104120000): `name` = "Jardim Goiás 59" e `nearRef`
 * = "perto do Estádio" viram "Jardim Goiás · perto do Estádio" (sem o número, como `private.zone_display`). Sem
 * referência (servidor antigo, zona longe de marco), o nome segue como veio e a tela tira o número
 * (`zoneDisplayName`). Nome que já tem referência (demonstração) não ganha outra.
 */
export function withNearRef(name: string, nearRef: unknown): string {
  const ref = typeof nearRef === 'string' ? nearRef.trim() : '';
  if (!ref || !/^perto d/.test(ref) || ref.length > 40 || name.includes(' · ')) return name;
  const base = name.replace(/\s+\d+(?:\/\d+)?$/, '').trim();
  return base ? `${base} · ${ref}` : name;
}

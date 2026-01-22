import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";

let _db = null;

export function getDb() {
  if (_db) return _db;

  const sb = (typeof window !== 'undefined') ? window.supabase : undefined;
  if (!sb || typeof sb.createClient !== 'function') {
    throw new Error(
      "Biblioteca do Supabase não carregou. " +
      "Verifique sua internet e desative bloqueadores (AdBlock/Brave Shields/extensões) para cdn.jsdelivr.net."
    );
  }

  _db = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
  return _db;
}

export function cleanUndefined(obj) {
  const o = { ...obj };
  Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
  return o;
}

export async function upsertWithSchemaFallback(table, payload, idOrOpts = null, rules = null) {
  /**
   * Compatível com 2 assinaturas:
   * 1) upsertWithSchemaFallback(table, payload, optsObject)
   * 2) upsertWithSchemaFallback(table, payload, id, rulesObject)
   *
   * rulesObject: { colunaInexistente: (payload)=>novoPayload }
   */
  const db = getDb();

  let opts = {};
  let id = null;

  if (idOrOpts && typeof idOrOpts === 'object' && !Array.isArray(idOrOpts)) {
    // assinatura (table, payload, opts)
    opts = idOrOpts;
  } else if (idOrOpts !== null && idOrOpts !== undefined && idOrOpts !== '') {
    // assinatura (table, payload, id, rules)
    id = idOrOpts;
  }

  const applyId = (p) => {
    const out = cleanUndefined({ ...p });
    if (id !== null && id !== undefined) out.id = id;
    return out;
  };

  const tryWrite = async (p) => {
    const clean = applyId(p);

    if (clean.id !== undefined && clean.id !== null) {
      const r = await db.from(table).upsert([clean], { onConflict: 'id', ...opts }).select().maybeSingle();
      if (!r.error) return r;
      return await db.from(table).update(clean).eq('id', clean.id).select().maybeSingle();
    }

    return await db.from(table).insert([clean]).select().maybeSingle();
  };

  // 1) tenta normal
  let resp = await tryWrite(payload);
  if (!resp.error) return resp;

  // 2) fallback por schema: se erro indicar coluna inexistente, aplica rules e tenta de novo
  const maxRetries = 4;
  for (let i = 0; i < maxRetries; i++) {
    const msg = (resp.error?.message || resp.error?.details || '').toString();

    // exemplos comuns:
    // - column "documento" of relation "fornecedores" does not exist
    // - Could not find the "documento" column of "fornecedores" in the schema cache
    let col = null;
    let m =
      msg.match(/column\s+\"([^\"]+)\"/i) ||
      msg.match(/find the\s+["\']([^"\']+)["\']\s+column/i) ||
      msg.match(/Could not find the\s+["\']([^"\']+)["\']\s+column/i);

    if (m && m[1]) col = m[1];

    if (!col || !rules || typeof rules[col] !== 'function') break;

    payload = rules[col](payload);
    resp = await tryWrite(payload);
    if (!resp.error) return resp;
  }

  return resp; // quem chamou decide se lança
}


/* ==========================================================================
   CONFIGURAÇÃO SUPABASE
   ========================================================================== */
// OBS: As variáveis SUPABASE_URL e SUPABASE_KEY vêm do arquivo config.js
const _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ==========================================================================
   HELPERS
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const toast = (msg) => alert(msg);

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function safeDate(v) {
  if (!v) return '';
  const d = (typeof v === 'string' && v.length === 10) ? new Date(v + 'T00:00:00') : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('pt-BR');
}
function parseNumBR(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return 0;
  // aceita "1.234,56" e "1234.56"
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}
function closeModal(id) {
  const el = $(id);
  if (el) el.style.display = 'none';
}
function openModal(id) {
  const el = $(id);
  if (el) el.style.display = 'block';
}
function ensureOption(sel, value, label) {
  if (!sel) return;
  const val = value ?? '';
  const exists = Array.from(sel.options).some(o => o.value === val);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label ?? String(val);
    sel.appendChild(opt);
  }
}

async function supa(op) {
  // helper para padronizar erros
  const { data, error } = await op;
  if (error) throw error;
  return data;
}

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */
let state = {
  user: null,
  route: 'dashboard',

  produtos: [],
  notas: [],
  financeiro: [],
  usuarios: [],
  grupos: [],
  fornecedores: [],
  funcionarios: [],

  // Nota manual
  itensNotaManual: [],

  // Financeiro seleção
  financeiroSel: new Set(),

  // Charts
  charts: {
    despesasStatus: null,
    despesasFornecedor: null,
  }
};

/* ==========================================================================
   BACKEND
   ========================================================================== */
const Backend = {
  async login(usuario, senha) {
    const u = String(usuario || '').trim();
    const s = String(senha || '').trim();
    if (!u || !s) return { ok: false, error: { message: 'Informe usuário e senha.' } };

    try {
      const row = await supa(_db.from('usuarios').select('*').eq('usuario', u).eq('senha', s).maybeSingle());
      if (!row) return { ok: false, error: { message: 'Usuário ou senha inválidos.' } };

      // Se tiver coluna "ativo" no banco e estiver false, bloqueia
      if (Object.prototype.hasOwnProperty.call(row, 'ativo') && row.ativo === false) {
        return { ok: false, error: { message: 'Usuário desativado.' } };
      }

      // Mantém somente o necessário na sessão
      const sess = {
        id: row.id,
        nome: row.nome || row.usuario,
        usuario: row.usuario,
        perfil: row.perfil || 'Usuario',
      };
      return { ok: true, user: sess };
    } catch (err) {
      return { ok: false, error: err };
    }
  },

  // PRODUTOS
  async getProdutos() {
    const data = await supa(_db.from('produtos').select('*').order('nome', { ascending: true }));
    state.produtos = data || [];
    return state.produtos;
  },
  async salvarProduto(p) {
    if (p.id) {
      await supa(_db.from('produtos').update(p).eq('id', p.id));
    } else {
      await supa(_db.from('produtos').insert(p));
    }
    return true;
  },
  async excluirProduto(id) {
    await supa(_db.from('produtos').delete().eq('id', id));
    return true;
  },

  // NOTAS
  async getNotas() {
    // ordem: último lançado -> mais antigo (created_at desc)
    const data = await supa(_db.from('notas_entrada').select('*').order('created_at', { ascending: false }));
    state.notas = data || [];
    return state.notas;
  },
  async salvarNota(nota) {
    if (nota.id) {
      await supa(_db.from('notas_entrada').update(nota).eq('id', nota.id));
    } else {
      await supa(_db.from('notas_entrada').insert(nota));
    }
    return true;
  },
  async excluirNota(id) {
    await supa(_db.from('notas_entrada').delete().eq('id', id));
    return true;
  },

  // FINANCEIRO
  async getFinanceiro() {
    const data = await supa(_db.from('financeiro').select('*').order('data_vencimento', { ascending: false }));
    state.financeiro = data || [];
    return state.financeiro;
  },
  async salvarFinanceiro(item) {
    if (item.id) {
      await supa(_db.from('financeiro').update(item).eq('id', item.id));
    } else {
      await supa(_db.from('financeiro').insert(item));
    }
    return true;
  },
  async excluirFinanceiro(id) {
    await supa(_db.from('financeiro').delete().eq('id', id));
    return true;
  },
  async baixarFinanceiroEmLote(ids) {
    if (!ids || ids.length === 0) return true;
    await supa(_db.from('financeiro').update({ status: 'Pago' }).in('id', ids));
    return true;
  },

  // USUÁRIOS
  async getUsuarios() {
    const data = await supa(_db.from('usuarios').select('*').order('nome', { ascending: true }));
    state.usuarios = data || [];
    return state.usuarios;
  },
  async salvarUsuario(u) {
    // validações mínimas
    if (!u.nome || !u.usuario) throw new Error('Preencha Nome e Login.');
    if (!u.id && !u.senha) throw new Error('Informe a senha para novo usuário.');

    if (u.id) {
      const payload = { nome: u.nome, usuario: u.usuario, perfil: u.perfil };
      // Se usuário digitou senha para trocar
      if (u.senha) payload.senha = u.senha;
      await supa(_db.from('usuarios').update(payload).eq('id', u.id));
    } else {
      await supa(_db.from('usuarios').insert(u));
    }
    return true;
  },
  async excluirUsuario(id) {
    await supa(_db.from('usuarios').delete().eq('id', id));
    return true;
  },

  // CONFIG (GRUPOS)
  async getGrupos() {
    const row = await supa(_db.from('ajustes').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle());
    const grupos = row?.config_json?.grupos;
    state.grupos = Array.isArray(grupos) ? grupos : [];
    return state.grupos;
  },
  async saveGrupos(grupos) {
    const payload = { config_json: { grupos: grupos || [] } };
    // insere um novo snapshot (mais simples)
    await supa(_db.from('ajustes').insert(payload));
    state.grupos = grupos || [];
    return true;
  },

  // FORNECEDORES
  async getFornecedores() {
    const data = await supa(_db.from('fornecedores').select('*').order('nome', { ascending: true }));
    state.fornecedores = data || [];
    return state.fornecedores;
  },
  async salvarFornecedor(f) {
    if (!f.nome) throw new Error('Informe o nome do fornecedor.');
    if (f.id) await supa(_db.from('fornecedores').update(f).eq('id', f.id));
    else await supa(_db.from('fornecedores').insert(f));
    return true;
  },
  async excluirFornecedor(id) {
    await supa(_db.from('fornecedores').delete().eq('id', id));
    return true;
  },

  // FUNCIONÁRIOS
  async getFuncionarios() {
    const data = await supa(_db.from('funcionarios').select('*').order('nome', { ascending: true }));
    state.funcionarios = data || [];
    return state.funcionarios;
  },
  async salvarFuncionario(f) {
    if (!f.nome) throw new Error('Informe o nome do funcionário.');
    if (f.id) await supa(_db.from('funcionarios').update(f).eq('id', f.id));
    else await supa(_db.from('funcionarios').insert(f));
    return true;
  },
  async excluirFuncionario(id) {
    await supa(_db.from('funcionarios').delete().eq('id', id));
    return true;
  }
};

/* ==========================================================================
   UI - RENDER
   ========================================================================== */
function setTitulo(modulo) {
  const map = {
    dashboard: 'VISÃO GERAL',
    produtos: 'PRODUTOS & ESTOQUE',
    notas_entrada: 'NOTAS DE ENTRADA',
    financeiro: 'FINANCEIRO',
    relatorios: 'RELATÓRIOS',
    fornecedores: 'FORNECEDORES',
    funcionarios: 'FUNCIONÁRIOS',
    usuarios: 'USUÁRIOS',
    configuracoes: 'CONFIGURAÇÕES'
  };
  const t = map[modulo] || String(modulo || '').toUpperCase();
  if ($('titulo-secao')) $('titulo-secao').innerText = t;
}

async function navegar(modulo) {
  state.route = modulo;
  setTitulo(modulo);

  document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('ativo'));
  const activeLi = document.querySelector(`[data-route="${modulo}"]`);
  if (activeLi) activeLi.classList.add('ativo');

  const views = [
    'view-padrao','view-produtos','view-notas-entrada','view-financeiro',
    'view-relatorios','view-fornecedores','view-funcionarios',
    'view-usuarios','view-configuracoes'
  ];
  views.forEach(v => { const el = $(v); if (el) el.style.display = 'none'; });

  if (modulo === 'dashboard') {
    $('view-padrao').style.display = 'block';
  }

  if (modulo === 'produtos') {
    $('view-produtos').style.display = 'block';
    await Backend.getGrupos();
    await Backend.getProdutos();
    renderProdutos();
    updateGrupoSelects();
  }

  if (modulo === 'notas_entrada') {
    $('view-notas-entrada').style.display = 'block';
    await Backend.getNotas();
    renderNotas();
  }

  if (modulo === 'financeiro') {
    $('view-financeiro').style.display = 'block';
    injetarControlesFinanceiros();
    await Backend.getFinanceiro();
    renderFinanceiro();
  }

  if (modulo === 'relatorios') {
    $('view-relatorios').style.display = 'block';
    await prepararRelatorios();
    renderRelatorios();
  }

  if (modulo === 'fornecedores') {
    $('view-fornecedores').style.display = 'block';
    await Backend.getFornecedores();
    renderFornecedores();
    atualizarSelectFornecedores(); // mantém selects atualizados
  }

  if (modulo === 'funcionarios') {
    $('view-funcionarios').style.display = 'block';
    await Backend.getFuncionarios();
    renderFuncionarios();
  }

  if (modulo === 'usuarios') {
    $('view-usuarios').style.display = 'block';
    await Backend.getUsuarios();
    renderUsuarios();
  }

  if (modulo === 'configuracoes') {
    $('view-configuracoes').style.display = 'block';
    await Backend.getGrupos();
    renderGrupos();
    updateGrupoSelects();
  }
}

/* =========================
   PRODUTOS
   ========================= */
function updateGrupoSelects() {
  const opts = (state.grupos || []).map(g => `<option value="${g}">${g}</option>`).join('');
  const selProd = $('prod_grupo');
  if (selProd) selProd.innerHTML = `<option value="">Selecione...</option>` + opts;

  const selFiltro = $('filtro-grupo');
  if (selFiltro) selFiltro.innerHTML = `<option value="">Todos Grupos</option>` + opts;
}

function renderProdutos() {
  const tbody = $('tabela-produtos-corpo');
  if (!tbody) return;

  const termo = String($('barra-pesquisa-produtos')?.value || '').toLowerCase().trim();
  const grp = String($('filtro-grupo')?.value || '').trim();

  const lista = (state.produtos || []).filter(p => {
    const okBusca = !termo || (String(p.nome||'').toLowerCase().includes(termo) || String(p.codigo||'').toLowerCase().includes(termo));
    const okGrp = !grp || String(p.grupo||'') === grp;
    return okBusca && okGrp;
  });

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><b>${p.codigo || ''}</b></td>
      <td>${p.nome || ''}</td>
      <td>${p.grupo || '-'}</td>
      <td><b>${p.qtd ?? 0}</b></td>
      <td>${money(p.preco)}</td>
      <td>
        <button class="btn-action" onclick="editProduto('${p.id}')">Editar</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delProduto('${p.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="text-align:center;color:#999;">Sem produtos</td></tr>`;
}

window.editProduto = (id) => {
  const p = (state.produtos || []).find(x => x.id === id);
  if (!p) return;
  $('prod_id_edit').value = p.id;
  $('prod_codigo').value = p.codigo || '';
  $('prod_nome').value = p.nome || '';
  $('prod_grupo').value = p.grupo || '';
  $('prod_qtd').value = p.qtd ?? 0;
  $('prod_preco').value = p.preco ?? 0;
  openModal('modal-produto');
};
window.delProduto = async (id) => {
  if (!confirm('Excluir produto?')) return;
  try {
    await Backend.excluirProduto(id);
    await Backend.getProdutos();
    renderProdutos();
  } catch (e) {
    toast('Erro ao excluir: ' + (e.message || e));
  }
};

/* =========================
   NOTAS DE ENTRADA
   ========================= */
function renderNotas() {
  const tbody = $('tabela-notas-corpo');
  if (!tbody) return;

  // ordem último lançado -> mais antigo (created_at desc)
  const lista = (state.notas || []).slice().sort((a,b) => {
    const da = new Date(a.created_at || a.data || 0).getTime();
    const db = new Date(b.created_at || b.data || 0).getTime();
    return db - da;
  });

  tbody.innerHTML = lista.map(n => `
    <tr>
      <td>${safeDate(n.data)}</td>
      <td>${n.numero || '-'}</td>
      <td>${n.fornecedor || '-'}</td>
      <td>${n.qtd_itens || 0}</td>
      <td><b style="color:#27ae60">${money(n.valor)}</b></td>
      <td><small>${n.tipo || 'Manual'}</small></td>
      <td>
        <button class="btn-action" onclick="verNota('${n.id}')">Ver</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delNota('${n.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="7" style="text-align:center;color:#999;">Sem notas</td></tr>`;
}

window.verNota = (id) => {
  const n = (state.notas || []).find(x => x.id === id);
  if (!n) return;
  // abre o modal e preenche (somente leitura simples)
  $('nota_id_edicao').value = n.id;
  $('nota_is_edit').value = '1';
  $('nota_numero').value = n.numero || '';
  $('nota_data').value = (n.data || '').slice ? String(n.data).slice(0,10) : '';
  // fornecedor select: garantir opção antiga
  atualizarSelectFornecedores(n.fornecedor || '');
  $('nota_fornecedor').value = n.fornecedor || '';
  state.itensNotaManual = Array.isArray(n.itens_json) ? n.itens_json : (typeof n.itens_json === 'string' ? JSON.parse(n.itens_json || '[]') : []);
  renderItensNotaManual();
  $('titulo-modal-nota').innerText = 'Ver / Editar Nota';
  openModal('modal-nota-manual');
};

window.delNota = async (id) => {
  if (!confirm('Excluir nota?')) return;
  try {
    await Backend.excluirNota(id);
    await Backend.getNotas();
    renderNotas();
  } catch(e) {
    toast('Erro ao excluir nota: ' + (e.message || e));
  }
};

function renderItensNotaManual() {
  const tbody = $('tabela-itens-nota-manual');
  if (!tbody) return;
  const itens = state.itensNotaManual || [];
  tbody.innerHTML = itens.map((it, idx) => `
    <tr>
      <td><b>${it.codigo || ''}</b></td>
      <td>${it.nome || ''}</td>
      <td>${it.qtd ?? 0}</td>
      <td>${money(it.preco)}</td>
      <td>${money((Number(it.qtd||0) * Number(it.preco||0)))}</td>
      <td><button class="btn-action" style="background:#e74c3c" onclick="remItemNota(${idx})">Remover</button></td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="text-align:center;color:#999;">Sem itens</td></tr>`;

  // totais
  const total = itens.reduce((acc, it) => acc + (Number(it.qtd||0) * Number(it.preco||0)), 0);
  if ($('nota_total')) $('nota_total').innerText = money(total);
}

window.remItemNota = (idx) => {
  state.itensNotaManual.splice(idx, 1);
  renderItensNotaManual();
};

function setupSugestoesProdutoNota() {
  const inputBusca = $('input-item-busca');
  const ul = $('lista-sugestoes-manual');
  if (!inputBusca || !ul) return;

  inputBusca.oninput = () => {
    const termo = String(inputBusca.value || '').toLowerCase().trim();
    if (!termo) { ul.innerHTML = ''; ul.style.display = 'none'; return; }
    const matches = (state.produtos || []).filter(p => String(p.nome||'').toLowerCase().includes(termo) || String(p.codigo||'').toLowerCase().includes(termo)).slice(0, 10);
    ul.innerHTML = matches.map(p => `<li data-codigo="${p.codigo}" data-nome="${p.nome}">${p.codigo} - ${p.nome}</li>`).join('');
    ul.style.display = matches.length ? 'block' : 'none';
  };

  ul.onclick = (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    $('input-item-codigo').value = li.dataset.codigo || '';
    $('input-item-busca').value = li.dataset.nome || '';
    ul.innerHTML = '';
    ul.style.display = 'none';
  };
}

/* =========================
   FINANCEIRO
   ========================= */
function injetarControlesFinanceiros() {
  // cria botão baixa em lote se não existir
  const bar = document.querySelector('#view-financeiro .toolbar');
  if (!bar) return;
  if (!$('#btnBaixarSelecionados')) {
    const btn = document.createElement('button');
    btn.id = 'btnBaixarSelecionados';
    btn.className = 'btn-action btn-add';
    btn.style.background = '#27ae60';
    btn.innerHTML = '<span class="material-icons">done_all</span> Dar Baixa (Selecionados)';
    btn.style.display = 'none';
    btn.onclick = async () => {
      const ids = Array.from(state.financeiroSel);
      if (ids.length === 0) return;
      if (!confirm(`Dar baixa em ${ids.length} lançamento(s)?`)) return;
      try {
        await Backend.baixarFinanceiroEmLote(ids);
        state.financeiroSel.clear();
        await Backend.getFinanceiro();
        renderFinanceiro();
      } catch (e) {
        toast('Erro ao dar baixa: ' + (e.message || e));
      }
    };
    bar.insertBefore(btn, bar.children[1] || null); // entre "Lançar Manual" e "PDF"
  }
}

function renderFinanceiro() {
  const tbody = $('tabela-financeiro-corpo');
  if (!tbody) return;

  const termo = String($('barra-pesquisa-financeiro')?.value || '').toLowerCase().trim();
  const lista = (state.financeiro || []).filter(f => {
    const blob = `${f.descricao||''} ${f.fornecedor||''} ${f.tipo||''} ${f.status||''}`.toLowerCase();
    return !termo || blob.includes(termo);
  });

  // totais
  let receitas = 0, despesas = 0;
  lista.forEach(i => {
    const v = Number(i.valor || 0);
    if (i.tipo === 'Receita') receitas += v; else despesas += v;
  });
  if ($('fin-total-receitas')) $('fin-total-receitas').innerText = money(receitas);
  if ($('fin-total-despesas')) $('fin-total-despesas').innerText = money(despesas);
  if ($('fin-total-saldo')) $('fin-total-saldo').innerText = money(receitas - despesas);

  tbody.innerHTML = lista.map(i => {
    const checked = state.financeiroSel.has(i.id) ? 'checked' : '';
    const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
    return `<tr>
      <td style="width:36px;text-align:center">
        <input type="checkbox" class="fin-check" data-id="${i.id}" ${checked}>
      </td>
      <td>${safeDate(i.data_vencimento)}</td>
      <td>${i.descricao || ''}<br><small>${i.fornecedor || ''}</small></td>
      <td><span style="color:${cor}">${i.tipo}</span></td>
      <td style="color:${cor}"><b>${money(i.valor)}</b></td>
      <td>${i.status || ''}</td>
      <td>
        <button class="btn-action" onclick="editFin('${i.id}')">Editar</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delFin('${i.id}')">Excluir</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:#999;">Sem lançamentos</td></tr>`;

  // listeners
  document.querySelectorAll('.fin-check').forEach(ch => {
    ch.onchange = () => {
      const id = ch.dataset.id;
      if (ch.checked) state.financeiroSel.add(id);
      else state.financeiroSel.delete(id);
      const btn = $('#btnBaixarSelecionados');
      if (btn) btn.style.display = state.financeiroSel.size ? 'inline-flex' : 'none';
    };
  });

  const btn = $('#btnBaixarSelecionados');
  if (btn) btn.style.display = state.financeiroSel.size ? 'inline-flex' : 'none';
}

window.editFin = (id) => {
  const i = (state.financeiro || []).find(x => x.id === id);
  if (!i) return;

  $('fin_man_id').value = i.id;
  $('fin_man_descricao').value = i.descricao || '';
  atualizarSelectFornecedores(i.fornecedor || '');
  $('fin_man_fornecedor').value = i.fornecedor || '';
  $('fin_man_valor').value = i.valor ?? 0;
  $('fin_man_status').value = i.status || 'Pendente';
  $('fin_man_venc').value = (i.data_vencimento || '').slice ? String(i.data_vencimento).slice(0,10) : '';
  openModal('modal-nova-despesa');

  // tipo
  setTipoFinanceiro(i.tipo || 'Despesa');
};

window.delFin = async (id) => {
  if (!confirm('Excluir lançamento?')) return;
  try {
    await Backend.excluirFinanceiro(id);
    await Backend.getFinanceiro();
    renderFinanceiro();
  } catch (e) {
    toast('Erro ao excluir: ' + (e.message || e));
  }
};

function setTipoFinanceiro(tipo) {
  state.tipoFinanceiro = (tipo === 'Receita') ? 'Receita' : 'Despesa';
  const d = $('opt-despesa');
  const r = $('opt-receita');
  if (d && r) {
    d.classList.toggle('selected', state.tipoFinanceiro === 'Despesa');
    r.classList.toggle('selected', state.tipoFinanceiro === 'Receita');
  }
}

/* =========================
   USUÁRIOS
   ========================= */
function renderUsuarios() {
  const tbody = $('tabela-usuarios-corpo');
  if (!tbody) return;
  tbody.innerHTML = (state.usuarios || []).map(u => `
    <tr>
      <td>${u.nome || ''}</td>
      <td><b>${u.usuario || ''}</b></td>
      <td>${u.perfil || ''}</td>
      <td>
        <button class="btn-action" onclick="editUser('${u.id}')">Editar</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delUser('${u.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="text-align:center;color:#999;">Sem usuários</td></tr>`;
}
window.editUser = (id) => {
  const u = (state.usuarios || []).find(x => x.id === id);
  if (!u) return;
  $('usuario_id_edit').value = u.id;
  $('user_nome').value = u.nome || '';
  $('user_login').value = u.usuario || '';
  $('user_perfil').value = u.perfil || 'Usuario';
  $('user_senha').value = ''; // vazio = não troca
  openModal('modal-usuario');
};
window.delUser = async (id) => {
  if (!confirm('Excluir usuário?')) return;
  try {
    await Backend.excluirUsuario(id);
    await Backend.getUsuarios();
    renderUsuarios();
  } catch (e) {
    toast('Erro: ' + (e.message || e));
  }
};

/* =========================
   CONFIG - GRUPOS
   ========================= */
function renderGrupos() {
  const tbody = $('tabela-config-grupos');
  if (!tbody) return;
  tbody.innerHTML = (state.grupos || []).map(g => `
    <tr>
      <td>${g}</td>
      <td><button class="btn-action" style="background:#e74c3c" onclick="delGrupo('${encodeURIComponent(g)}')">Excluir</button></td>
    </tr>
  `).join('') || `<tr><td colspan="2" style="text-align:center;color:#999;">Sem grupos</td></tr>`;
}
window.delGrupo = async (gEnc) => {
  const g = decodeURIComponent(gEnc);
  if (!confirm(`Excluir grupo "${g}"?`)) return;
  try {
    state.grupos = (state.grupos || []).filter(x => x !== g);
    await Backend.saveGrupos(state.grupos);
    renderGrupos();
    updateGrupoSelects();
  } catch (e) {
    toast('Erro: ' + (e.message || e));
  }
};

/* =========================
   FORNECEDORES
   ========================= */
function renderFornecedores() {
  const tbody = $('tabela-fornecedores-corpo');
  if (!tbody) return;

  const termo = String($('busca-fornecedores')?.value || '').toLowerCase().trim();
  const filtro = $('filtro-fornecedores-ativo')?.value || 'todos';

  const lista = (state.fornecedores || []).filter(f => {
    const okBusca = !termo || String(f.nome||'').toLowerCase().includes(termo);
    const okAtivo = (filtro === 'todos') || (filtro === 'ativos' && f.ativo !== false) || (filtro === 'inativos' && f.ativo === false);
    return okBusca && okAtivo;
  });

  tbody.innerHTML = lista.map(f => `
    <tr>
      <td>${f.nome || ''}</td>
      <td><small>${f.telefone || ''} ${f.email ? ' • ' + f.email : ''}</small></td>
      <td><b style="color:${f.ativo === false ? '#e74c3c' : '#27ae60'}">${f.ativo === false ? 'Inativo' : 'Ativo'}</b></td>
      <td>
        <button class="btn-action" onclick="editFornecedor('${f.id}')">Editar</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delFornecedor('${f.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="text-align:center;color:#999;">Sem fornecedores</td></tr>`;
}

window.editFornecedor = (id) => {
  const f = (state.fornecedores || []).find(x => x.id === id);
  if (!f) return;
  $('forn_id_edit').value = f.id;
  $('forn_nome').value = f.nome || '';
  $('forn_cnpj').value = f.cnpj_cpf || '';
  $('forn_tel').value = f.telefone || '';
  $('forn_email').value = f.email || '';
  $('forn_endereco').value = f.endereco || '';
  $('forn_cidade').value = f.cidade || '';
  $('forn_uf').value = f.uf || '';
  $('forn_obs').value = f.observacoes || '';
  $('forn_ativo').value = (f.ativo === false) ? 'false' : 'true';
  openModal('modal-fornecedor');
};

window.delFornecedor = async (id) => {
  if (!confirm('Excluir fornecedor?')) return;
  try {
    await Backend.excluirFornecedor(id);
    await Backend.getFornecedores();
    renderFornecedores();
    atualizarSelectFornecedores();
  } catch (e) {
    toast('Erro: ' + (e.message || e));
  }
};

/* =========================
   FUNCIONÁRIOS
   ========================= */
function renderFuncionarios() {
  const tbody = $('tabela-funcionarios-corpo');
  if (!tbody) return;

  const termo = String($('busca-funcionarios')?.value || '').toLowerCase().trim();
  const filtro = $('filtro-funcionarios-ativo')?.value || 'todos';

  const lista = (state.funcionarios || []).filter(f => {
    const blob = `${f.nome||''} ${f.cargo||''}`.toLowerCase();
    const okBusca = !termo || blob.includes(termo);
    const okAtivo = (filtro === 'todos') || (filtro === 'ativos' && f.ativo !== false) || (filtro === 'inativos' && f.ativo === false);
    return okBusca && okAtivo;
  });

  tbody.innerHTML = lista.map(f => `
    <tr>
      <td>${f.nome || ''}</td>
      <td>${f.cargo || '-'}</td>
      <td><small>${f.telefone || ''} ${f.email ? ' • ' + f.email : ''}</small></td>
      <td><b style="color:${f.ativo === false ? '#e74c3c' : '#27ae60'}">${f.ativo === false ? 'Inativo' : 'Ativo'}</b></td>
      <td>
        <button class="btn-action" onclick="editFuncionario('${f.id}')">Editar</button>
        <button class="btn-action" style="background:#e74c3c" onclick="delFuncionario('${f.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align:center;color:#999;">Sem funcionários</td></tr>`;
}

window.editFuncionario = (id) => {
  const f = (state.funcionarios || []).find(x => x.id === id);
  if (!f) return;
  $('func_id_edit').value = f.id;
  $('func_nome').value = f.nome || '';
  $('func_cargo').value = f.cargo || '';
  $('func_tel').value = f.telefone || '';
  $('func_email').value = f.email || '';
  $('func_salario').value = f.salario ?? '';
  $('func_admissao').value = (f.data_admissao || '').slice ? String(f.data_admissao).slice(0,10) : '';
  $('func_obs').value = f.observacoes || '';
  $('func_ativo').value = (f.ativo === false) ? 'false' : 'true';
  openModal('modal-funcionario');
};

window.delFuncionario = async (id) => {
  if (!confirm('Excluir funcionário?')) return;
  try {
    await Backend.excluirFuncionario(id);
    await Backend.getFuncionarios();
    renderFuncionarios();
  } catch (e) {
    toast('Erro: ' + (e.message || e));
  }
};

/* =========================
   FORNECEDOR SELECT (NOTAS/FINANCEIRO)
   ========================= */
async function atualizarSelectFornecedores(garantirValor) {
  // carrega fornecedores se ainda não carregou
  if (!state.fornecedores || state.fornecedores.length === 0) {
    try { await Backend.getFornecedores(); } catch(_) {}
  }

  const ativos = (state.fornecedores || []).filter(f => f.ativo !== false);
  const baseOpts = ativos.map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');

  const montar = (sel) => {
    if (!sel) return;
    sel.innerHTML = `<option value="">Selecione...</option>` + baseOpts;
    if (garantirValor) ensureOption(sel, garantirValor, `${garantirValor} (Antigo)`);
  };

  montar($('nota_fornecedor'));
  montar($('fin_man_fornecedor'));

  // Filtro do relatório
  const relSel = $('rel_fornecedor');
  if (relSel) {
    relSel.innerHTML = `<option value="">Fornecedor: Todos</option>` + (ativos.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''));
  }
}

/* =========================
   RELATÓRIOS + GRÁFICOS
   ========================= */
async function prepararRelatorios() {
  // dados necessários
  await Backend.getProdutos();
  await Backend.getFinanceiro();
  await Backend.getNotas();
  await Backend.getFornecedores();

  // selects mês/ano
  const selMes = $('rel_mes');
  const selAno = $('rel_ano');
  if (selMes && selMes.options.length === 0) {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    selMes.innerHTML = meses.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
    selMes.value = String(new Date().getMonth() + 1);
  }
  if (selAno && selAno.options.length === 0) {
    const anoAtual = new Date().getFullYear();
    const anos = [];
    for (let a = anoAtual - 4; a <= anoAtual + 1; a++) anos.push(a);
    selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
    selAno.value = String(anoAtual);
  }

  await atualizarSelectFornecedores('');

  // tipo/status defaults
  if ($('rel_tipo')) $('rel_tipo').value = $('rel_tipo').value || 'todos';
  if ($('rel_status')) $('rel_status').value = $('rel_status').value || 'todos';
}

function setRelatoriosVisibilidade(tipo) {
  const t = tipo || 'todos';
  const show = (id, ok) => { const el = $(id); if (el) el.style.display = ok ? 'block' : 'none'; };
  show('rel-bloco-resumo', t === 'todos' || t === 'resumo');
  show('rel-bloco-financeiro', t === 'todos' || t === 'financeiro');
  show('rel-bloco-notas', t === 'todos' || t === 'notas');
  show('rel-bloco-estoque', t === 'todos' || t === 'estoque');
}

function drawCharts(despesasPeriodo) {
  // despesasStatus: Pago vs Pendente (somente despesas)
  const ctx1 = document.getElementById('chart-despesas-status');
  const ctx2 = document.getElementById('chart-despesas-fornecedor');

  const pago = despesasPeriodo.filter(x => x.status === 'Pago').reduce((a,b) => a + Number(b.valor||0), 0);
  const pend = despesasPeriodo.filter(x => x.status !== 'Pago').reduce((a,b) => a + Number(b.valor||0), 0);

  if (state.charts.despesasStatus) state.charts.despesasStatus.destroy();
  if (ctx1) {
    state.charts.despesasStatus = new Chart(ctx1, {
      type: 'doughnut',
      data: { labels: ['Pago', 'Pendente'], datasets: [{ data: [pago, pend] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // despesas por fornecedor (top 10)
  const map = new Map();
  despesasPeriodo.forEach(x => {
    const k = x.fornecedor || 'Sem fornecedor';
    map.set(k, (map.get(k) || 0) + Number(x.valor||0));
  });
  const top = Array.from(map.entries()).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const labels = top.map(t => t[0]);
  const vals = top.map(t => t[1]);

  if (state.charts.despesasFornecedor) state.charts.despesasFornecedor.destroy();
  if (ctx2) {
    state.charts.despesasFornecedor = new Chart(ctx2, {
      type: 'bar',
      data: { labels, datasets: [{ data: vals }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } }
    });
  }
}

function renderRelatorios() {
  const mes = parseInt($('rel_mes')?.value || (new Date().getMonth()+1), 10);
  const ano = parseInt($('rel_ano')?.value || new Date().getFullYear(), 10);
  const tipo = $('rel_tipo')?.value || 'todos';
  const status = $('rel_status')?.value || 'todos';
  const fornecedor = $('rel_fornecedor')?.value || '';

  setRelatoriosVisibilidade(tipo);

  const inicio = new Date(ano, mes-1, 1);
  const fim = new Date(ano, mes, 1);

  const finPeriodo = (state.financeiro || []).filter(f => {
    const d = new Date((f.data_vencimento || '').slice ? String(f.data_vencimento).slice(0,10) + 'T00:00:00' : f.data_vencimento);
    return d >= inicio && d < fim;
  }).filter(f => {
    const okStatus = (status === 'todos') || (f.status === status);
    const okForn = (!fornecedor) || (String(f.fornecedor||'') === fornecedor);
    return okStatus && okForn;
  });

  const notasPeriodo = (state.notas || []).filter(n => {
    const d = new Date((n.data || '').slice ? String(n.data).slice(0,10) + 'T00:00:00' : n.data);
    return d >= inicio && d < fim;
  }).filter(n => {
    const okForn = (!fornecedor) || (String(n.fornecedor||'') === fornecedor);
    return okForn;
  });

  // Totais financeiro
  let receitas = 0, despesas = 0;
  finPeriodo.forEach(i => {
    const v = Number(i.valor || 0);
    if (i.tipo === 'Receita') receitas += v; else despesas += v;
  });

  // Estoque
  let qtdEstoque = 0, valorEstoque = 0;
  (state.produtos || []).forEach(p => {
    const q = Number(p.qtd || 0);
    const pr = Number(p.preco || 0);
    qtdEstoque += q;
    valorEstoque += q * pr;
  });

  // Cards
  if ($('rel-receitas')) $('rel-receitas').innerText = money(receitas);
  if ($('rel-despesas')) $('rel-despesas').innerText = money(despesas);
  if ($('rel-saldo')) $('rel-saldo').innerText = money(receitas - despesas);
  if ($('rel-estoque-qtd')) $('rel-estoque-qtd').innerText = String(qtdEstoque);
  if ($('rel-estoque-valor')) $('rel-estoque-valor').innerText = money(valorEstoque);
  if ($('rel-notas')) $('rel-notas').innerText = String(notasPeriodo.length);

  // Tabela financeiro
  const corpoFin = $('rel-financeiro-corpo');
  if (corpoFin) {
    corpoFin.innerHTML = finPeriodo
      .slice()
      .sort((a,b) => new Date(b.data_vencimento||0) - new Date(a.data_vencimento||0))
      .slice(0, 300)
      .map(i => {
        const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
        return `<tr>
          <td>${safeDate(i.data_vencimento)}</td>
          <td>${i.descricao || ''}<br><small>${i.fornecedor || ''}</small></td>
          <td><span style="color:${cor}">${i.tipo}</span></td>
          <td style="color:${cor}"><b>${money(i.valor)}</b></td>
          <td>${i.status || ''}</td>
        </tr>`;
      }).join('') || `<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum lançamento no período</td></tr>`;
  }

  // Tabela notas
  const corpoNotas = $('rel-notas-corpo');
  if (corpoNotas) {
    corpoNotas.innerHTML = notasPeriodo
      .slice()
      .sort((a,b) => new Date(b.created_at||b.data||0) - new Date(a.created_at||a.data||0))
      .slice(0, 300)
      .map(n => `<tr>
        <td>${safeDate(n.data)}</td>
        <td>${n.numero || '-'}</td>
        <td>${n.fornecedor || '-'}</td>
        <td>${n.qtd_itens || 0}</td>
        <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo || 'Manual'}</small></td>
      </tr>`).join('') || `<tr><td colspan="6" style="text-align:center; color:#999;">Nenhuma nota no período</td></tr>`;
  }

  // Baixo estoque
  const corpoBaixo = $('rel-baixo-estoque-corpo');
  if (corpoBaixo) {
    const low = (state.produtos || []).slice().sort((a,b) => Number(a.qtd||0) - Number(b.qtd||0)).slice(0, 15);
    corpoBaixo.innerHTML = low.map(p => `<tr>
      <td><b>${p.codigo || ''}</b></td>
      <td>${p.nome || ''}</td>
      <td>${p.grupo || '-'}</td>
      <td><b>${p.qtd ?? 0}</b></td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:#999;">Sem produtos</td></tr>`;
  }

  // Gráficos (somente despesas do período já filtradas por fornecedor/status)
  const despesasPeriodo = finPeriodo.filter(x => x.tipo !== 'Receita');
  drawCharts(despesasPeriodo);
}

/* ==========================================================================
   INIT
   ========================================================================== */
async function initApp() {
  // mostra dashboard
  $('tela-login').style.display = 'none';
  $('tela-dashboard').style.display = 'block';
  $('usuario-logado').innerText = state.user?.nome ? `Olá, ${state.user.nome}` : 'Olá';

  // listeners sidebar
  document.querySelectorAll('.sidebar li').forEach(li => {
    li.onclick = () => navegar(li.dataset.route);
  });

  // produtos
  if ($('barra-pesquisa-produtos')) $('barra-pesquisa-produtos').oninput = renderProdutos;
  if ($('filtro-grupo')) $('filtro-grupo').onchange = renderProdutos;

  $('btnAbrirNovoProduto').onclick = async () => {
    $('form-produto').reset();
    $('prod_id_edit').value = '';
    await Backend.getGrupos();
    updateGrupoSelects();
    openModal('modal-produto');
  };
  $('btn-salvar-prod').onclick = async (e) => {
    e.preventDefault();
    try {
      const p = {
        id: $('prod_id_edit').value || undefined,
        codigo: String($('prod_codigo').value || '').trim(),
        nome: String($('prod_nome').value || '').trim(),
        grupo: String($('prod_grupo').value || '').trim() || 'Geral',
        qtd: parseNumBR($('prod_qtd').value),
        preco: parseNumBR($('prod_preco').value),
      };
      if (!p.codigo || !p.nome) { toast('Preencha Código e Nome.'); return; }
      await Backend.salvarProduto(p);
      closeModal('modal-produto');
      await Backend.getProdutos();
      renderProdutos();
    } catch (e2) {
      toast('Erro ao salvar produto: ' + (e2.message || e2));
    }
  };

  // notas
  $('btnLancarNotaManual').onclick = async () => {
    $('form-nota-manual').reset();
    $('nota_id_edicao').value = '';
    $('nota_is_edit').value = '';
    state.itensNotaManual = [];
    await Backend.getProdutos();
    await Backend.getFornecedores();
    await atualizarSelectFornecedores('');
    renderItensNotaManual();
    $('titulo-modal-nota').innerText = 'Lançamento de Nota';
    openModal('modal-nota-manual');
    setupSugestoesProdutoNota();
  };

  $('btnAddItemNota').onclick = () => {
    const codigo = String($('input-item-codigo').value || '').trim();
    const nome = String($('input-item-busca').value || '').trim();
    const qtd = parseNumBR($('input-item-qtd').value);
    const preco = parseNumBR($('input-item-preco').value);

    if (!codigo && !nome) { toast('Selecione um produto.'); return; }
    if (!qtd || qtd <= 0) { toast('Informe a quantidade.'); return; }
    if (!preco || preco <= 0) { toast('Informe o valor unitário.'); return; }

    // resolve nome pelo catálogo quando possível
    let nomeFinal = nome;
    if (codigo) {
      const p = (state.produtos || []).find(x => String(x.codigo) === codigo);
      if (p) nomeFinal = p.nome;
    }

    state.itensNotaManual.push({ codigo, nome: nomeFinal, qtd, preco });
        $('input-item-busca').value = '';
    $('input-item-codigo').value = '';
    $('input-item-qtd').value = '';
    $('input-item-preco').value = '';
    renderItensNotaManual();
  };

  $('btn-salvar-nota').onclick = async (e) => {
    e.preventDefault();
    try {
      const fornecedor = $('nota_fornecedor').value;
      if (!fornecedor) { toast('Selecione um fornecedor.'); return; }
      if ((state.itensNotaManual || []).length === 0) { toast('Adicione ao menos 1 item.'); return; }

      const total = (state.itensNotaManual || []).reduce((acc, it) => acc + (Number(it.qtd||0) * Number(it.preco||0)), 0);

      const nota = {
        id: $('nota_id_edicao').value || undefined,
        numero: String($('nota_numero').value || '').trim() || null,
        data: $('nota_data').value || null,
        fornecedor,
        qtd_itens: (state.itensNotaManual || []).length,
        valor: total,
        tipo: 'Manual',
        itens_json: state.itensNotaManual
      };

      await Backend.salvarNota(nota);
      closeModal('modal-nota-manual');
      await Backend.getNotas();
      renderNotas();
    } catch (e2) {
      toast('Erro ao salvar nota: ' + (e2.message || e2));
    }
  };

  // financeiro
  if ($('barra-pesquisa-financeiro')) $('barra-pesquisa-financeiro').oninput = renderFinanceiro;

  $('btnNovaDespesa').onclick = async () => {
    $('form-financeiro-manual').reset();
    $('fin_man_id').value = '';
    setTipoFinanceiro('Despesa');
    await Backend.getFornecedores();
    await atualizarSelectFornecedores('');
    $('fin_man_status').value = 'Pendente';
    openModal('modal-nova-despesa');
  };

  $('opt-despesa').onclick = () => setTipoFinanceiro('Despesa');
  $('opt-receita').onclick = () => setTipoFinanceiro('Receita');

  $('btn-salvar-fin-manual').onclick = async (e) => {
    e.preventDefault();
    try {
      const fornecedor = $('fin_man_fornecedor').value;
      if (!fornecedor) { toast('Selecione um fornecedor/cliente.'); return; }

      const item = {
        id: $('fin_man_id').value || undefined,
        tipo: state.tipoFinanceiro,
        descricao: String($('fin_man_descricao').value || '').trim(),
        fornecedor,
        valor: parseNumBR($('fin_man_valor').value),
        status: $('fin_man_status').value || 'Pendente',
        data_emissao: $('fin_man_emissao')?.value || null,
        data_vencimento: $('fin_man_venc').value || null,
      };
      if (!item.descricao) { toast('Informe a descrição.'); return; }
      if (!item.data_vencimento) { toast('Informe o vencimento.'); return; }

      await Backend.salvarFinanceiro(item);
      closeModal('modal-nova-despesa');
      await Backend.getFinanceiro();
      renderFinanceiro();
    } catch (e2) {
      toast('Erro ao salvar: ' + (e2.message || e2));
    }
  };

  // usuarios
  $('btnNovoUsuario').onclick = () => {
    $('form-usuario').reset();
    $('usuario_id_edit').value = '';
    openModal('modal-usuario');
  };

  $('btn-salvar-usuario').onclick = async (e) => {
    e.preventDefault();
    try {
      const u = {
        id: $('usuario_id_edit').value || undefined,
        nome: String($('user_nome').value || '').trim(),
        usuario: String($('user_login').value || '').trim(),
        senha: String($('user_senha').value || '').trim(),
        perfil: $('user_perfil').value || 'Usuario'
      };
      // se for edição e senha vazia, não envia
      if (u.id && !u.senha) delete u.senha;

      await Backend.salvarUsuario(u);
      closeModal('modal-usuario');
      await Backend.getUsuarios();
      renderUsuarios();
    } catch (err) {
      const msg = err?.message || String(err);
      toast('Erro ao salvar usuário: ' + msg);
    }
  };

  // config grupos
  $('btnAddGrupo').onclick = async () => {
    const g = String($('novo-grupo-nome').value || '').trim();
    if (!g) { toast('Informe o nome do grupo.'); return; }
    state.grupos = Array.from(new Set([...(state.grupos||[]), g]));
    await Backend.saveGrupos(state.grupos);
    $('novo-grupo-nome').value = '';
    renderGrupos();
    updateGrupoSelects();
  };

  // fornecedores
  $('btnNovoFornecedor').onclick = () => {
    $('form-fornecedor').reset();
    $('forn_id_edit').value = '';
    $('forn_ativo').value = 'true';
    openModal('modal-fornecedor');
  };
  $('form-fornecedor').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const f = {
        id: $('forn_id_edit').value || undefined,
        nome: String($('forn_nome').value||'').trim(),
        cnpj_cpf: String($('forn_cnpj').value||'').trim() || null,
        telefone: String($('forn_tel').value||'').trim() || null,
        email: String($('forn_email').value||'').trim() || null,
        endereco: String($('forn_endereco').value||'').trim() || null,
        cidade: String($('forn_cidade').value||'').trim() || null,
        uf: String($('forn_uf').value||'').trim() || null,
        observacoes: String($('forn_obs').value||'').trim() || null,
        ativo: $('forn_ativo').value === 'true'
      };
      await Backend.salvarFornecedor(f);
      closeModal('modal-fornecedor');
      await Backend.getFornecedores();
      renderFornecedores();
      atualizarSelectFornecedores();
    } catch (err) {
      toast('Erro ao salvar fornecedor: ' + (err.message || err));
    }
  };
  if ($('busca-fornecedores')) $('busca-fornecedores').oninput = renderFornecedores;
  if ($('filtro-fornecedores-ativo')) $('filtro-fornecedores-ativo').onchange = renderFornecedores;

  // funcionarios
  $('btnNovoFuncionario').onclick = () => {
    $('form-funcionario').reset();
    $('func_id_edit').value = '';
    $('func_ativo').value = 'true';
    openModal('modal-funcionario');
  };
  $('form-funcionario').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const f = {
        id: $('func_id_edit').value || undefined,
        nome: String($('func_nome').value||'').trim(),
        cargo: String($('func_cargo').value||'').trim() || null,
        telefone: String($('func_tel').value||'').trim() || null,
        email: String($('func_email').value||'').trim() || null,
        salario: parseNumBR($('func_salario').value),
        data_admissao: $('func_admissao').value || null,
        observacoes: String($('func_obs').value||'').trim() || null,
        ativo: $('func_ativo').value === 'true'
      };
      await Backend.salvarFuncionario(f);
      closeModal('modal-funcionario');
      await Backend.getFuncionarios();
      renderFuncionarios();
    } catch (err) {
      toast('Erro ao salvar funcionário: ' + (err.message || err));
    }
  };
  if ($('busca-funcionarios')) $('busca-funcionarios').oninput = renderFuncionarios;
  if ($('filtro-funcionarios-ativo')) $('filtro-funcionarios-ativo').onchange = renderFuncionarios;

  // relatórios
  if ($('btnGerarRelatorio')) $('btnGerarRelatorio').onclick = async () => { await prepararRelatorios(); renderRelatorios(); };
  if ($('rel_mes')) $('rel_mes').onchange = renderRelatorios;
  if ($('rel_ano')) $('rel_ano').onchange = renderRelatorios;
  if ($('rel_tipo')) $('rel_tipo').onchange = renderRelatorios;
  if ($('rel_status')) $('rel_status').onchange = renderRelatorios;
  if ($('rel_fornecedor')) $('rel_fornecedor').onchange = renderRelatorios;
  if ($('btnPDFRelatorio')) $('btnPDFRelatorio').onclick = () => {
    const area = $('relatorio-area');
    if (!area) return;
    const mes = $('rel_mes')?.value || String(new Date().getMonth()+1);
    const ano = $('rel_ano')?.value || String(new Date().getFullYear());
    html2pdf().set({ margin: 10, filename: `relatorio_${mes}-${ano}.pdf` }).from(area).save();
  };

  // fechar modais
  document.querySelectorAll('.close').forEach(b => b.onclick = function() { this.closest('.modal').style.display='none'; });
  window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

  // sair
  $('btnSair').onclick = () => {
    localStorage.removeItem('sess_gestao');
    location.reload();
  };

  // navega para dashboard
  await navegar('dashboard');
}

document.addEventListener('DOMContentLoaded', async () => {
  // login
  const sess = localStorage.getItem('sess_gestao');
  if (sess) {
    try {
      state.user = JSON.parse(sess);
      await initApp();
      return;
    } catch (_) {}
  }

  $('btnLogin').onclick = async () => {
    $('msg-erro').innerText = '';
    const res = await Backend.login($('usuario').value, $('senha').value);
    if (res.ok) {
      state.user = res.user;
      localStorage.setItem('sess_gestao', JSON.stringify(res.user));
      await initApp();
    } else {
      const msg = res?.error?.message || res?.error?.details || 'Erro ao fazer login.';
      $('msg-erro').innerText = msg;
      toast(msg);
    }
  };
});
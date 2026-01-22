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
<<<<<<< HEAD

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
=======
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
>>>>>>> e790fa7 (atualização)

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */
let state = {
<<<<<<< HEAD
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
=======
    user: null,
    produtos: [],
    financeiro: [],
    notas: [],
    usuarios: [],
    grupos: [],
    fornecedores: [],
    funcionarios: [],
    route: 'dashboard',
    tipoFinanceiro: 'Despesa',
    
    // Auxiliares
    itensNotaManual: [], 
    produtoContagemSelecionado: null,
    itensContagem: [] 
>>>>>>> e790fa7 (atualização)
};

/* ==========================================================================
   BACKEND
   ========================================================================== */
const Backend = {
<<<<<<< HEAD
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
=======
    async login(u, s) {
        const { data } = await _db.from('usuarios').select('*').eq('usuario', u).eq('senha', s).maybeSingle();
        return data;
    },
    async getProdutos() {
        const { data } = await _db.from('produtos').select('*').order('nome');
        state.produtos = data || [];
        return state.produtos;
    },
    async salvarProduto(p) {
        if (p.id) return await _db.from('produtos').update(p).eq('id', p.id);
        return await _db.from('produtos').insert([p]);
    },
    async excluirProduto(id) {
        return await _db.from('produtos').delete().eq('id', id);
    },
    async atualizarEstoqueBatch(itens) {
        for (const item of itens) {
            await _db.from('produtos').update({ qtd: item.novaQtd }).eq('id', item.id);
        }
        return true;
    },
    async processarEntradaEstoque(itens) {
        for (const item of itens) {
            const { data: existente } = await _db.from('produtos').select('*').eq('codigo', item.codigo).maybeSingle();
            if (existente) {
                const novaQtd = Number(existente.qtd) + Number(item.qtd);
                await _db.from('produtos').update({ qtd: novaQtd, preco: item.preco }).eq('id', existente.id);
            } else {
                await _db.from('produtos').insert([{
                    codigo: item.codigo, nome: item.nome, grupo: 'Geral',
                    qtd: Number(item.qtd), preco: Number(item.preco)
                }]);
            }
        }
    },
    async getFinanceiro() {
        const { data } = await _db.from('financeiro').select('*').order('data_vencimento', { ascending: false });
        state.financeiro = data || [];
        return state.financeiro;
    },
    async salvarFinanceiro(dados) {
        if(dados.id) return await _db.from('financeiro').update(dados).eq('id', dados.id);
        return await _db.from('financeiro').insert(dados);
    },
    async salvarFinanceiroLote(listaDados) {
        // Salva múltiplas linhas de uma vez (para parcelas)
        return await _db.from('financeiro').insert(listaDados);
    },
    async excluirFinanceiro(id) {
        return await _db.from('financeiro').delete().eq('id', id);
    },
    async baixarLote(ids) {
        const { error } = await _db.from('financeiro').update({ status: 'Pago' }).in('id', ids);
        if(error) throw error;
        return true;
    },
    async getNotas() {
        const { data, error } = await _db.from('notas_entrada').select('*').order('created_at', { ascending: false });
        if(error) console.error("Erro notas:", error);
        state.notas = data || [];
        return state.notas;
    },
    async salvarNota(nota) {
        if(nota.id) return await _db.from('notas_entrada').update(nota).eq('id', nota.id).select();
        return await _db.from('notas_entrada').insert([nota]).select();
    },
    async excluirNota(id) {
        return await _db.from('notas_entrada').delete().eq('id', id);
    },
    async getUsuarios() {
        const { data } = await _db.from('usuarios').select('*');
        state.usuarios = data || [];
        return state.usuarios;
    },
    async salvarUsuario(u) {
        if(u.id) return await _db.from('usuarios').update(u).eq('id', u.id);
        return await _db.from('usuarios').insert([u]);
    },
    async excluirUsuario(id) {
        return await _db.from('usuarios').delete().eq('id', id);
    },
    async getGrupos() {
        const { data } = await _db.from('ajustes').select('config_json').limit(1).maybeSingle();
        state.grupos = data?.config_json?.grupos || [];
        return state.grupos;
    },
    async saveGrupos(grupos) {
        const { data } = await _db.from('ajustes').select('id').limit(1).maybeSingle();
        if(data) await _db.from('ajustes').update({config_json: {grupos}}).eq('id', data.id);
        else await _db.from('ajustes').insert([{config_json: {grupos}}]);
    }
    // --- FORNECEDORES ---
    async getFornecedores(includeInativos = false) {
        let q = _db.from('fornecedores').select('*').order('nome');
        if(!includeInativos) q = q.eq('ativo', true);
        const { data, error } = await q;
        if(error) console.error("Erro fornecedores:", error);
        state.fornecedores = data || [];
        return state.fornecedores;
    },
    async salvarFornecedor(f) {
        if (f.id) return await _db.from('fornecedores').update(f).eq('id', f.id);
        return await _db.from('fornecedores').insert([f]);
    },
    async excluirFornecedor(id) {
        return await _db.from('fornecedores').delete().eq('id', id);
    },

    // --- FUNCIONÁRIOS ---
    async getFuncionarios(includeInativos = false) {
        let q = _db.from('funcionarios').select('*').order('nome');
        if(!includeInativos) q = q.eq('ativo', true);
        const { data, error } = await q;
        if(error) console.error("Erro funcionarios:", error);
        state.funcionarios = data || [];
        return state.funcionarios;
    },
    async salvarFuncionario(f) {
        if (f.id) return await _db.from('funcionarios').update(f).eq('id', f.id);
        return await _db.from('funcionarios').insert([f]);
    },
    async excluirFuncionario(id) {
        return await _db.from('funcionarios').delete().eq('id', id);
    },

>>>>>>> e790fa7 (atualização)
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

<<<<<<< HEAD
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
=======
    ['view-padrao','view-produtos','view-notas-entrada','view-financeiro','view-relatorios','view-funcionarios','view-fornecedores','view-usuarios','view-configuracoes'].forEach(v => $(v).style.display = 'none');
    
    if(modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if(modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        injetarControlesFinanceiros();
        await Backend.getFornecedores(false);
        atualizarSelectFornecedores();
        renderFinanceiro(await Backend.getFinanceiro());
    } else if(modulo === 'relatorios') {
        $('view-relatorios').style.display = 'block';
        await prepararRelatorios();
        renderRelatorios();
    } else if(modulo === 'funcionarios') {
        $('view-funcionarios').style.display = 'block';
        renderFuncionarios(await Backend.getFuncionarios(true));
    } else if(modulo === 'fornecedores') {
        $('view-fornecedores').style.display = 'block';
        await Backend.getFornecedores(true);
        renderFornecedores(state.fornecedores);
        atualizarSelectFornecedores();
    } else if(modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if(modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        if(state.produtos.length === 0) await Backend.getProdutos();
        await Backend.getFornecedores(false);
        atualizarSelectFornecedores();
        renderNotas(await Backend.getNotas());
    } else if(modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else {
        $('view-padrao').style.display = 'block';
    }
}

// ==========================================================================
// RENDERIZAÇÃO
// ==========================================================================
function safeDate(dateStr) {
    if(!dateStr) return "-";
    if(dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
}

function renderNotas(lista) {
    const tbody = $('tabela-notas-corpo');
    if(!tbody) return;
    
    tbody.innerHTML = lista.map(n => `<tr>
>>>>>>> e790fa7 (atualização)
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

<<<<<<< HEAD
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
=======
function injetarControlesFinanceiros() {
    if(document.getElementById('filtro-status-fin')) return;
    const toolbar = document.querySelector('#view-financeiro .filters');
    if(toolbar) {
        const select = document.createElement('select'); select.id = 'filtro-status-fin';
        select.innerHTML = '<option value="">Todos Status</option><option value="Pendente">Pendente</option><option value="Pago">Pago</option>';
        select.style.padding = '10px'; select.style.borderRadius = '5px'; select.style.border = '1px solid #ddd'; select.style.marginLeft = '10px';
        select.onchange = async () => renderFinanceiro(state.financeiro);
        toolbar.appendChild(select);
    }
    const toolbarBtn = document.querySelector('#view-financeiro .toolbar > div:last-child');
    if(toolbarBtn) {
        const btnBatch = document.createElement('button'); btnBatch.id = 'btn-baixa-lote'; btnBatch.className = 'btn-action';
        btnBatch.innerHTML = '<span class="material-icons">done_all</span> Baixar Selecionados';
        btnBatch.style.backgroundColor = '#27ae60'; btnBatch.style.display = 'none'; btnBatch.onclick = realizarBaixaEmLote;
        toolbarBtn.insertBefore(btnBatch, toolbarBtn.firstChild);
    }
}

function renderFinanceiro(lista) {
    const termo = $('barra-pesquisa-financeiro').value.toLowerCase();
    const statusFiltro = $('filtro-status-fin') ? $('filtro-status-fin').value : "";
    const filtrado = lista.filter(i => {
        const matchTexto = i.descricao.toLowerCase().includes(termo) || i.fornecedor?.toLowerCase().includes(termo);
        const matchStatus = statusFiltro === "" || i.status === statusFiltro;
        return matchTexto && matchStatus;
    });
    let rec = 0, desp = 0;
    const tbody = $('tabela-financeiro-corpo');
    const theadRow = document.querySelector('#view-financeiro thead tr');
    if(theadRow && !theadRow.querySelector('.th-check')) {
        const th = document.createElement('th'); th.className='th-check'; th.width='30px';
        th.innerHTML = '<input type="checkbox" onchange="toggleAllFin(this)">';
        theadRow.insertBefore(th, theadRow.firstChild);
    }
    tbody.innerHTML = filtrado.map(i => {
        const val = parseFloat(i.valor); i.tipo === 'Receita' ? rec += val : desp += val;
        const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
        const isPago = i.status === 'Pago';
        return `<tr>
            <td><input type="checkbox" class="check-fin" value="${i.id}" onchange="checkFinChanged()"></td>
            <td>${safeDate(i.data_vencimento)}</td>
            <td>${i.descricao}<br><small>${i.fornecedor || ''}</small></td>
            <td><span style="color:${cor}">${i.tipo}</span></td>
            <td style="color:${cor}"><b>${money(val)}</b></td>
            <td><span style="padding:4px 8px; border-radius:4px; background:${isPago ? '#dff9fb':'#ffeaa7'}; color:${isPago ? '#2c3e50':'#d35400'}; font-size:12px;">${i.status}</span></td>
            <td><span class="material-icons" style="cursor:pointer; margin-right:5px; color:#666;" onclick="editarFin('${i.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delFin('${i.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('fin-total-receitas').innerText = money(rec); $('fin-total-despesas').innerText = money(desp); $('fin-saldo').innerText = money(rec - desp);
    checkFinChanged();
}
window.toggleAllFin = (source) => { document.querySelectorAll('.check-fin').forEach(c => c.checked = source.checked); checkFinChanged(); };
window.checkFinChanged = () => { const selecionados = document.querySelectorAll('.check-fin:checked').length; const btn = $('btn-baixa-lote'); if(btn) btn.style.display = selecionados > 0 ? 'flex' : 'none'; };
async function realizarBaixaEmLote() {
    const ids = Array.from(document.querySelectorAll('.check-fin:checked')).map(c => c.value); if(ids.length === 0) return;
    if(!confirm(`Deseja marcar ${ids.length} itens como PAGO?`)) return;
    try { await Backend.baixarLote(ids); alert('Baixa realizada com sucesso!'); renderFinanceiro(await Backend.getFinanceiro()); } catch(e) { alert('Erro: ' + e.message); }
}
function renderUsuarios(lista) {
    $('tabela-usuarios-corpo').innerHTML = lista.map(u => `<tr><td>${u.nome}</td><td>${u.usuario}</td><td>${u.perfil}</td><td><span class="material-icons" onclick="editUser('${u.id}')" style="cursor:pointer">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delUser('${u.id}')">delete</span></td></tr>`).join('');
}
function renderGrupos(lista) { $('tabela-config-grupos').innerHTML = lista.map(g => `<tr><td>${g}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="delGrupo('${g}')">delete</span></td></tr>`).join(''); }

/* ==========================================================================
   MODAIS E ACTIONS
   ========================================================================== */

/* ==========================================================================
   FORNECEDORES (SELECTS) + FUNCIONÁRIOS + FORNECEDORES (CRUD)
   ========================================================================== */
function _norm(s){ return (s||'').toString().trim().toLowerCase(); }
function _esc(s){ return (s||'').toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function atualizarSelectFornecedores() {
    const ativos = (state.fornecedores || []).filter(f => f.ativo !== false);
    const opts = ativos.map(f => `<option value="${_esc(f.nome)}">${_esc(f.nome)}</option>`).join('');
    ['nota_fornecedor','fin_man_fornecedor'].forEach(id => {
        const sel = $(id);
        if(!sel) return;
        const atual = sel.value;
        sel.innerHTML = `<option value="">Selecione...</option>` + opts;
        if(atual) {
            const existe = Array.from(sel.options).some(o => _norm(o.value) === _norm(atual));
            if(existe) sel.value = atual;
            else sel.insertAdjacentHTML('afterbegin', `<option value="${_esc(atual)}" selected>(Antigo) ${_esc(atual)}</option>`);
        }
    });

    // filtro de fornecedor no relatório
    const rf = $('rel_fornecedor');
    if(rf) {
        const atual = rf.value;
        rf.innerHTML = `<option value="">Todos Fornecedores</option>` + opts;
        if(atual) {
            const existe = Array.from(rf.options).some(o => _norm(o.value) === _norm(atual));
            if(existe) rf.value = atual;
            else rf.insertAdjacentHTML('afterbegin', `<option value="${_esc(atual)}" selected>(Antigo) ${_esc(atual)}</option>`);
        }
    }
}

function abrirModalFornecedor(f = null) {
    $('forn_id').value = f?.id || '';
    $('forn_nome').value = f?.nome || '';
    $('forn_cnpj').value = f?.cnpj_cpf || '';
    $('forn_telefone').value = f?.telefone || '';
    $('forn_email').value = f?.email || '';
    $('forn_endereco').value = f?.endereco || '';
    $('forn_cidade').value = f?.cidade || '';
    $('forn_uf').value = f?.uf || '';
    $('forn_obs').value = f?.observacoes || '';
    $('forn_ativo').value = (f?.ativo === false) ? 'false' : 'true';
    $('modal-fornecedor').style.display = 'block';
    setTimeout(() => $('forn_nome').focus(), 80);
}
function abrirModalFuncionario(f = null) {
    $('func_id').value = f?.id || '';
    $('func_nome').value = f?.nome || '';
    $('func_cargo').value = f?.cargo || '';
    $('func_telefone').value = f?.telefone || '';
    $('func_email').value = f?.email || '';
    $('func_salario').value = (f?.salario ?? '');
    $('func_admissao').value = f?.data_admissao || '';
    $('func_obs').value = f?.observacoes || '';
    $('func_ativo').value = (f?.ativo === false) ? 'false' : 'true';
    $('modal-funcionario').style.display = 'block';
    setTimeout(() => $('func_nome').focus(), 80);
}

function renderFornecedores(lista) {
    const termo = _norm($('busca-fornecedores')?.value);
    const filtroAtivo = $('filtro-fornecedores-ativo')?.value;
    let arr = (lista || state.fornecedores || []).slice();

    if(termo) arr = arr.filter(f => _norm(f.nome).includes(termo) || _norm(f.cnpj_cpf).includes(termo) || _norm(f.telefone).includes(termo));
    if(filtroAtivo === 'true') arr = arr.filter(f => f.ativo !== false);
    if(filtroAtivo === 'false') arr = arr.filter(f => f.ativo === false);

    $('tabela-fornecedores-corpo').innerHTML = arr.map(f => `
        <tr>
            <td><b>${_esc(f.nome)}</b></td>
            <td>${_esc(f.cnpj_cpf || '')}</td>
            <td>${_esc((f.telefone||'') + (f.email ? ' / ' + f.email : ''))}</td>
            <td>
                <span class="tag ${f.ativo === false ? 'pendente' : 'pago'}" style="cursor:pointer" onclick="toggleFornecedor('${f.id}')">
                    ${f.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
            </td>
            <td>
                <span class="material-icons action-btn edit" onclick="editarFornecedor('${f.id}')">edit</span>
                <span class="material-icons action-btn delete" onclick="excluirFornecedor('${f.id}')">delete</span>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:#999">Nenhum fornecedor</td></tr>`;
}

function renderFuncionarios(lista) {
    const termo = _norm($('busca-funcionarios')?.value);
    const filtroAtivo = $('filtro-funcionarios-ativo')?.value;
    let arr = (lista || state.funcionarios || []).slice();

    if(termo) arr = arr.filter(f => _norm(f.nome).includes(termo) || _norm(f.cargo).includes(termo) || _norm(f.telefone).includes(termo));
    if(filtroAtivo === 'true') arr = arr.filter(f => f.ativo !== false);
    if(filtroAtivo === 'false') arr = arr.filter(f => f.ativo === false);

    $('tabela-funcionarios-corpo').innerHTML = arr.map(f => `
        <tr>
            <td><b>${_esc(f.nome)}</b></td>
            <td>${_esc(f.cargo || '')}</td>
            <td>${_esc((f.telefone||'') + (f.email ? ' / ' + f.email : ''))}</td>
            <td>
                <span class="tag ${f.ativo === false ? 'pendente' : 'pago'}" style="cursor:pointer" onclick="toggleFuncionario('${f.id}')">
                    ${f.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
            </td>
            <td>
                <span class="material-icons action-btn edit" onclick="editarFuncionario('${f.id}')">edit</span>
                <span class="material-icons action-btn delete" onclick="excluirFuncionario('${f.id}')">delete</span>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:#999">Nenhum funcionário</td></tr>`;
}

window.editarFornecedor = (id) => { const f = (state.fornecedores||[]).find(x => x.id == id); abrirModalFornecedor(f); };
window.editarFuncionario = (id) => { const f = (state.funcionarios||[]).find(x => x.id == id); abrirModalFuncionario(f); };

window.toggleFornecedor = async (id) => {
    const f = (state.fornecedores||[]).find(x => x.id == id);
    if(!f) return;
    await Backend.salvarFornecedor({ id, ativo: !(f.ativo !== false) ? true : false });
    await Backend.getFornecedores(true);
    renderFornecedores(state.fornecedores);
    atualizarSelectFornecedores();
};
window.toggleFuncionario = async (id) => {
    const f = (state.funcionarios||[]).find(x => x.id == id);
    if(!f) return;
    await Backend.salvarFuncionario({ id, ativo: !(f.ativo !== false) ? true : false });
    state.funcionarios = await Backend.getFuncionarios(true);
    renderFuncionarios(state.funcionarios);
};

window.excluirFornecedor = async (id) => {
    if(!confirm('Excluir este fornecedor?')) return;
    await Backend.excluirFornecedor(id);
    await Backend.getFornecedores(true);
    renderFornecedores(state.fornecedores);
    atualizarSelectFornecedores();
};
window.excluirFuncionario = async (id) => {
    if(!confirm('Excluir este funcionário?')) return;
    await Backend.excluirFuncionario(id);
    state.funcionarios = await Backend.getFuncionarios(true);
    renderFuncionarios(state.funcionarios);
};

/* ==========================================================================
   RELATÓRIOS (FILTROS + GRÁFICOS)
   ========================================================================== */
let _chartStatus = null;
let _chartFornecedor = null;

function _toDate(value) {
  if(!value) return null;
  if(typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00');
  return new Date(value);
}

async function prepararRelatorios() {
    // carrega dados
    if(state.produtos.length === 0) await Backend.getProdutos();
    if(state.financeiro.length === 0) await Backend.getFinanceiro();
    if(state.notas.length === 0) await Backend.getNotas();
    if(state.fornecedores.length === 0) await Backend.getFornecedores(false);

    // selects mês/ano
    const selMes = $('rel_mes');
    const selAno = $('rel_ano');
    if(selMes && selMes.options.length === 0) {
        const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        selMes.innerHTML = meses.map((m, idx) => `<option value="${idx+1}">${m}</option>`).join('');
        const anoAtual = new Date().getFullYear();
        const anos = [];
        for(let a = anoAtual - 4; a <= anoAtual + 1; a++) anos.push(a);
        selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
        selMes.value = String(new Date().getMonth() + 1);
        selAno.value = String(anoAtual);
    }

    atualizarSelectFornecedores();
}

function _aplicarVisibilidadeRel(tipo) {
    const show = (id, ok) => { const el = $(id); if(el) el.style.display = ok ? 'block' : 'none'; };
    if(tipo === 'resumo') {
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'financeiro') {
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', false);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', true);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'notas') {
        show('rel-bloco-resumo', false);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', false);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', true);
        show('rel-bloco-estoque', false);
    } else if(tipo === 'estoque') {
        show('rel-bloco-resumo', false);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', false);
        show('rel-bloco-financeiro', false);
        show('rel-bloco-notas', false);
        show('rel-bloco-estoque', true);
    } else { // todos
        show('rel-bloco-resumo', true);
        show('rel-bloco-estoque-cards', true);
        show('rel-bloco-graficos', true);
        show('rel-bloco-financeiro', true);
        show('rel-bloco-notas', true);
        show('rel-bloco-estoque', true);
    }
}

function renderRelatorios() {
    const mes = parseInt($('rel_mes')?.value || (new Date().getMonth() + 1), 10);
    const ano = parseInt($('rel_ano')?.value || new Date().getFullYear(), 10);
    const tipoRel = $('rel_tipo')?.value || 'todos';
    const statusFiltro = $('rel_status')?.value || '';
    const fornecedorFiltro = $('rel_fornecedor')?.value || '';

    _aplicarVisibilidadeRel(tipoRel);

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);

    let finPeriodo = (state.financeiro || []).filter(f => {
        const d = _toDate(f.data_vencimento);
        return d && d >= inicio && d < fim;
    });
    let notasPeriodo = (state.notas || []).filter(n => {
        const d = _toDate(n.data);
        return d && d >= inicio && d < fim;
    });

    if(statusFiltro) finPeriodo = finPeriodo.filter(f => (f.status||'') === statusFiltro);
    if(fornecedorFiltro) {
        finPeriodo = finPeriodo.filter(f => _norm(f.fornecedor) === _norm(fornecedorFiltro));
        notasPeriodo = notasPeriodo.filter(n => _norm(n.fornecedor) === _norm(fornecedorFiltro));
    }

    // Totais financeiro
    let receitas = 0, despesas = 0;
    finPeriodo.forEach(i => {
        const v = parseFloat(i.valor || 0);
        if(i.tipo === 'Receita') receitas += v; else despesas += v;
    });

    // Estoque
    let qtdEstoque = 0, valorEstoque = 0;
    (state.produtos || []).forEach(p => {
        const q = parseFloat(p.qtd || 0);
        const pr = parseFloat(p.preco || 0);
        qtdEstoque += q;
        valorEstoque += (q * pr);
    });

    if($('rel-receitas')) $('rel-receitas').innerText = money(receitas);
    if($('rel-despesas')) $('rel-despesas').innerText = money(despesas);
    if($('rel-saldo')) $('rel-saldo').innerText = money(receitas - despesas);
    if($('rel-estoque-qtd')) $('rel-estoque-qtd').innerText = String(qtdEstoque);
    if($('rel-estoque-valor')) $('rel-estoque-valor').innerText = money(valorEstoque);
    if($('rel-notas')) $('rel-notas').innerText = String(notasPeriodo.length);

    // Tabela financeiro
    const corpoFin = $('rel-financeiro-corpo');
    if(corpoFin) {
        const linhas = finPeriodo
            .sort((a,b) => (_toDate(b.data_vencimento) - _toDate(a.data_vencimento)))
            .slice(0, 300)
            .map(i => {
                const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
                return `<tr>
                    <td>${safeDate(i.data_vencimento)}</td>
                    <td>${_esc(i.descricao || '')}<br><small>${_esc(i.fornecedor || '')}</small></td>
                    <td><span style="color:${cor}">${i.tipo}</span></td>
                    <td style="color:${cor}"><b>${money(i.valor)}</b></td>
                    <td>${_esc(i.status || '')}</td>
                </tr>`;
            }).join('');
        corpoFin.innerHTML = linhas || `<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum lançamento no período</td></tr>`;
    }

    // Tabela notas
    const corpoNotas = $('rel-notas-corpo');
    if(corpoNotas) {
        const linhas = notasPeriodo
            .sort((a,b) => (_toDate(b.data) - _toDate(a.data)))
            .slice(0, 300)
            .map(n => `<tr>
                <td>${safeDate(n.data)}</td>
                <td>${_esc(n.numero || '-')}</td>
                <td>${_esc(n.fornecedor || '-')}</td>
                <td>${n.qtd_itens || 0}</td>
                <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
                <td><small>${_esc(n.tipo || 'Manual')}</small></td>
            </tr>`).join('');
        corpoNotas.innerHTML = linhas || `<tr><td colspan="6" style="text-align:center; color:#999;">Nenhuma nota no período</td></tr>`;
    }

    // Baixo estoque
    const corpoBaixo = $('rel-baixo-estoque-corpo');
    if(corpoBaixo) {
        const low = (state.produtos || [])
            .slice()
            .sort((a,b) => parseFloat(a.qtd || 0) - parseFloat(b.qtd || 0))
            .slice(0, 15);
        corpoBaixo.innerHTML = low.map(p => `<tr>
            <td><b>${_esc(p.codigo)}</b></td>
            <td>${_esc(p.nome)}</td>
            <td>${_esc(p.grupo || '-')}</td>
            <td><b>${p.qtd}</b></td>
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:#999;">Sem produtos</td></tr>`;
    }

    // Gráficos (despesas)
    const despesasPeriodo = finPeriodo.filter(i => i.tipo === 'Despesa');
    const somaStatus = { Pago: 0, Pendente: 0 };
    despesasPeriodo.forEach(i => {
        const st = (i.status === 'Pago') ? 'Pago' : 'Pendente';
        somaStatus[st] += parseFloat(i.valor || 0);
    });

    const porFornecedor = {};
    despesasPeriodo.forEach(i => {
        const k = (i.fornecedor || 'Sem fornecedor').toString();
        porFornecedor[k] = (porFornecedor[k] || 0) + parseFloat(i.valor || 0);
    });
    const top = Object.entries(porFornecedor).sort((a,b) => b[1]-a[1]).slice(0,10);
    const labelsF = top.map(x => x[0]);
    const valuesF = top.map(x => x[1]);

    const ctxS = $('chart-despesas-status');
    if(ctxS) {
        if(_chartStatus) _chartStatus.destroy();
        _chartStatus = new Chart(ctxS, {
            type: 'doughnut',
            data: { labels: ['Pago','Pendente'], datasets: [{ data: [somaStatus.Pago, somaStatus.Pendente] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctxF = $('chart-despesas-fornecedor');
    if(ctxF) {
        if(_chartFornecedor) _chartFornecedor.destroy();
        _chartFornecedor = new Chart(ctxF, {
            type: 'bar',
            data: { labels: labelsF, datasets: [{ label: 'Despesas', data: valuesF }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45, minRotation: 0 } } } }
        });
    }
}


function closeModal(id) { $(id).style.display = 'none'; }
window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

// --- PRODUTOS ---
$('btnAbrirNovoProduto').onclick = () => { $('form-produto').reset(); $('is_edit').value = 'false'; $('prod_id_edit').value = ''; $('modal-produto').style.display = 'block'; setTimeout(() => $('prod_codigo').focus(), 100); };
$('prod_codigo').addEventListener('keydown', (e) => { if(e.key === "Enter") { e.preventDefault(); $('prod_nome').focus(); } });
window.editarProd = (id) => {
    const p = state.produtos.find(x => x.id == id); if(!p) return;
    $('is_edit').value = 'true'; $('prod_id_edit').value = p.id;
    $('prod_codigo').value = p.codigo; $('prod_nome').value = p.nome; $('prod_grupo').value = p.grupo; $('prod_qtd').value = p.qtd; $('prod_preco').value = p.preco;
    $('modal-produto').style.display = 'block';
};
$('btn-salvar-prod').onclick = async (e) => {
    e.preventDefault();
    const p = { id: $('prod_id_edit').value || undefined, codigo: $('prod_codigo').value, nome: $('prod_nome').value, grupo: $('prod_grupo').value, qtd: parseFloat($('prod_qtd').value), preco: parseFloat($('prod_preco').value) };
    await Backend.salvarProduto(p); closeModal('modal-produto'); navegar('produtos');
};
window.delProd = async (id) => { if(confirm('Excluir?')) { await Backend.excluirProduto(id); navegar('produtos'); } };

// --- NOTAS DE ENTRADA ---
function injetarBotaoFinanceiroNaNota() {
    const actionsDiv = document.querySelector('#form-nota-manual .actions'); if(!actionsDiv) return;
    if(document.getElementById('btn-lancar-fin-manual-nota')) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'btn-lancar-fin-manual-nota'; btn.className = 'btn-action'; btn.style.backgroundColor = '#e67e22'; btn.style.marginLeft = '10px';
    btn.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:middle;">attach_money</span> Lançar no Contas a Pagar';
    btn.onclick = () => {
        const idNota = $('nota_id_edicao').value; const fornecedor = $('nota_fornecedor').value; const numero = $('nota_numero').value;
        let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco));
    if(!$('nota_fornecedor').value) { alert('Selecione um fornecedor cadastrado.'); btn.disabled = false; btn.innerText = 'Salvar'; return; }
        if(valTotal === 0) return alert("A nota não tem valor.");
        const notaObj = { id: idNota, numero: numero, fornecedor: fornecedor, valor: valTotal, parcelas_xml: null };
        if(idNota) { const notaOriginal = state.notas.find(n => n.id == idNota); if(notaOriginal && notaOriginal.parcelas_xml) { notaObj.parcelas_xml = notaOriginal.parcelas_xml; } }
        closeModal('modal-nota-manual'); preencherFinanceiroComNota(notaObj);
    };
    const btnSalvar = $('btn-salvar-nota'); actionsDiv.insertBefore(btn, btnSalvar);
}

$('btnLancarNotaManual').onclick = () => {
    $('form-nota-manual').reset(); state.itensNotaManual = [];
    $('nota_is_edit').value = 'false'; $('nota_id_edicao').value = '';
    $('titulo-modal-nota').innerText = "Lançamento Manual de Nota";
    renderItensNotaManual(); $('modal-nota-manual').style.display = 'block';
    injetarBotaoFinanceiroNaNota();
};

function renderItensNotaManual() {
    const tbody = $('tabela-itens-nota-manual'); let totalQtd = 0, totalValor = 0;
    if(state.itensNotaManual.length === 0) { tbody.innerHTML = ''; $('msg-sem-itens').style.display = 'block'; } else {
        $('msg-sem-itens').style.display = 'none';
        tbody.innerHTML = state.itensNotaManual.map((item, idx) => {
            totalQtd++; const totItem = Number(item.qtd) * Number(item.preco); totalValor += totItem;
            return `<tr><td>${item.codigo || '-'}</td><td>${item.nome}</td><td>${item.qtd}</td><td>${money(item.preco)}</td><td>${money(totItem)}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="removerItemNota(${idx})">delete</span></td></tr>`;
        }).join('');
    }
    $('display-total-qtd').innerText = totalQtd; $('display-total-valor').innerText = money(totalValor);
}
$('btnAddItemNota').onclick = () => {
    const nome = $('input-item-busca').value; const codigo = $('input-item-codigo').value; const qtd = parseFloat($('input-item-qtd').value); const preco = parseFloat($('input-item-preco').value);
    if(!nome || !qtd || !preco) return alert('Preencha os dados do item.');
    state.itensNotaManual.push({ nome, codigo, qtd, preco });
    renderItensNotaManual(); $('input-item-busca').value = ''; $('input-item-codigo').value = ''; $('input-item-qtd').value = ''; $('input-item-preco').value = ''; $('input-item-busca').focus();
};
window.removerItemNota = (idx) => { state.itensNotaManual.splice(idx, 1); renderItensNotaManual(); };
$('input-item-busca').onkeyup = () => {
    const termo = $('input-item-busca').value.toLowerCase(); const lista = $('lista-sugestoes-manual');
    if(termo.length < 2) { lista.style.display = 'none'; return; }
    const encontrados = state.produtos.filter(p => p.nome.toLowerCase().includes(termo));
    if(encontrados.length > 0) { lista.style.display = 'block'; lista.innerHTML = encontrados.map(p => `<li onclick="selecionarItemNota('${p.id}')"><strong>${p.nome}</strong> (R$ ${p.preco})</li>`).join(''); } else lista.style.display = 'none';
};
window.selecionarItemNota = (id) => {
    const p = state.produtos.find(x => x.id == id);
    if(p) { $('input-item-busca').value = p.nome; $('input-item-codigo').value = p.codigo; $('input-item-preco').value = p.preco; $('lista-sugestoes-manual').style.display = 'none'; $('input-item-qtd').focus(); }
};
$('btn-salvar-nota').onclick = async (e) => {
    e.preventDefault(); const btn = $('btn-salvar-nota'); btn.disabled = true; btn.innerText = "Salvando...";
    let valTotal = 0; state.itensNotaManual.forEach(i => valTotal += (i.qtd * i.preco));
    const novaNota = {
        id: $('nota_id_edicao').value || undefined, numero: $('nota_numero').value, data: $('nota_data').value,
        fornecedor: $('nota_fornecedor').value, qtd_itens: state.itensNotaManual.length, valor: valTotal, tipo: 'Manual', itens_json: state.itensNotaManual
    };
>>>>>>> e790fa7 (atualização)
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
<<<<<<< HEAD
    try {
      const fornecedor = $('nota_fornecedor').value;
      if (!fornecedor) { toast('Selecione um fornecedor.'); return; }
      if ((state.itensNotaManual || []).length === 0) { toast('Adicione ao menos 1 item.'); return; }
=======
    injetarCamposParcelamento(); // Garante que a caixa de parcelas existe para verificação
    
    const isEdit = $('fin_man_id') && $('fin_man_id').value !== "";
    const checkboxParcelado = document.getElementById('check_parcelado');
    // Verifica se checkbox existe e está marcado
    const isParcelado = checkboxParcelado && checkboxParcelado.checked && !isEdit; 
    
    const dadosBase = { tipo: state.tipoFinanceiro, descricao: $('fin_man_descricao').value, fornecedor: $('fin_man_fornecedor').value, data_emissao: $('fin_man_emissao').value, status: $('fin_man_status').value };
    if(!dadosBase.fornecedor) { alert('Selecione um fornecedor cadastrado.'); return; }
>>>>>>> e790fa7 (atualização)

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

<<<<<<< HEAD
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
=======
// --- XML IMPORT ---
$('btnImportarXML').onclick = () => { $('file-xml').value = ''; $('modal-importar-xml').style.display = 'block'; };
$('btn-processar-xml').onclick = () => {
    const file = $('file-xml').files[0]; if(!file) return alert('Selecione um arquivo');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const parser = new DOMParser(); const xml = parser.parseFromString(e.target.result, "text/xml");
        const nNF = xml.getElementsByTagName("nNF")[0]?.textContent; const xNome = xml.getElementsByTagName("xNome")[0]?.textContent; const vNF = xml.getElementsByTagName("vNF")[0]?.textContent;
        const itensXML = []; const dets = xml.getElementsByTagName("det");
        for(let i=0; i<dets.length; i++) {
            const prod = dets[i].getElementsByTagName("prod")[0];
            if(prod) {
                const cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent; const cProd = prod.getElementsByTagName("cProd")[0]?.textContent;
                const codigoFinal = (cEAN && cEAN !== "SEM GTIN" && cEAN.trim() !== "") ? cEAN : cProd;
                itensXML.push({ codigo: codigoFinal, nome: prod.getElementsByTagName("xProd")[0]?.textContent, qtd: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent), preco: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent) });
            }
        }
        const parcelasXML = []; const dups = xml.getElementsByTagName("dup");
        for(let i=0; i<dups.length; i++) { parcelasXML.push({ vencimento: dups[i].getElementsByTagName("dVenc")[0]?.textContent, valor: dups[i].getElementsByTagName("vDup")[0]?.textContent }); }
        if(nNF) {
            const notaXML = { numero: nNF, fornecedor: xNome, valor: parseFloat(vNF), tipo: 'XML Importado', data: new Date(), qtd_itens: itensXML.length, itens_json: itensXML, parcelas_xml: parcelasXML };
            await Backend.salvarNota(notaXML);
            try { await Backend.processarEntradaEstoque(itensXML); } catch(e) { console.error(e); }
            alert(`Nota ${nNF} importada!`); closeModal('modal-importar-xml'); navegar('notas_entrada');
        } else alert('XML inválido');
    };
    reader.readAsText(file);
};

// --- PDF & USUARIOS ---
$('btnPDFProdutos').onclick = () => html2pdf().set({ margin: 10, filename: 'estoque.pdf' }).from($('tabela-produtos-corpo').parentElement).save();
$('btnPDFFinanceiro').onclick = () => html2pdf().set({ margin: 10, filename: 'financeiro.pdf' }).from($('tabela-financeiro-corpo').parentElement).save();
$('btnNovoUsuario').onclick = () => { $('form-usuario').reset(); $('usuario_id_edit').value=''; $('modal-usuario').style.display='block'; };
$('btn-salvar-usuario').onclick = async (e) => { e.preventDefault(); const u = { id: $('usuario_id_edit').value || undefined, nome: $('user_nome').value, usuario: $('user_login').value, senha: $('user_senha').value, perfil: $('user_perfil').value }; await Backend.salvarUsuario(u); closeModal('modal-usuario'); navegar('usuarios'); };
window.delUser = async (id) => { if(confirm('Excluir?')) { await Backend.excluirUsuario(id); navegar('usuarios'); } };
window.editUser = (id) => { const u = state.usuarios.find(x => x.id == id); if(!u) return; $('usuario_id_edit').value = u.id; $('user_nome').value = u.nome; $('user_login').value = u.usuario; $('user_senha').value = u.senha; $('user_perfil').value = u.perfil; $('modal-usuario').style.display = 'block'; };

// --- CONFIG ---
$('btnAddGrupo').onclick = async () => { const g = $('novo-grupo-nome').value; if(g && !state.grupos.includes(g)) { state.grupos.push(g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); } };
window.delGrupo = async (g) => { state.grupos = state.grupos.filter(x => x !== g); await Backend.saveGrupos(state.grupos); navegar('configuracoes'); };
async function updateGrupoSelects() { const grps = await Backend.getGrupos(); const opts = grps.map(g => `<option value="${g}">${g}</option>`).join(''); $('prod_grupo').innerHTML = '<option value="">Selecione...</option>' + opts; $('filtro-grupo').innerHTML = '<option value="">Todos</option>' + opts; }

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const sess = localStorage.getItem('sess_gestao');
    if(sess) { state.user = JSON.parse(sess); initApp(); }

    $('btnLogin').onclick = async () => {
        const u = await Backend.login($('usuario').value, $('senha').value);
        if(u) {
            state.user = u;
            localStorage.setItem('sess_gestao', JSON.stringify(u));
            initApp();
        } else {
            $('msg-erro').innerText = 'Erro login';
        }
    };

    $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };

    document.querySelectorAll('.close').forEach(b => b.onclick = function() { this.closest('.modal').style.display='none'; });
    window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };

    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));

    // Pesquisas existentes
    if($('barra-pesquisa')) $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    if($('barra-pesquisa-financeiro')) $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);

    // Fornecedores
    if($('btnNovoFornecedor')) $('btnNovoFornecedor').onclick = async () => {
        await Backend.getFornecedores(true);
        abrirModalFornecedor();
    };
    if($('btn-salvar-fornecedor')) $('btn-salvar-fornecedor').onclick = async () => {
        const nome = $('forn_nome').value.trim();
        if(!nome) return alert('Informe o nome do fornecedor.');
        const payload = {
            id: $('forn_id').value || undefined,
            nome,
            cnpj_cpf: $('forn_cnpj').value.trim() || null,
            telefone: $('forn_telefone').value.trim() || null,
            email: $('forn_email').value.trim() || null,
            endereco: $('forn_endereco').value.trim() || null,
            cidade: $('forn_cidade').value.trim() || null,
            uf: $('forn_uf').value.trim().toUpperCase() || null,
            observacoes: $('forn_obs').value.trim() || null,
            ativo: $('forn_ativo').value === 'true'
        };
        await Backend.salvarFornecedor(payload);
        closeModal('modal-fornecedor');
        await Backend.getFornecedores(true);
        renderFornecedores(state.fornecedores);
        atualizarSelectFornecedores();
    };
    if($('busca-fornecedores')) $('busca-fornecedores').onkeyup = () => renderFornecedores(state.fornecedores);
    if($('filtro-fornecedores-ativo')) $('filtro-fornecedores-ativo').onchange = () => renderFornecedores(state.fornecedores);

    // Funcionários
    if($('btnNovoFuncionario')) $('btnNovoFuncionario').onclick = async () => {
        await Backend.getFuncionarios(true);
        abrirModalFuncionario();
    };
    if($('btn-salvar-funcionario')) $('btn-salvar-funcionario').onclick = async () => {
        const nome = $('func_nome').value.trim();
        if(!nome) return alert('Informe o nome do funcionário.');
        const payload = {
            id: $('func_id').value || undefined,
            nome,
            cargo: $('func_cargo').value.trim() || null,
            telefone: $('func_telefone').value.trim() || null,
            email: $('func_email').value.trim() || null,
            salario: $('func_salario').value ? parseFloat($('func_salario').value) : 0,
            data_admissao: $('func_admissao').value || null,
            observacoes: $('func_obs').value.trim() || null,
            ativo: $('func_ativo').value === 'true'
        };
        await Backend.salvarFuncionario(payload);
        closeModal('modal-funcionario');
        await Backend.getFuncionarios(true);
        renderFuncionarios(state.funcionarios);
    };
    if($('busca-funcionarios')) $('busca-funcionarios').onkeyup = () => renderFuncionarios(state.funcionarios);
    if($('filtro-funcionarios-ativo')) $('filtro-funcionarios-ativo').onchange = () => renderFuncionarios(state.funcionarios);

    // Relatórios
    if($('btnGerarRelatorio')) $('btnGerarRelatorio').onclick = () => renderRelatorios();
    if($('rel_tipo')) $('rel_tipo').onchange = () => renderRelatorios();
    if($('rel_status')) $('rel_status').onchange = () => renderRelatorios();
    if($('rel_fornecedor')) $('rel_fornecedor').onchange = () => renderRelatorios();
    if($('rel_mes')) $('rel_mes').onchange = () => renderRelatorios();
    if($('rel_ano')) $('rel_ano').onchange = () => renderRelatorios();

    if($('btnPDFRelatorio')) $('btnPDFRelatorio').onclick = () => {
        const el = document.getElementById('relatorio-area');
        if(!el) return;
        const opt = { margin: 8, filename: 'relatorio.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        html2pdf().set(opt).from(el).save();
    };
});

    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));
    $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});

function initApp() { $('tela-login').style.display = 'none'; $('display-nome-usuario').innerText = state.user.nome || state.user.usuario || ''; navegar('dashboard'); }
>>>>>>> e790fa7 (atualização)

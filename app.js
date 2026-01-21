/* ==========================================================================
   CONFIGURAÇÃO SUPABASE
   ========================================================================== */
// OBS: As variáveis SUPABASE_URL e SUPABASE_KEY vêm do arquivo config.js

const _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const toast = (msg) => alert(msg);
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */
let state = {
    user: null,
    produtos: [],
    financeiro: [],
    notas: [],
    usuarios: [],
    grupos: [],
    route: 'dashboard',
    tipoFinanceiro: 'Despesa',
    
    // Auxiliares
    itensNotaManual: [], 
    produtoContagemSelecionado: null,
    itensContagem: [] 
};

/* ==========================================================================
   BACKEND
   ========================================================================== */
const Backend = {
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
        const { data, error } = await _db.from('notas_entrada').select('*').order('created_at', { ascending: false }).order('data', { ascending: false });
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
};

/* ==========================================================================
   NAVEGAÇÃO
   ========================================================================== */
async function navegar(modulo) {
    state.route = modulo;
    $('titulo-secao').innerText = modulo.toUpperCase().replace('_', ' ');

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('ativo'));
    const activeLi = document.querySelector(`[data-route="${modulo}"]`);
    if (activeLi) activeLi.classList.add('ativo');

    ['view-padrao', 'view-usuarios', 'view-funcionarios', 'view-fornecedores', 'view-produtos', 'view-configuracoes', 'view-notas-entrada', 'view-financeiro', 'view-relatorios']
      .forEach(v => { const el = $(v); if(el) el.style.display = 'none'; });
    
    if(modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if(modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        injetarControlesFinanceiros();
        renderFinanceiro(await Backend.getFinanceiro());
    } else if(modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if(modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        if(state.produtos.length === 0) await Backend.getProdutos();
        const _notas = await Backend.getNotas();
        _notas.sort((a,b) => (_toDate(b.created_at || b.data) - _toDate(a.created_at || a.data)));
        renderNotas(_notas);
    } else if(modulo === 'funcionarios') {
        const view = $('view-funcionarios');
        if(view) view.style.display = 'block';
    } else if(modulo === 'fornecedores') {
        const view = $('view-fornecedores');
        if(view) view.style.display = 'block';
    } else if(modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else if(modulo === 'relatorios') {
        const view = $('view-relatorios');
        if(view) view.style.display = 'block';
        await prepararRelatorios();
        renderRelatorios();
        aplicarFiltroRelatorioTipo();
    } else {
        $('view-padrao').style.display = 'block';
    }
}

/* ==========================================================================
   RELATÓRIOS
   ========================================================================== */
let chartDespStatus = null;
let chartDespFornecedor = null;

/* ========================================================================== 
   RELATÓRIOS
   ========================================================================== */
function _toDate(value) {
    if(!value) return null;
    if(typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00');
    return new Date(value);
}

async function prepararRelatorios() {
    // Garante dados carregados
    if(state.produtos.length === 0) await Backend.getProdutos();
    if(state.financeiro.length === 0) await Backend.getFinanceiro();
    if(state.notas.length === 0) await Backend.getNotas();

    const selMes = $('rel_mes');
    const selAno = $('rel_ano');
    if(!selMes || !selAno) return;

    if(selMes.options.length === 0) {
        const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        selMes.innerHTML = meses.map((m, idx) => `<option value="${idx+1}">${m}</option>`).join('');

        const anoAtual = new Date().getFullYear();
        const anos = [];
        for(let a = anoAtual - 4; a <= anoAtual + 1; a++) anos.push(a);
        selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');

        selMes.value = String(new Date().getMonth() + 1);
        selAno.value = String(anoAtual);
    }
    // Popula filtro de fornecedor (com base no financeiro)
    const selForn = $('rel_fornecedor');
    if(selForn) {
        const atual = selForn.value || 'todos';
        const fornecedores = Array.from(new Set((state.financeiro || [])
            .map(i => (i.fornecedor || '').trim())
            .filter(Boolean)))
            .sort((a,b) => a.localeCompare(b, 'pt-BR', { sensitivity:'base' }));

        selForn.innerHTML = `<option value="todos">Todos Fornecedores</option>` + fornecedores.map(f => 
            `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`
        ).join('');

        if(fornecedores.includes(atual)) selForn.value = atual;
        else selForn.value = 'todos';
    }

}


function renderRelatorios() {
    const selMes = $('rel_mes');
    const selAno = $('rel_ano');
    const mes = parseInt(selMes?.value || (new Date().getMonth() + 1), 10);
    const ano = parseInt(selAno?.value || new Date().getFullYear(), 10);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1); // exclusivo

    const finPeriodo = (state.financeiro || []).filter(f => {
        const d = _toDate(f.data_vencimento);
        return d && d >= inicio && d < fim;
    });

    const notasPeriodo = (state.notas || []).filter(n => {
        const d = _toDate(n.data);
        return d && d >= inicio && d < fim;
    });


    // Filtros do Relatório
    const filtroStatus = ($('rel_status')?.value || 'todos');
    const filtroFornecedor = ($('rel_fornecedor')?.value || 'todos');

    let finFiltrado = finPeriodo.slice();
    if (filtroStatus !== 'todos') {
        finFiltrado = finFiltrado.filter(i => (i.status || '').toLowerCase() === filtroStatus.toLowerCase());
    }
    if (filtroFornecedor !== 'todos') {
        finFiltrado = finFiltrado.filter(i => (i.fornecedor || '') === filtroFornecedor);
    }

    let notasFiltradas = notasPeriodo.slice();
    if (filtroFornecedor !== 'todos') {
        notasFiltradas = notasFiltradas.filter(n => (n.fornecedor || '') === filtroFornecedor);
    }

    // Totais financeiro
    let receitas = 0, despesas = 0;
    finFiltrado.forEach(i => {
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
    if($('rel-notas')) $('rel-notas').innerText = String(notasFiltradas.length);

    // Gráficos (Despesas)
    renderGraficosDespesas(finFiltrado);


    // Tabela financeiro
    const corpoFin = $('rel-financeiro-corpo');
    if(corpoFin) {
        const linhas = finFiltrado
            .sort((a,b) => (_toDate(b.data_vencimento) - _toDate(a.data_vencimento)))
            .slice(0, 200)
            .map(i => {
                const cor = i.tipo === 'Receita' ? '#27ae60' : '#e74c3c';
                return `<tr>
                  <td>${safeDate(i.data_vencimento)}</td>
                  <td>${i.descricao || ''}<br><small>${i.fornecedor || ''}</small></td>
                  <td><span style="color:${cor}">${i.tipo}</span></td>
                  <td style="color:${cor}"><b>${money(i.valor)}</b></td>
                  <td>${i.status || ''}</td>
                </tr>`;
            }).join('');

        corpoFin.innerHTML = linhas || `<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum lançamento no período</td></tr>`;
    }

    // Tabela notas
    const corpoNotas = $('rel-notas-corpo');
    if(corpoNotas) {
        const linhas = notasFiltradas
            .sort((a,b) => (_toDate(b.data) - _toDate(a.data)))
            .slice(0, 200)
            .map(n => `<tr>
              <td>${safeDate(n.data)}</td>
              <td>${n.numero || '-'}</td>
              <td>${n.fornecedor || '-'}</td>
              <td>${n.qtd_itens || 0}</td>
              <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
              <td><small>${n.tipo || 'Manual'}</small></td>
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
          <td><b>${p.codigo}</b></td>
          <td>${p.nome}</td>
          <td>${p.grupo || '-'}</td>
          <td><b>${p.qtd}</b></td>
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:#999;">Sem produtos</td></tr>`;
    }
}


function renderGraficosDespesas(listaFinanceiroFiltrada) {
    try {
        if(typeof Chart === 'undefined') return;

        const lista = Array.isArray(listaFinanceiroFiltrada) ? listaFinanceiroFiltrada : [];
        const despesas = lista.filter(i => (i.tipo || '').toLowerCase() === 'despesa');

        // Despesas por Status (Pago x Pendente)
        let pago = 0, pendente = 0, outros = 0;
        despesas.forEach(i => {
            const v = parseFloat(i.valor || 0) || 0;
            const st = (i.status || '').toLowerCase();
            if(st === 'pago') pago += v;
            else if(st === 'pendente') pendente += v;
            else outros += v;
        });

        const ctx1 = $('chart-desp-status')?.getContext?.('2d');
        if(ctx1) {
            if(chartDespStatus) chartDespStatus.destroy();
            chartDespStatus = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['Pago', 'Pendente', 'Outros'],
                    datasets: [{
                        data: [pago, pendente, outros]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        // Despesas por Fornecedor (Top 10)
        const mapa = {};
        despesas.forEach(i => {
            const forn = (i.fornecedor || 'Sem fornecedor').trim() || 'Sem fornecedor';
            const v = parseFloat(i.valor || 0) || 0;
            mapa[forn] = (mapa[forn] || 0) + v;
        });

        const pares = Object.entries(mapa).sort((a,b) => b[1]-a[1]).slice(0, 10);
        const labels = pares.map(p => p[0]);
        const valores = pares.map(p => p[1]);

        const ctx2 = $('chart-desp-forn')?.getContext?.('2d');
        if(ctx2) {
            if(chartDespFornecedor) chartDespFornecedor.destroy();
            chartDespFornecedor = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Total (R$)',
                        data: valores
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { callback: (val) => money(val) } }
                    }
                }
            });
        }
    } catch(e) {
        console.warn('Erro ao gerar gráficos:', e);
    }
}

function aplicarFiltroRelatorioTipo() {
    const tipo = ($('rel_tipo')?.value || 'todos').toLowerCase();

    const secResumo = $('rel-sec-resumo');
    const secGraficos = $('rel-sec-graficos');
    const cardsEst = $('rel-cards-estoque');

    const secFin = $('rel-sec-financeiro');
    const secNotas = $('rel-sec-notas');
    const secBaixo = $('rel-sec-baixo-estoque');

    const show = (el, yes) => { if(el) el.style.display = yes ? 'block' : 'none'; };

    // padrão: tudo visível
    show(secResumo, true);
    show(secGraficos, true);
    show(cardsEst, true);
    show(secFin, true);
    show(secNotas, true);
    show(secBaixo, true);

    if(tipo === 'todos') return;

    if(tipo === 'resumo') {
        show(secFin, false);
        show(secNotas, false);
        show(secBaixo, false);
        return;
    }

    if(tipo === 'financeiro') {
        show(secResumo, false);
        show(secGraficos, false);
        show(cardsEst, false);
        show(secNotas, false);
        show(secBaixo, false);
        return;
    }

    if(tipo === 'notas') {
        show(secGraficos, false);
        show(secFin, false);
        show(secBaixo, false);
        return;
    }

    if(tipo === 'estoque') {
        show(secResumo, false);
        show(secGraficos, false);
        show(secFin, false);
        show(secNotas, false);
        show(secBaixo, true);
        return;
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
        <td>${safeDate(n.data)}</td>
        <td>${n.numero || '-'}</td>
        <td>${n.fornecedor || '-'}</td>
        <td>${n.qtd_itens || 0}</td>
        <td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo || 'Manual'}</small></td>
        <td>
            <span class="material-icons" style="cursor:pointer; margin-right:8px;" onclick="editarNota('${n.id}')">edit</span>
            <span class="material-icons" style="color:red; cursor:pointer" onclick="delNota('${n.id}')">delete</span>
        </td>
    </tr>`).join('');
}

function renderProdutos(lista) {
    const termo = $('barra-pesquisa').value.toLowerCase();
    const grp = $('filtro-grupo').value;
    const filtrado = lista.filter(p => (p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo)) && (grp === "" || p.grupo === grp));
    let totalQtd = 0, totalValor = 0;
    $('tabela-produtos-corpo').innerHTML = filtrado.map(p => {
        totalQtd += p.qtd; totalValor += (p.qtd * p.preco);
        return `<tr>
            <td><b>${p.codigo}</b></td><td>${p.nome}</td><td>${p.grupo}</td><td>${p.qtd}</td>
            <td style="color:#27ae60"><b>${money(p.preco)}</b></td>
            <td>
                <span class="material-icons" onclick="editarProd('${p.id}')" style="cursor:pointer; margin-right:5px;">edit</span>
                <span class="material-icons" style="color:red; cursor:pointer" onclick="delProd('${p.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
    $('resumo-qtd').innerText = totalQtd; $('resumo-valor').innerText = money(totalValor);
}

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
    try {
        await Backend.salvarNota(novaNota);
        if(!novaNota.id && state.itensNotaManual.length > 0) {
            try { await Backend.processarEntradaEstoque(state.itensNotaManual); } catch(e) { console.error("Erro estoque", e); }
        }
        closeModal('modal-nota-manual'); 
        alert('Nota salva com sucesso!'); 
        navegar('notas_entrada');
    } catch (err) { alert('Erro ao salvar nota: ' + err.message); }
    btn.disabled = false; btn.innerText = "Salvar Nota Completa";
};
window.editarNota = (id) => {
    const n = state.notas.find(x => x.id == id); if(!n) return;
    $('nota_is_edit').value = 'true'; $('nota_id_edicao').value = n.id; $('titulo-modal-nota').innerText = `Editar Nota ${n.numero}`;
    $('nota_numero').value = n.numero; $('nota_data').value = n.data; $('nota_fornecedor').value = n.fornecedor;
    state.itensNotaManual = n.itens_json || []; renderItensNotaManual(); 
    $('modal-nota-manual').style.display = 'block';
    injetarBotaoFinanceiroNaNota();
};
window.delNota = async (id) => { if(confirm('Excluir?')) { await Backend.excluirNota(id); navegar('notas_entrada'); } };

// --- FINANCEIRO (Criação e Edição) ---
function injetarCamposParcelamento() {
    const form = $('form-financeiro-manual'); if(!form) return;
    if(document.getElementById('check_parcelado')) return;
    const div = document.createElement('div');
    div.innerHTML = `
        <div style="margin:10px 0; padding:10px; background:#f8f9fa; border:1px solid #ddd; border-radius:5px;">
            <label style="display:flex; align-items:center; cursor:pointer; font-weight:bold;">
                <input type="checkbox" id="check_parcelado" style="margin-right:8px;"> Habilitar Parcelamento?
            </label>
            <div id="area-parcelas" style="display:none; margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;">
                <label>Qtd Parcelas:</label>
                <input type="number" id="fin_man_qtd_parc" value="1" min="1" style="width:60px; padding:5px; margin-left:5px;">
                <div id="container-parcelas-geradas" style="margin-top:10px; max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:5px;"></div>
            </div>
        </div>
    `;
    const btnSalvar = $('btn-salvar-fin-manual');
    if(btnSalvar) form.insertBefore(div, btnSalvar.parentElement); else form.appendChild(div);
    $('check_parcelado').onchange = () => { const checked = $('check_parcelado').checked; $('area-parcelas').style.display = checked ? 'block' : 'none'; if(checked) gerarParcelasVisuais(); };
    $('fin_man_qtd_parc').onchange = gerarParcelasVisuais;
}

$('btnNovaDespesa').onclick = () => { 
    injetarCamposParcelamento();
    $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; 
    $('container-parcelas-geradas').innerHTML = ''; $('area-parcelas').style.display = 'none';
    $('modal-nova-despesa').style.display = 'block'; 
};
$('opt-despesa').onclick = () => { state.tipoFinanceiro='Despesa'; $('opt-despesa').classList.add('selected'); $('opt-receita').classList.remove('selected'); };
$('opt-receita').onclick = () => { state.tipoFinanceiro='Receita'; $('opt-receita').classList.add('selected'); $('opt-despesa').classList.remove('selected'); };

window.gerarParcelasVisuais = () => {
    const container = $('container-parcelas-geradas'); if(!container) return; container.innerHTML = ""; 
    const qtd = parseInt($('fin_man_qtd_parc').value) || 1;
    const valorTotal = parseFloat($('fin_man_valor').value) || 0;
    const dataInicial = $('fin_man_vencimento').value ? new Date($('fin_man_vencimento').value) : new Date();
    dataInicial.setMinutes(dataInicial.getMinutes() + dataInicial.getTimezoneOffset());
    const valorParcela = (valorTotal / qtd).toFixed(2);
    for(let i=0; i<qtd; i++) {
        let novaData = new Date(dataInicial); novaData.setMonth(novaData.getMonth() + i);
        const dataStr = novaData.toISOString().split('T')[0];
        container.innerHTML += `<div style="display:flex; gap:5px; align-items:center;"><span style="font-size:12px; width:25px;">${i+1}x</span><input type="date" class="parc-data" value="${dataStr}" style="flex:1; padding:5px;"><input type="number" class="parc-valor" value="${valorParcela}" style="width:80px; padding:5px;"></div>`;
    }
};
$('fin_man_vencimento').onchange = gerarParcelasVisuais; $('fin_man_valor').onkeyup = gerarParcelasVisuais;

window.editarFin = (id) => {
    injetarCamposParcelamento();
    const item = state.financeiro.find(x => x.id == id); if(!item) return;
    if(!document.getElementById('fin_man_id')) { const inputId = document.createElement('input'); inputId.type = 'hidden'; inputId.id = 'fin_man_id'; $('form-financeiro-manual').appendChild(inputId); }
    $('fin_man_id').value = item.id; $('fin_man_valor').value = item.valor; $('fin_man_descricao').value = item.descricao;
    $('fin_man_fornecedor').value = item.fornecedor; $('fin_man_emissao').value = item.data_emissao; $('fin_man_vencimento').value = item.data_vencimento; $('fin_man_status').value = item.status;
    if(item.tipo === 'Receita') $('opt-receita').click(); else $('opt-despesa').click();
    $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none'; $('modal-nova-despesa').style.display = 'block';
};

/* --- CORREÇÃO PRINCIPAL AQUI --- */
$('btn-salvar-fin-manual').onclick = async (e) => {
    e.preventDefault();
    injetarCamposParcelamento(); // Garante que a caixa de parcelas existe para verificação
    
    const isEdit = $('fin_man_id') && $('fin_man_id').value !== "";
    const checkboxParcelado = document.getElementById('check_parcelado');
    // Verifica se checkbox existe e está marcado
    const isParcelado = checkboxParcelado && checkboxParcelado.checked && !isEdit; 
    
    const dadosBase = { tipo: state.tipoFinanceiro, descricao: $('fin_man_descricao').value, fornecedor: $('fin_man_fornecedor').value, data_emissao: $('fin_man_emissao').value, status: $('fin_man_status').value };

    if(isEdit) {
        dadosBase.id = $('fin_man_id').value; dadosBase.valor = parseFloat($('fin_man_valor').value); dadosBase.data_vencimento = $('fin_man_vencimento').value;
        await Backend.salvarFinanceiro(dadosBase);
    } else {
        if(isParcelado) {
            // Garante que as parcelas visuais estão lá
            const container = $('container-parcelas-geradas');
            if(!container || container.innerHTML.trim() === "") {
                gerarParcelasVisuais(); // Força gerar se estiver vazio
            }
            
            const inputsData = document.querySelectorAll('.parc-data'); 
            const inputsValor = document.querySelectorAll('.parc-valor'); 
            const lista = [];
            
            inputsData.forEach((inp, idx) => { 
                lista.push({ 
                    ...dadosBase, 
                    descricao: `${dadosBase.descricao} (${idx+1}/${inputsData.length})`, 
                    data_vencimento: inp.value, 
                    valor: parseFloat(inputsValor[idx].value) 
                }); 
            });
            
            if(lista.length > 0) {
                await Backend.salvarFinanceiroLote(lista); 
            } else {
                alert("Erro ao gerar parcelas. Tente novamente.");
                return;
            }
        } else {
            // Salvar normal (único)
            dadosBase.valor = parseFloat($('fin_man_valor').value); 
            dadosBase.data_vencimento = $('fin_man_vencimento').value;
            await Backend.salvarFinanceiro(dadosBase);
        }
    }
    closeModal('modal-nova-despesa'); navegar('financeiro');
};
window.delFin = async (id) => { if(confirm('Excluir?')) { await Backend.excluirFinanceiro(id); navegar('financeiro'); } };


// --- FLUXO NOTA -> FINANCEIRO ---
function preencherFinanceiroComNota(nota) {
    injetarCamposParcelamento();
    $('form-financeiro-manual').reset(); $('fin_man_id').value = ''; 
    const container = $('container-parcelas-geradas'); if(container) container.innerHTML = '';
    
    $('opt-despesa').click();
    $('fin_man_fornecedor').value = nota.fornecedor;
    $('fin_man_descricao').value = `Ref. Nota ${nota.numero}`;
    $('fin_man_emissao').value = new Date().toISOString().split('T')[0];
    $('fin_man_status').value = 'Pendente';
    
    if(nota.parcelas_xml && nota.parcelas_xml.length > 0) {
        $('fin_man_valor').value = nota.valor; $('check_parcelado').checked = true; $('area-parcelas').style.display = 'block'; $('fin_man_qtd_parc').value = nota.parcelas_xml.length;
        gerarParcelasVisuais();
        setTimeout(() => {
            const inputsData = document.querySelectorAll('.parc-data'); const inputsValor = document.querySelectorAll('.parc-valor');
            nota.parcelas_xml.forEach((p, idx) => { if(inputsData[idx]) inputsData[idx].value = p.vencimento; if(inputsValor[idx]) inputsValor[idx].value = p.valor; });
        }, 100);
    } else {
        $('fin_man_valor').value = nota.valor; const hoje = new Date(); hoje.setDate(hoje.getDate() + 30); $('fin_man_vencimento').valueAsDate = hoje;
        $('check_parcelado').checked = false; $('area-parcelas').style.display = 'none';
    }
    $('modal-nova-despesa').style.display = 'block';
}

// --- CONTAGEM ---
$('btnAbrirContagem').onclick = () => { state.itensContagem = []; state.produtoContagemSelecionado = null; $('lista-contagem-corpo').innerHTML = ''; $('msg-vazio-contagem').style.display = 'block'; $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; $('obs-contagem').value = ''; $('modal-contagem').style.display = 'block'; };
$('input-busca-contagem').onkeyup = () => {
    const termo = $('input-busca-contagem').value.toLowerCase(); const lista = $('lista-sugestoes-contagem'); lista.innerHTML = '';
    if(termo.length < 1) { lista.style.display = 'none'; return; }
    const enc = state.produtos.filter(p => p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo));
    if(enc.length > 0) { lista.style.display = 'block'; lista.innerHTML = enc.map(p => `<li onclick="selecionarProdutoContagem('${p.id}')"><strong>${p.nome}</strong> <small>(${p.codigo}) | ${p.qtd}</small></li>`).join(''); } else lista.style.display = 'none';
};
window.selecionarProdutoContagem = (id) => { const p = state.produtos.find(x => x.id == id); if(p) { state.produtoContagemSelecionado = p; $('input-busca-contagem').value = p.nome; $('lista-sugestoes-contagem').style.display = 'none'; $('input-qtd-contagem').disabled = false; $('btn-add-contagem').disabled = false; $('input-qtd-contagem').focus(); } };
$('btn-add-contagem').onclick = () => {
    if(!state.produtoContagemSelecionado) return; const qtd = parseFloat($('input-qtd-contagem').value); if(isNaN(qtd)) return alert("Informe a quantidade.");
    const p = state.produtoContagemSelecionado; const diff = qtd - p.qtd; const cor = diff > 0 ? 'green' : (diff < 0 ? 'red' : 'gray'); const sinal = diff > 0 ? '+' : '';
    $('msg-vazio-contagem').style.display = 'none';
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.nome}</td><td>${p.qtd}</td><td style="font-weight:bold;background:#fff3cd;">${qtd}</td><td style="color:${cor};font-weight:bold;">${sinal}${diff}</td><td><span class="material-icons" style="color:red;cursor:pointer;" onclick="removerItemContagem(this, '${p.id}')">delete</span></td>`;
    $('lista-contagem-corpo').appendChild(tr);
    state.itensContagem.push({ id: p.id, novaQtd: qtd });
    $('input-busca-contagem').value = ''; $('input-qtd-contagem').value = ''; $('input-qtd-contagem').disabled = true; $('btn-add-contagem').disabled = true; state.produtoContagemSelecionado = null; $('input-busca-contagem').focus();
};
window.removerItemContagem = (btn, id) => { btn.closest('tr').remove(); state.itensContagem = state.itensContagem.filter(i => i.id != id); if(state.itensContagem.length === 0) $('msg-vazio-contagem').style.display = 'block'; };
$('btnSalvarContagem').onclick = async () => { if(state.itensContagem.length === 0) return alert("Vazio."); const btn = $('btnSalvarContagem'); btn.disabled = true; btn.innerText = "Processando..."; try { await Backend.atualizarEstoqueBatch(state.itensContagem); alert("Sucesso!"); closeModal('modal-contagem'); navegar('produtos'); } catch(e) { alert(e.message); } btn.disabled = false; btn.innerText = "Concluir"; };

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
    const sess = localStorage.getItem('sess_gestao'); if(sess) { state.user = JSON.parse(sess); initApp(); }
    $('btnLogin').onclick = async () => { const u = await Backend.login($('usuario').value, $('senha').value); if(u) { state.user = u; localStorage.setItem('sess_gestao', JSON.stringify(u)); initApp(); } else $('msg-erro').innerText = 'Erro login'; };
    $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };
    document.querySelectorAll('.close').forEach(b => b.onclick = function() { this.closest('.modal').style.display='none'; });
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));
    $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
    $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);

    // --- RELATÓRIOS ---
    if($('btnGerarRelatorio')) $('btnGerarRelatorio').onclick = async () => { await prepararRelatorios(); renderRelatorios(); aplicarFiltroRelatorioTipo(); };
    if($('rel_mes')) $('rel_mes').onchange = () => { renderRelatorios(); aplicarFiltroRelatorioTipo(); };
    if($('rel_ano')) $('rel_ano').onchange = () => { renderRelatorios(); aplicarFiltroRelatorioTipo(); };
    if($('rel_tipo')) $('rel_tipo').onchange = () => aplicarFiltroRelatorioTipo();
    if($('rel_status')) $('rel_status').onchange = () => { renderRelatorios(); aplicarFiltroRelatorioTipo(); };
    if($('rel_fornecedor')) $('rel_fornecedor').onchange = () => { renderRelatorios(); aplicarFiltroRelatorioTipo(); };
    if($('btnPDFRelatorio')) $('btnPDFRelatorio').onclick = () => {
        const area = $('relatorio-area');
        if(!area) return;
        const mes = $('rel_mes')?.value || String(new Date().getMonth() + 1);
        const ano = $('rel_ano')?.value || String(new Date().getFullYear());
        html2pdf().set({ margin: 10, filename: `relatorio_${mes}-${ano}.pdf` }).from(area).save();
    };
});

function initApp() { $('tela-login').style.display = 'none'; $('tela-dashboard').style.display = 'flex'; $('display-nome-usuario').innerText = state.user.nome; navegar('dashboard'); }
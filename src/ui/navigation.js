import { $ } from '../utils/dom.js';
import { money } from '../utils/format.js';
import { state } from '../state.js';
import { Backend } from '../services/backend.js';
async function navegar(modulo) {
    state.route = modulo;
    $('titulo-secao').innerText = modulo.toUpperCase().replace('_', ' ');

    // Mobile: fecha o menu ao navegar
    const dash = document.getElementById('tela-dashboard');
    if (dash) dash.classList.remove('sidebar-open');

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('ativo'));
    const activeLi = document.querySelector(`[data-route="${modulo}"]`);
    if (activeLi) activeLi.classList.add('ativo');

    // Esconde todas as views
    ['view-padrao', 'view-usuarios', 'view-produtos', 'view-configuracoes', 'view-notas-entrada',
        'view-financeiro', 'view-relatorios', 'view-funcionarios', 'view-fornecedores', 'view-apontamento'].forEach(v => {
        const el = $(v); if (el) el.style.display = 'none';
    });

    if (modulo === 'produtos') {
        $('view-produtos').style.display = 'block';
        renderProdutos(await Backend.getProdutos());
        updateGrupoSelects();
    } else if (modulo === 'financeiro') {
        $('view-financeiro').style.display = 'block';
        injetarControlesFinanceiros();
        renderFinanceiro(await Backend.getFinanceiro());
    } else if (modulo === 'apontamento') {
        $('view-apontamento').style.display = 'block';
        try {
            const { prepararApontamento } = await import('./apontamento.js');
            await prepararApontamento();
        } catch (e) {
            console.error('Erro ao carregar apontamento:', e);
            alert('Erro ao carregar apontamento: ' + (e?.message || e));
        }
    } else if (modulo === 'usuarios') {
        $('view-usuarios').style.display = 'block';
        renderUsuarios(await Backend.getUsuarios());
    } else if (modulo === 'notas_entrada') {
        $('view-notas-entrada').style.display = 'block';
        if (state.produtos.length === 0) await Backend.getProdutos();
        renderNotas(await Backend.getNotas());
    } else if (modulo === 'configuracoes') {
        $('view-configuracoes').style.display = 'block';
        renderGrupos(await Backend.getGrupos());
    } else if (modulo === 'relatorios') {
        $('view-relatorios').style.display = 'block';
        try {
            const { prepararRelatorios, renderRelatorios, aplicarFiltroRelatorioTipo } = await import('./relatorios.js');
            await prepararRelatorios();
            renderRelatorios();
            aplicarFiltroRelatorioTipo();
        } catch (e) {
            console.error('Erro ao carregar relatórios:', e);
            alert('Erro ao carregar relatórios: ' + (e?.message || e));
        }
    } else if (modulo === 'funcionarios') {
        $('view-funcionarios').style.display = 'block';
        renderFuncionarios(await Backend.getFuncionarios());
    } else if (modulo === 'fornecedores') {
        $('view-fornecedores').style.display = 'block';
        renderFornecedores(await Backend.getFornecedores());
    } else {
        $('view-padrao').style.display = 'block';
    }
}

// ==========================================================================
// RENDERIZAÇÃO
// ==========================================================================
function safeDate(dateStr) {
    if (!dateStr) return "-";
    if (dateStr.length === 10) return new Date(dateStr + 'T00:00:00').toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
}

function renderNotas(lista) {
    const tbody = $('tabela-notas-corpo'); if (!tbody) return;
    tbody.innerHTML = lista.map(n => `<tr>
        <td>${safeDate(n.data)}</td><td>${n.numero || '-'}</td><td>${n.fornecedor || '-'}</td>
        <td>${n.qtd_itens || 0}</td><td style="color:#27ae60"><b>${money(n.valor)}</b></td>
        <td><small>${n.tipo || 'Manual'}</small></td>
        <td><span class="material-icons" style="cursor:pointer; margin-right:8px;" onclick="editarNota('${n.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delNota('${n.id}')">delete</span></td>
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
            <td><span class="material-icons" onclick="editarProd('${p.id}')" style="cursor:pointer; margin-right:5px;">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delProd('${p.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('resumo-qtd').innerText = totalQtd; $('resumo-valor').innerText = money(totalValor);
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
    if (theadRow && !theadRow.querySelector('.th-check')) {
        const th = document.createElement('th'); th.className = 'th-check'; th.width = '30px';
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
            <td><span style="padding:4px 8px; border-radius:4px; background:${isPago ? '#dff9fb' : '#ffeaa7'}; color:${isPago ? '#2c3e50' : '#d35400'}; font-size:12px;">${i.status}</span></td>
            <td><span class="material-icons" style="cursor:pointer; margin-right:5px; color:#666;" onclick="editarFin('${i.id}')">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delFin('${i.id}')">delete</span></td>
        </tr>`;
    }).join('');
    $('fin-total-receitas').innerText = money(rec); $('fin-total-despesas').innerText = money(desp); $('fin-saldo').innerText = money(rec - desp);
    checkFinChanged();
}
function injetarControlesFinanceiros() {
    if (document.getElementById('filtro-status-fin')) return;
    const toolbar = document.querySelector('#view-financeiro .filters');
    if (toolbar) {
        const select = document.createElement('select'); select.id = 'filtro-status-fin';
        select.innerHTML = '<option value="">Todos Status</option><option value="Pendente">Pendente</option><option value="Pago">Pago</option>';
        select.style.padding = '10px'; select.style.borderRadius = '5px'; select.style.border = '1px solid #ddd'; select.style.marginLeft = '10px';
        select.onchange = async () => renderFinanceiro(state.financeiro);
        toolbar.appendChild(select);
    }
    // botão de baixa em lote (pode variar a estrutura do HTML)
    if (!document.getElementById('btn-baixa-lote')) {
        const toolbarContainer = document.querySelector('#view-financeiro .toolbar');
        if (toolbarContainer) {
            // se existir wrapper interno (<div>), usa o último; senão usa o próprio container
            const inner = toolbarContainer.querySelectorAll(':scope > div');
            const target = (inner && inner.length) ? inner[inner.length - 1] : toolbarContainer;

            const btnBatch = document.createElement('button');
            btnBatch.id = 'btn-baixa-lote';
            btnBatch.className = 'btn-action';
            btnBatch.innerHTML = '<span class="material-icons">done_all</span> Baixar Selecionados';
            btnBatch.style.backgroundColor = '#27ae60';
            btnBatch.style.display = 'none';
            btnBatch.onclick = realizarBaixaEmLote;

            target.insertBefore(btnBatch, target.firstChild);
        }
    }
}
window.toggleAllFin = (source) => { document.querySelectorAll('.check-fin').forEach(c => c.checked = source.checked); checkFinChanged(); };
window.checkFinChanged = () => { const selecionados = document.querySelectorAll('.check-fin:checked').length; const btn = $('btn-baixa-lote'); if (btn) btn.style.display = selecionados > 0 ? 'flex' : 'none'; };
async function realizarBaixaEmLote() {
    const ids = Array.from(document.querySelectorAll('.check-fin:checked')).map(c => c.value); if (ids.length === 0) return;
    if (!confirm(`Deseja marcar ${ids.length} itens como PAGO?`)) return;
    try { await Backend.baixarLote(ids); alert('Baixa realizada com sucesso!'); renderFinanceiro(await Backend.getFinanceiro()); } catch (e) { alert('Erro: ' + e.message); }
}

// RENDER USUARIOS, GRUPOS E NOVOS MÓDULOS
function renderUsuarios(lista) { $('tabela-usuarios-corpo').innerHTML = lista.map(u => `<tr><td>${u.nome}</td><td>${u.usuario}</td><td>${u.perfil}</td><td><span class="material-icons" onclick="editUser('${u.id}')" style="cursor:pointer">edit</span><span class="material-icons" style="color:red; cursor:pointer" onclick="delUser('${u.id}')">delete</span></td></tr>`).join(''); }
function renderGrupos(lista) { $('tabela-config-grupos').innerHTML = lista.map(g => `<tr><td>${g}</td><td><span class="material-icons" style="color:red; cursor:pointer" onclick="delGrupo('${g}')">delete</span></td></tr>`).join(''); }
function updateGrupoSelects(grupos = state.grupos) {
    // Atualiza selects de Grupo (Produtos)
    const filtro = document.getElementById('filtro-grupo');
    if (filtro) {
        const cur = filtro.value || '';
        filtro.innerHTML = '<option value="">Todos Grupos</option>' + (grupos || []).map(g => `<option value="${g}">${g}</option>`).join('');
        filtro.value = cur; // tenta manter seleção
    }

    const selProduto = document.getElementById('prod_grupo');
    if (selProduto) {
        const cur = selProduto.value || '';
        selProduto.innerHTML = (grupos || []).map(g => `<option value="${g}">${g}</option>`).join('');
        if (cur) selProduto.value = cur;
    }
}

function renderFuncionarios(lista) {
    if (!lista || lista.length === 0) {
        $('tabela-funcionarios-corpo').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum funcionário encontrado.</td></tr>';
        return;
    }

    $('tabela-funcionarios-corpo').innerHTML = lista.map(f => {
        const doc = f.cpf ?? f.documento ?? f.cnpj_cpf ?? f.doc ?? '-';
        return `<tr>
            <td>${f.nome ?? ''}</td>
            <td>${f.cargo ?? ''}</td>
            <td>${f.telefone ?? ''}</td>
            <td>${doc}</td>
            <td>
              <span class="material-icons" onclick="editarFunc('${f.id}')" style="cursor:pointer">edit</span>
              <span class="material-icons" style="color:red; cursor:pointer" onclick="delFunc('${f.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
}

function renderFornecedores(lista) {
    if (!lista || lista.length === 0) {
        $('tabela-fornecedores-corpo').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum fornecedor encontrado.</td></tr>';
        return;
    }

    $('tabela-fornecedores-corpo').innerHTML = lista.map(f => {
        const doc = f.documento ?? f.cnpj_cpf ?? f.cpf ?? f.cnpj ?? '-';
        return `<tr>
            <td>${f.nome ?? ''}</td>
            <td>${doc}</td>
            <td>${f.telefone ?? ''}</td>
            <td>${f.cidade ?? ''}</td>
            <td>
              <span class="material-icons" onclick="editarForn('${f.id}')" style="cursor:pointer">edit</span>
              <span class="material-icons" style="color:red; cursor:pointer" onclick="delForn('${f.id}')">delete</span>
            </td>
        </tr>`;
    }).join('');
}

// RELATORIOS
function _toDate(value) { if (!value) return null; if (typeof value === 'string' && value.length === 10) return new Date(value + 'T00:00:00'); return new Date(value); }

export { navegar, renderProdutos, renderFinanceiro, renderNotas, renderUsuarios, renderGrupos, renderFuncionarios, renderFornecedores, injetarControlesFinanceiros, realizarBaixaEmLote, updateGrupoSelects, safeDate };

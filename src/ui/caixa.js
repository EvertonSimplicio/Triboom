import { Backend } from '../services/backend.js';
import { state } from '../state.js';
import { money, localDateISO, toast } from '../utils/format.js';

// Mantém compatibilidade com o navigation.js
export async function prepararCaixa() {
  return true;
}

const $ = (id) => document.getElementById(id);

function getPerfil() {
  return (state.user?.perfil || '').toString().trim().toUpperCase();
}
function isAdmin() {
  const p = getPerfil();
  return p === 'ADMINISTRADOR' || p === 'ADMIN';
}

function parseValorBR(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // aceita 1.234,56 ou 1234.56
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

function toISODate(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (!v) return '';
  // input type="date" retorna YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // aceita DD/MM/YYYY
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}

async function carregarLista() {
  const dataISO = toISODate($('caixa-data')?.value);
  if (!dataISO) return;

  try {
    const lista = await Backend.getCaixaLancamentos({ dataISO });
    const tbody = $('caixa-tbody');
    if (!tbody) return;

    let entradas = 0;
    let saidas = 0;

    if (!lista || lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">Nenhum lançamento.</td></tr>`;
    } else {
      tbody.innerHTML = lista.map((l) => {
        const val = Number(l.valor || 0);
        if ((l.tipo || '').toLowerCase() === 'saida' || (l.tipo || '').toLowerCase() === 'saída') saidas += val;
        else entradas += val;

        return `
          <tr>
            <td>${l.data || ''}</td>
            <td>${l.sorveteria || ''}</td>
            <td>${l.tipo || ''}</td>
            <td>${l.forma || ''}</td>
            <td>${l.descricao || ''}</td>
            <td>${money(val)}</td>
            <td>
              <button class="btn-icon" data-del-caixa="${l.id}" title="Excluir">🗑</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    $('caixa-total-entradas').textContent = money(entradas);
    $('caixa-total-saidas').textContent = money(saidas);
    $('caixa-total-saldo').textContent = money(entradas - saidas);

    // handlers excluir
    tbody.querySelectorAll('[data-del-caixa]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-caixa');
        if (!id) return;
        if (!confirm('Excluir lançamento?')) return;
        try {
          await Backend.excluirCaixaLancamento(id);
          toast('Lançamento excluído.');
          await carregarLista();
        } catch (e) {
          console.error('[CAIXA] excluir erro', e);
          alert('Erro ao excluir lançamento.');
        }
      });
    });
  } catch (e) {
    console.error('[CAIXA] carregarLista erro', e);
    const tbody = $('caixa-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar lançamentos.</td></tr>`;
  }
}

function aplicarModo() {
  const chk = $('caixa-modo-lote');
  const box = $('caixa-lote-box');
  const singleGrid = $('caixa-tipo')?.closest('.form-grid');

  const isLote = !!chk?.checked;
  if (box) box.style.display = isLote ? 'block' : 'none';
  if (singleGrid) singleGrid.style.display = isLote ? 'none' : 'grid';
}

async function salvar() {
  const dataISO = toISODate($('caixa-data')?.value);
  if (!dataISO) return alert('Selecione a data.');
  const sorveteria = ($('caixa-sorveteria')?.value || '').toString().trim();
  if (!sorveteria) return alert('Informe a sorveteria.');

  const isLote = !!$('caixa-modo-lote')?.checked;

  try {
    if (isLote) {
      const obs = ($('caixa-observacao')?.value || '').toString().trim();
      const descricao = obs || 'Vendas do dia';

      const itens = [
        { id: 'caixa-lote-credito', forma: 'Cartão crédito' },
        { id: 'caixa-lote-debito', forma: 'Cartão débito' },
        { id: 'caixa-lote-pix', forma: 'Pix' },
        { id: 'caixa-lote-dinheiro', forma: 'Dinheiro' },
      ];

      const promises = [];
      for (const it of itens) {
        const val = parseValorBR($(it.id)?.value);
        if (val > 0) {
          promises.push(
            Backend.salvarCaixaLancamento({
              data: dataISO,
              sorveteria,
              tipo: 'Entrada',
              forma: it.forma,
              descricao,
              valor: val,
            })
          );
        }
      }

      if (promises.length === 0) {
        return alert('Informe ao menos um valor (crédito, débito, pix ou dinheiro).');
      }

      await Promise.all(promises);

      // limpa valores
      itens.forEach((it) => { if ($(it.id)) $(it.id).value = ''; });
      if ($('caixa-observacao')) $('caixa-observacao').value = '';

      toast('Vendas do dia salvas.');
    } else {
      const tipo = ($('caixa-tipo')?.value || '').toString().trim();
      const forma = ($('caixa-forma')?.value || '').toString().trim();
      const descricao = ($('caixa-descricao')?.value || '').toString().trim();
      const valor = parseValorBR($('caixa-valor')?.value);

      if (!tipo) return alert('Selecione o tipo.');
      if (!forma) return alert('Selecione a forma.');
      if (!descricao) return alert('Informe a descrição.');
      if (!valor || valor <= 0) return alert('Informe o valor.');

      await Backend.salvarCaixaLancamento({ data: dataISO, sorveteria, tipo, forma, descricao, valor });

      if ($('caixa-descricao')) $('caixa-descricao').value = '';
      if ($('caixa-valor')) $('caixa-valor').value = '';
      if ($('caixa-observacao')) $('caixa-observacao').value = '';

      toast('Lançamento salvo.');
    }

    await carregarLista();
  } catch (e) {
    console.error('[CAIXA] salvar erro', e);
    alert('Erro ao salvar lançamento.');
  }
}

export async function renderCaixa() {
  // Perfil: apenas Administrador pode usar o Caixa
  if (!isAdmin()) {
    toast('Acesso restrito: Caixa apenas para Administrador.');
    const tbody = $('caixa-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7">Acesso restrito.</td></tr>`;
    return;
  }

  // defaults
  const inpData = $('caixa-data');
  if (inpData && !inpData.value) inpData.value = localDateISO(new Date());

  // listeners
  if ($('btnCaixaSalvar')) $('btnCaixaSalvar').onclick = salvar;
  if ($('btnCaixaAtualizar')) $('btnCaixaAtualizar').onclick = carregarLista;

  if ($('caixa-modo-lote')) {
    $('caixa-modo-lote').addEventListener('change', aplicarModo);
  }

  aplicarModo();
  await carregarLista();
}

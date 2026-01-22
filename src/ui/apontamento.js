import { $ } from '../utils/dom.js';
import { state } from '../state.js';
import { Backend } from '../services/backend.js';

let _apontamentoInit = false;
let _apontamentoAtual = null;

function _localDateISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function _fmtHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function _setApStatus(msg) {
  const el = $('apontamento-status');
  if (el) el.innerText = msg || '';
}

function _isFuncionarioAtivo(f) {
  if (!f || typeof f !== 'object') return false;

  if (typeof f.ativo === 'boolean') return f.ativo;
  if (typeof f.active === 'boolean') return f.active;
  if (typeof f.habilitado === 'boolean') return f.habilitado;

  const status = (f.status ?? f.situacao ?? f.estado ?? '').toString().trim().toUpperCase();
  if (status) {
    if (['ATIVO', 'ATIVA', 'SIM', 'TRUE', '1'].includes(status)) return true;
    if (['INATIVO', 'INATIVA', 'NAO', 'NÃO', 'FALSE', '0'].includes(status)) return false;
  }

  return true; // se não existir coluna, assume ativo
}

function _normId(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return (/^\d+$/.test(s)) ? Number(s) : s;
}

function _setBtnsDisabled(yes) {
  ['btnApEntrada', 'btnApIntIni', 'btnApIntFim', 'btnApSaida'].forEach(id => {
    const b = $(id);
    if (b) b.disabled = !!yes;
  });
}

export async function prepararApontamento() {
  // garante funcionários carregados
  if (!state.funcionarios || state.funcionarios.length === 0) {
    await Backend.getFuncionarios();
  }

  const sel = $('apontamento-funcionario');
  if (!sel) return;

  sel.innerHTML = '';

  const funcionariosAtivos = (state.funcionarios || []).filter(_isFuncionarioAtivo);

  if (!funcionariosAtivos.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = 'Nenhum funcionário ativo cadastrado';
    sel.appendChild(opt);
    sel.disabled = true;
    _setBtnsDisabled(true);
    _setApStatus('Cadastre funcionários na tela Funcionários.');
    return;
  }

  const perfil = String(state.user?.perfil || '').toLowerCase();
  const isUser = (perfil === 'usuario');
  const myFunc = state.user?.funcionario_id;

  if (isUser) {
    // Funcionário: só pode lançar para si mesmo
    if (!myFunc) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'Usuário sem funcionário vinculado';
      sel.appendChild(opt);
      sel.disabled = true;
      _setBtnsDisabled(true);
      _setApStatus('Seu usuário não está vinculado a um funcionário. Peça ao Admin para vincular em Usuários.');
      return;
    }

    const f = funcionariosAtivos.find(x => String(x.id) === String(myFunc));
    if (!f) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'Funcionário vinculado inativo/inexistente';
      sel.appendChild(opt);
      sel.disabled = true;
      _setBtnsDisabled(true);
      _setApStatus('O funcionário vinculado está inativo (ou não existe). Peça ao Admin para ajustar.');
      return;
    }

    const opt = document.createElement('option');
    opt.value = f.id;
    opt.innerText = f.nome;
    sel.appendChild(opt);
    sel.value = f.id;
    sel.disabled = true;
    _setBtnsDisabled(false);
  } else {
    // Admin: lista todos ativos
    funcionariosAtivos.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.innerText = f.nome;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    _setBtnsDisabled(false);
  }

  $('apontamento-data').innerText = _localDateISO();

  if (!_apontamentoInit) {
    _apontamentoInit = true;

    sel.onchange = () => carregarApontamentoDia();
    $('btnApEntrada').onclick = () => acaoApontamento('entrada');
    $('btnApIntIni').onclick = () => acaoApontamento('intervalo_inicio');
    $('btnApIntFim').onclick = () => acaoApontamento('intervalo_fim');
    $('btnApSaida').onclick = () => acaoApontamento('saida');
  }

  await carregarApontamentoDia();
}

export async function carregarApontamentoDia() {
  const sel = $('apontamento-funcionario');
  const funcionarioId = _normId(sel?.value);
  if (!funcionarioId) return;

  const dataISO = _localDateISO();
  $('apontamento-data').innerText = dataISO;

  try {
    _setApStatus('Carregando...');
    const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);
    _apontamentoAtual = ap;

    $('apontamento-hora-entrada').innerText = _fmtHora(ap?.entrada);
    $('apontamento-hora-int-ini').innerText = _fmtHora(ap?.intervalo_inicio);
    $('apontamento-hora-int-fim').innerText = _fmtHora(ap?.intervalo_fim);
    $('apontamento-hora-saida').innerText = _fmtHora(ap?.saida);

    if (!ap) {
      _setApStatus('Nenhum registro hoje. Clique em “Entrada” para iniciar.');
    } else if (ap.saida) {
      _setApStatus('Turno finalizado hoje ✅');
    } else if (ap.intervalo_inicio && !ap.intervalo_fim) {
      _setApStatus('Em intervalo. Registre “Intervalo (fim)” para continuar.');
    } else if (ap.entrada && !ap.intervalo_inicio) {
      _setApStatus('Em trabalho. Se for pausar, registre “Intervalo (início)”, ou registre “Saída”.');
    } else if (ap.entrada && ap.intervalo_fim && !ap.saida) {
      _setApStatus('Intervalo finalizado. Registre “Saída” ao terminar.');
    } else {
      _setApStatus('');
    }
  } catch (e) {
    console.error(e);
    _setApStatus('Erro ao carregar apontamento: ' + (e?.message || ''));
  }
}

function _validarSequencia(ap, acao) {
  if (acao === 'entrada') return null;
  if (!ap) return 'Faça a Entrada primeiro.';

  if (acao === 'intervalo_inicio') {
    if (!ap.entrada) return 'Faça a Entrada primeiro.';
    if (ap.intervalo_inicio) return 'Intervalo (início) já registrado.';
    if (ap.saida) return 'Turno já finalizado.';
    return null;
  }

  if (acao === 'intervalo_fim') {
    if (!ap.intervalo_inicio) return 'Registre Intervalo (início) antes.';
    if (ap.intervalo_fim) return 'Intervalo (fim) já registrado.';
    if (ap.saida) return 'Turno já finalizado.';
    return null;
  }

  if (acao === 'saida') {
    if (!ap.entrada) return 'Faça a Entrada primeiro.';
    if (ap.saida) return 'Saída já registrada.';
    if (ap.intervalo_inicio && !ap.intervalo_fim) return 'Finalize o Intervalo (fim) antes da Saída.';
    return null;
  }

  return null;
}

async function acaoApontamento(acao) {
  const funcionarioId = _normId($('apontamento-funcionario')?.value);
  const obs = ($('apontamento-obs')?.value || '').trim();
  const dataISO = _localDateISO();
  if (!funcionarioId) return;

  try {
    _setApStatus('Salvando...');
    const agora = new Date().toISOString();

    // recarrega o dia para evitar conflito
    const ap = await Backend.getApontamentoDia(funcionarioId, dataISO);

    if (acao === 'entrada') {
      if (ap && ap.entrada && !ap.saida) {
        _setApStatus('Já existe um turno aberto hoje. Registre Intervalo/Saída nele.');
        _apontamentoAtual = ap;
        await carregarApontamentoDia();
        return;
      }
      if (ap && ap.saida) {
        _setApStatus('Turno já foi finalizado hoje. (Se precisar, ajuste no banco/relatório.)');
        _apontamentoAtual = ap;
        await carregarApontamentoDia();
        return;
      }

      const payload = {
        funcionario_id: funcionarioId,
        data: dataISO,
        entrada: agora,
        observacao: obs || null,
        usuario_id: _normId(state.user?.id),
      };

      const criado = await Backend.criarApontamento(payload);
      _apontamentoAtual = criado;
      _setApStatus('✅ Entrada registrada às ' + _fmtHora(criado.entrada));
      await carregarApontamentoDia();
      return;
    }

    const err = _validarSequencia(ap, acao);
    if (err) {
      _setApStatus('⚠️ ' + err);
      _apontamentoAtual = ap;
      await carregarApontamentoDia();
      return;
    }

    // não duplica
    if (ap && ap[acao]) {
      _setApStatus('⚠️ Este lançamento já foi feito hoje.');
      _apontamentoAtual = ap;
      await carregarApontamentoDia();
      return;
    }

    const patch = {};
    if (acao === 'intervalo_inicio') patch.intervalo_inicio = agora;
    if (acao === 'intervalo_fim') patch.intervalo_fim = agora;
    if (acao === 'saida') patch.saida = agora;
    if (obs) patch.observacao = obs;

    const atualizado = await Backend.atualizarApontamento(ap.id, patch);
    _apontamentoAtual = atualizado;

    const label = {
      intervalo_inicio: 'Intervalo (início)',
      intervalo_fim: 'Intervalo (fim)',
      saida: 'Saída',
    }[acao] || acao;

    _setApStatus('✅ ' + label + ' registrado às ' + _fmtHora(agora));
    await carregarApontamentoDia();
  } catch (e) {
    console.error(e);
    _setApStatus('❌ Erro ao salvar: ' + (e?.message || ''));
  }
}

import { $ } from './utils/dom.js';
import { state } from './state.js';
import { Backend } from './services/backend.js';
import { navegar, renderProdutos, renderFinanceiro } from './ui/navigation.js';
import { initModals } from './ui/modals.js';

function aplicarPermissoesUI() {
  const perfil = String(state.user?.perfil || '').toLowerCase();

  // Usuário (funcionário): só pode lançar apontamento
  if (perfil === 'usuario') {
    document.querySelectorAll('.sidebar li').forEach(li => {
      const r = (li.dataset.route || '').toLowerCase();
      li.style.display = (r === 'apontamento') ? 'flex' : 'none';
    });
  } else {
    document.querySelectorAll('.sidebar li').forEach(li => li.style.display = 'flex');
  }
}

function initApp() {
  $('tela-login').style.display = 'none';
  $('tela-dashboard').style.display = 'flex';
  $('display-nome-usuario').innerText = state.user.nome;

  aplicarPermissoesUI();

  const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
  if (isUser) navegar('apontamento');
  else navegar('dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  // Init handlers de formulários/modais
  initModals();

  const sess = localStorage.getItem('sess_gestao');
  if (sess) {
    state.user = JSON.parse(sess);
    initApp();
  }

  $('btnLogin').onclick = async () => {
    const msg = $('msg-erro');
    msg.innerText = '';
    try {
      const u = await Backend.login($('usuario').value, $('senha').value);
      if (u) {
        state.user = u;
        localStorage.setItem('sess_gestao', JSON.stringify(u));
        initApp();
      } else {
        msg.innerText = 'Usuário ou senha inválidos.';
      }
    } catch (e) {
      console.error('Erro no login:', e);
      msg.innerText = (e && e.message) ? e.message : 'Erro ao entrar.';
    }
  };

  $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };

  document.querySelectorAll('.close').forEach(b => b.onclick = function () {
    this.closest('.modal').style.display = 'none';
  });

  document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));

  // buscas (mantém)
  $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
  $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});

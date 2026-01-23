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

async function initApp() {
  $('tela-login').style.display = 'none';
  $('tela-dashboard').style.display = 'flex';
  $('display-nome-usuario').innerText = state.user.nome;

  aplicarPermissoesUI();

  const isUser = (String(state.user?.perfil || '').toLowerCase() === 'usuario');
  try {
    if (isUser) await navegar('apontamento');
    else await navegar('dashboard');
  } catch (e) {
    console.error('Erro ao navegar após login:', e);
    alert('Erro ao abrir o sistema: ' + (e?.message || e));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const msg = $('msg-erro');
  const dash = $('tela-dashboard');

  // Ajuda: captura erros que impedem o clique do login
  window.addEventListener('error', (ev) => {
    // só mostra se ainda estiver na tela de login
    if ($('tela-login') && $('tela-login').style.display !== 'none') {
      msg.innerText = (ev && ev.message) ? ev.message : 'Erro ao carregar o sistema.';
    }
  });
  window.addEventListener('unhandledrejection', (ev) => {
    if ($('tela-login') && $('tela-login').style.display !== 'none') {
      const e = ev && ev.reason;
      msg.innerText = (e && e.message) ? e.message : 'Erro ao carregar o sistema.';
    }
  });

  // Handler do login (sempre registra, mesmo se outro init falhar)
  $('btnLogin').onclick = async () => {
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

  // Init handlers de formulários/modais (não pode travar o login)
  try {
    initModals();
  } catch (e) {
    console.error('Erro no initModals:', e);
    // mantém login funcionando
  }

  const sess = localStorage.getItem('sess_gestao');
  if (sess) {
    try {
      state.user = JSON.parse(sess);
      initApp();
    } catch (e) {
      localStorage.removeItem('sess_gestao');
    }
  }

  $('btnSair').onclick = () => { localStorage.removeItem('sess_gestao'); location.reload(); };

  document.querySelectorAll('.close').forEach(b => b.onclick = function () {
    this.closest('.modal').style.display = 'none';
  });

  document.querySelectorAll('.sidebar li').forEach(li => li.onclick = () => navegar(li.dataset.route));


  // Desktop: recolher/expandir sidebar
  const btnCollapse = document.getElementById('btnCollapse');
  const iconCollapse = document.getElementById('iconCollapse');

  const applyCollapseIcon = () => {
    if (!iconCollapse || !dash) return;
    const collapsed = dash.classList.contains('sidebar-collapsed');
    iconCollapse.innerText = collapsed ? 'chevron_right' : 'chevron_left';
    if (btnCollapse) btnCollapse.setAttribute('aria-label', collapsed ? 'Mostrar menu lateral' : 'Esconder menu lateral');
  };

  // aplica estado salvo
  try {
    const saved = localStorage.getItem('ui_sidebar_collapsed');
    if (saved === '1' && dash) dash.classList.add('sidebar-collapsed');
  } catch(e) {}
  applyCollapseIcon();

  if (btnCollapse && dash) {
    btnCollapse.onclick = () => {
      dash.classList.toggle('sidebar-collapsed');
      try { localStorage.setItem('ui_sidebar_collapsed', dash.classList.contains('sidebar-collapsed') ? '1' : '0'); } catch(e) {}
      applyCollapseIcon();
    };
  }

  // Mobile: toggle do menu lateral
  const btnMenu = document.getElementById('btnMenu');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (btnMenu && dash) btnMenu.onclick = () => dash.classList.toggle('sidebar-open');
  if (backdrop && dash) backdrop.onclick = () => dash.classList.remove('sidebar-open');
  window.addEventListener('resize', () => { if (dash && window.innerWidth > 900) dash.classList.remove('sidebar-open'); });

  // buscas (mantém)
  $('barra-pesquisa').onkeyup = () => renderProdutos(state.produtos);
  $('barra-pesquisa-financeiro').onkeyup = () => renderFinanceiro(state.financeiro);
});
// Estado global simples
export const state = {
  user: null,

  produtos: [],
  financeiro: [],
  notas: [],
  usuarios: [],
  funcionarios: [],
  fornecedores: [],
  grupos: [],
  apontamentos: [],

  // Auxiliares de telas
  itensNotaManual: [],
  tipoFinanceiro: 'Despesa',
  itensContagem: [],
  produtoContagemSelecionado: null,

  // Navegação
  route: 'dashboard',
  currentView: 'dashboard',
};

// Perfis suportados
export const ROLES = {
  ADMIN: 'administrador',
  USUARIO: 'usuario',
  FUNCIONARIO: 'funcionario',
};

export function normalizeRole(perfilRaw, isFuncionario = false) {
  const p = (perfilRaw ?? '').toString().trim().toLowerCase();
  let role = p;

  if (['admin', 'administrador', 'adm', 'administrator'].includes(p)) role = ROLES.ADMIN;
  else if (['funcionario', 'funcionário', 'employee'].includes(p)) role = ROLES.FUNCIONARIO;
  else if (['usuario', 'usuário', 'user'].includes(p) || !p) role = ROLES.USUARIO;

  // Compatibilidade: se estiver vinculado a funcionário (campo/flag), trata como FUNCIONARIO,
  // a menos que seja ADMIN explicitamente.
  if (role !== ROLES.ADMIN && isFuncionario) role = ROLES.FUNCIONARIO;

  return role;
}

export function getRole() {
  if (!state.user) return null;
  const isFunc = !!(state.user.is_funcionario || state.user.funcionario_id);
  return normalizeRole(state.user.perfil, isFunc);
}

export function isAdmin() { return getRole() === ROLES.ADMIN; }
export function isUsuario() { return getRole() === ROLES.USUARIO; }
export function isFuncionario() { return getRole() === ROLES.FUNCIONARIO; }

export function allowedViewsForRole(role) {
  if (role === ROLES.ADMIN) return null; // null = tudo
  if (role === ROLES.USUARIO) return ['relatorios'];
  if (role === ROLES.FUNCIONARIO) return ['apontamento'];
  return ['dashboard'];
}

export function defaultViewForRole(role) {
  if (role === ROLES.ADMIN) return 'dashboard';
  if (role === ROLES.USUARIO) return 'relatorios';
  if (role === ROLES.FUNCIONARIO) return 'apontamento';
  return 'dashboard';
}

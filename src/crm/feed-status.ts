type FeedFailure = {code?: string} | null | undefined;
export function feedErrorMessage(error: FeedFailure, action: 'export' | 'issue' | 'revoke') {
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return 'A função de integração não está instalada. Solicite a aplicação da migração de leitura em um ambiente autorizado.';
  if (error?.code === '42501' || error?.code === '28000')
    return 'Seu acesso não autorizou esta operação. Verifique a sessão e as permissões da conta do dashboard.';
  if (error?.code === 'PGRST116')
    return 'Nenhuma base salva foi encontrada. Aguarde a sincronização do dashboard antes de exportar.';
  return action === 'export'
    ? 'Não foi possível exportar a versão salva. Verifique sua conexão e tente novamente.'
    : 'O servidor não confirmou a alteração da chave. Verifique a conexão antes de tentar novamente; uma operação pode ter sido concluída mesmo sem resposta.';
}

# PU Control — versão conectada ao Supabase

## Como executar
1. Extraia o ZIP inteiro (os três arquivos JS/HTML precisam ficar juntos).
2. Sirva a pasta por HTTP, por exemplo: `python -m http.server 8080`, e abra `http://localhost:8080`.
3. Entre com o e-mail e senha cadastrados em **Supabase Authentication → Users**. O perfil correspondente precisa existir em `public.profiles`, com `active = true`.
4. Teste um cadastro de material, um modelo e uma perda, depois atualize a página para verificar persistência.

## Integrações realizadas
- Login real via Supabase Auth, com recuperação de sessão e logout.
- Consulta e cadastro/edição/exclusão de materiais e modelos.
- Consulta, registro e exclusão de perdas, com RLS no servidor.
- Consulta de perfis e edição de função/ativação pelo administrador.
- Dados de demonstração deixam de ser enviados ao banco; os dados carregados vêm do Supabase.

## Limitações intencionais
- **Fotos:** desabilitadas até configurar um bucket privado e políticas de Storage.
- **Criação/exclusão de contas e troca de senha de terceiros:** requer Edge Function/backend seguro com autorização administrativa. Use o painel Auth do Supabase por enquanto.
- **Importação de Excel:** desabilitada para evitar sobrescrever o banco real. Exportações continuam disponíveis.
- **Testes:** a integração foi revisada estaticamente, mas não foi possível executar testes contra o seu banco Supabase; ajuste nomes de colunas caso o esquema implantado seja diferente do esquema compartilhado.

## Segurança
A chave `sb_publishable_...` é pública e apropriada ao navegador. **Nunca exponha `service_role` ou uma secret key.** Mantenha RLS e políticas configuradas nas tabelas. A visibilidade de perdas por perfil depende das políticas do banco.

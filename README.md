# Diário do Intestino

Diário pessoal de saúde gastrointestinal, com foco em registros rápidos e em uma linha do tempo clara. O produto ajuda a entender padrões observados nos próprios registros — nunca diagnósticos.

## Primeira entrega

- Home mobile-first com resumo do dia e indicador intestinal informativo;
- formulários rápidos para refeição, sintoma e evacuação;
- linha do tempo ordenada por horário;
- categorias opcionais por evento (por exemplo, Almoço, Cólica e Evacuação), permitindo vários registros no mesmo dia;
- anexo de foto de evacuação com pré-visualização e confirmação da sugestão de Bristol;
- esquema Prisma preparado para PostgreSQL, com isolamento dos eventos por `userId`;
- integração opcional com Supabase Auth, PostgreSQL/RLS e Storage para eventos e fotos;
- entidades de refeições, alimentos/tags, sintomas e evacuações prontas para o próximo passo.

Os registros da tela são demonstrativos e ficam apenas na sessão do navegador nesta entrega. A persistência, autenticação, edição/exclusão e a chamada real ao modelo de visão entram quando o PostgreSQL e o provedor de IA estiverem configurados.

## Ativar persistência no Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute [`supabase/schema.sql`](supabase/schema.sql). Ele cria a tabela `health_events`, políticas RLS por usuário e o bucket privado de fotos.
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores do painel do Supabase. Use apenas a chave publicável/anon no navegador; nunca coloque a `service_role` no frontend.
4. No projeto Vercel, adicione as mesmas duas variáveis em **Settings → Environment Variables** e faça um novo deploy.
5. A Home exibirá login/cadastro. Depois de entrar, os eventos e fotos serão salvos no Supabase e protegidos por RLS.

Com o Supabase configurado, a rota `/` exige uma sessão válida e redireciona automaticamente usuários não autenticados para `/login`. Após login ou criação da conta, o usuário retorna para a Home.

O app continua funcionando em modo demonstrativo quando as variáveis do Supabase não estão definidas.

A análise de alimentos e insights estatísticos da Fase 2 foi removida da interface atual. As tags simples continuam disponíveis para organização manual do histórico.

## Desenvolvimento

1. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com a conexão PostgreSQL.
2. Use o runtime Node do seu ambiente e execute `pnpm install`.
3. Execute `pnpm dev`.

Para validar uma versão de produção neste ambiente, use `next build --webpack`; o modo Turbopack pode exigir permissões de rede local que não estão disponíveis aqui.

## Segurança e privacidade

O esquema central exige `userId` em cada evento e possui um índice composto por usuário/data. As APIs que serão adicionadas na próxima entrega devem sempre obter o usuário da sessão e filtrar por esse campo — nunca aceitar `userId` diretamente do cliente.

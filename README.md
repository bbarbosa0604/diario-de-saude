# HealthLog

Diário pessoal de saúde gastrointestinal, com foco em registros rápidos e em uma linha do tempo clara. O produto apresenta padrões observados nos registros do usuário — nunca diagnósticos.

## Primeira entrega

- Home mobile-first com resumo do dia e indicador intestinal informativo;
- formulários rápidos para refeição, sintoma e evacuação;
- linha do tempo ordenada por horário;
- categorias opcionais por evento (por exemplo, Almoço, Cólica e Evacuação), permitindo vários registros no mesmo dia;
- anexo de foto de evacuação com pré-visualização e confirmação da sugestão de Bristol;
- esquema Prisma preparado para PostgreSQL, com isolamento dos eventos por `userId`;
- entidades de refeições, alimentos/tags, sintomas e evacuações prontas para o próximo passo.

Os registros da tela são demonstrativos e ficam apenas na sessão do navegador nesta entrega. A persistência, autenticação, edição/exclusão e a chamada real ao modelo de visão entram quando o PostgreSQL e o provedor de IA estiverem configurados.

## Desenvolvimento

1. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com a conexão PostgreSQL.
2. Use o runtime Node do seu ambiente e execute `pnpm install`.
3. Execute `pnpm dev`.

Para validar uma versão de produção neste ambiente, use `next build --webpack`; o modo Turbopack pode exigir permissões de rede local que não estão disponíveis aqui.

## Segurança e privacidade

O esquema central exige `userId` em cada evento e possui um índice composto por usuário/data. As APIs que serão adicionadas na próxima entrega devem sempre obter o usuário da sessão e filtrar por esse campo — nunca aceitar `userId` diretamente do cliente.

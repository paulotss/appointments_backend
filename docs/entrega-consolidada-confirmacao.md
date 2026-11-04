# Entrega consolidada de confirmação — 04/11/2026

Reúne a homologação administrativa e a integração das campanhas aprovadas com o
dispatcher em simulação. A preparação da próxima entrega está em
[proxima-entrega-confirmacao.md](proxima-entrega-confirmacao.md).

## Conteúdo por repositório

| Repositório | Alterações | Commits de origem preservados |
| --- | --- | --- |
| appointments_backend | Homologação descartável, escopo exclusivo, reserva por revisão, revalidação e relatórios simulados | `910bb5a`, `d92d174` |
| appointments_frontend | Correção de autorização expirada, testes administrativos e histórico de simulações | `b3d8e1c`, `32702cd` |
| higia-chat | Campanha Higia no dispatcher existente, com fila em memória e remetente sem rede | `31c750c` |

As branches originais `codex/homologacao-administrativa` e
`codex/campanhas-dispatcher-simulacao` permanecem preservadas nos repositórios em
que existem. A branch de entrega é `codex/consolidacao-confirmacao-mvp`.
Backend e frontend recebem um commit único; o Bridge mantém seu commit único
original, com a mesma árvore de arquivos já validada.

A consolidação também atualiza o runner administrativo: ele gera Prisma em uma
cópia privada das dependências para acompanhar a tabela de simulações. Prisma,
Python e Vite ficam isolados dos arquivos `.env` locais. Nenhuma dependência ou
build dos serviços em execução é sobrescrito.

## Validação da combinação

- Backend: 47 testes administrativos/simulação e typecheck TypeScript aprovados.
- Fluxo administrativo: 11 grupos de verificação aprovados no ambiente descartável.
- Simulação: contrato HTTP autenticado e nove verificações de histórico no navegador aprovados.
- Frontend: quatro testes de situação da autorização e build/TypeScript aprovados.
- Bridge: typecheck aprovado; árvore idêntica ao commit `31c750c`, cuja suíte de
  365 testes passou na entrega anterior. O teste HTTP integrado, que fica pulado
  na suíte geral sem fixture, foi executado novamente e passou nesta consolidação.
- Python: runners com sintaxe validada e classificação exercitada na homologação;
  não há typechecker configurado, e sintaxe não substitui typecheck.

Os bancos, containers, dependências e arquivos de sessão das execuções foram
removidos. Evidências locais ficam em `/tmp/higia-admin-homologation` e
`/tmp/higia-simulation-browser`, sem tokens ou registros reais.

## Publicação e uso no ambiente

Preparar três PRs coordenados contra `main`, um por repositório acima. O backend
fornece o novo contrato e a migration consumidos pelo frontend e pelo Bridge.
Após revisão e merges autorizados, sincronizar os três checkouts por fast-forward.

Para usar a simulação no ambiente escolhido, ainda será necessário aplicar
`20261104190000_confirmation_simulations`, regenerar Prisma e configurar um token
exclusivo `CONFIRMATION_SIMULATE`. A preparação desta consolidação não executa
essas operações no banco de desenvolvimento ou em produção.

O envio real, a confirmação no Saúde Vianet e o deploy continuam bloqueados.
Push, criação de PR e merge aguardam autorização específica conforme os AGENTS.md.

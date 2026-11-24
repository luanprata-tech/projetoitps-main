# ProjetoITPS

Crie uma aplicação web moderna de Acompanhamento de Projetos de Pesquisa e Extensão em React, Tailwind CSS e Lucide Icons, com um design limpo e profissional (estilo dashboard corporativo/acadêmico). A aplicação deve conter duas abas principais ou telas navegáveis:

1. Visão Geral de Projetos:

- Uma tabela listando projetos (ex: "Controle de Qualidade em Alimentos e Bebidas Industrializados").

- Colunas: Título do Projeto, Edital, Objetivo, Início, Finalização, Supervisor(a), Bolsistas (DTR, DTI 1, DTI 2, etc.), Relatório Final (com botão de arquivo) e Impacto Social.

- Botão para "Adicionar Novo Projeto" abrindo um modal de cadastro.

2. Detalhes do Plano de Trabalho (Ex: Controle de Qualidade):

- Um cabeçalho com o título do projeto e objetivo.

- Uma tabela de Metas e Atividades do Plano de Trabalho (M01 até M10) contendo:

  - Código da Meta (M01, M02...)

  - Descrição da Atividade

  - Checkboxes para os Semestres: 1º Semestre (Ano 1), 2º Semestre (Ano 1), 3º Semestre (Ano 2), 4º Semestre (Ano 2).

  - Status Atual (Select com opções coloridas: "Planejado" em azul, "Em Andamento" em amarelo, "Concluído" em verde).

  - Coluna de Progresso (%) com barra visual de progresso.

- Duas sub-tabelas adicionais abaixo:

  - Tabela de Acompanhamento Temporal (Datas, Descrição do Acompanhamento, Justificativa e botão de Anexos).

  - Tabela de Custos / Investimentos (Datas, Material de Consumo/Permanente e Valor em R$).

Adicione dados mockados (exemplos reais baseados nos seus projetos) para que a interface já nasça preenchida e interativa. Permita editar os campos, alterar status e marcar checkboxes diretamente na interface.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://projetoitps.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/119f0f49-def9-475a-bd90-d4b2c78532d1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

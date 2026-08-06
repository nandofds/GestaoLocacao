# Roteiro de testes — Lume

Use este documento como checklist manual após mudanças importantes ou antes de uma publicação. Execute os testes com pelo menos duas empresas e um usuário comum, além do superusuário.

## 1. Autenticação e multiempresa

- [ ] Criar usuário e entrar com e-mail/senha.
- [ ] Confirmar nome do usuário e empresa ativa no cabeçalho.
- [ ] Entrar com usuário comum e validar que ele vê somente dados da própria empresa.
- [ ] Entrar como superusuário e validar a visão global.
- [ ] Trocar a empresa ativa e confirmar a atualização das telas.
- [ ] Sair e entrar novamente.

## 2. Clientes

- [ ] Cadastrar cliente PF com CPF, telefone e WhatsApp.
- [ ] Cadastrar cliente PJ com CNPJ numérico.
- [ ] Cadastrar cliente PJ com CNPJ alfanumérico, por exemplo `12ABC34501DE35`.
- [ ] Confirmar máscaras na edição e listagem.
- [ ] Editar e salvar um cliente.
- [ ] Buscar por nome, documento, e-mail e telefone.
- [ ] Trocar de empresa e validar o isolamento.

## 3. Equipamentos e categorias

- [ ] Criar categoria e confirmar que aparece imediatamente no seletor.
- [ ] Tentar criar a mesma categoria novamente e validar o bloqueio.
- [ ] Cadastrar equipamento com código interno e QR.
- [ ] Deixar o QR vazio e confirmar o uso automático do código interno.
- [ ] Tentar repetir código interno e QR na mesma empresa.
- [ ] Editar equipamento, condição e local de armazenamento.
- [ ] Trocar de empresa e validar o isolamento.

## 4. Etiquetas QR

- [ ] Abrir a etiqueta individual de um equipamento.
- [ ] Ler o QR pelo celular e confirmar que contém somente o `qr_value`.
- [ ] Selecionar vários equipamentos e abrir a impressão em lote.
- [ ] Testar folha A4 e salvar como PDF.
- [ ] Testar impressora de etiqueta em `50×30`, `60×35`, `60×40` e `90×30 mm`.
- [ ] Testar largura e altura personalizadas.
- [ ] Confirmar uma página por etiqueta no modo de impressora térmica.

## 5. Insumos e estoque

- [ ] Cadastrar insumo com categoria, unidade, saldo, mínimo e custo.
- [ ] Editar o insumo.
- [ ] Confirmar alerta quando o saldo estiver abaixo do mínimo.
- [ ] Tentar repetir o nome do insumo na mesma empresa.
- [ ] Trocar de empresa e validar o isolamento.

## 6. Colaboradores

- [ ] Cadastrar colaborador com CPF, telefone, função, contratação, disponibilidade, habilidades e diária.
- [ ] Confirmar máscaras de CPF e telefone.
- [ ] Editar o colaborador.
- [ ] Marcar cadastro como inativo.
- [ ] Tentar repetir CPF na mesma empresa.
- [ ] Trocar de empresa e validar o isolamento.

## 7. Eventos

- [ ] Cadastrar evento vinculado a um cliente.
- [ ] Confirmar sugestão automática de início 12 horas após a montagem.
- [ ] Ajustar manualmente o início para menos de 12 horas e salvar.
- [ ] Tentar usar datas fora da ordem montagem → início → término → desmontagem.
- [ ] Editar local, valores e status.
- [ ] Conferir legenda dos status.
- [ ] Trocar de empresa e validar o isolamento.

## 8. Reserva e disponibilidade

- [ ] Abrir “Gerenciar equipamentos” no evento.
- [ ] Reservar equipamento com saída, retorno e folga logística.
- [ ] Fechar e abrir novamente para validar persistência.
- [ ] Criar outro evento no mesmo período e confirmar o conflito.
- [ ] Remover a reserva e confirmar a liberação.
- [ ] Cancelar o evento e confirmar a liberação sem perda do histórico.
- [ ] Confirmar bloqueio de equipamento danificado, extraviado ou baixado.

## 9. Separação

- [ ] Confirmar que evento `PLANEJADO` não aparece.
- [ ] Confirmar que eventos `CONFIRMADO` e `EM_ANDAMENTO` aparecem.
- [ ] Ler ou digitar QR/código de item reservado.
- [ ] Tentar conferir novamente o mesmo item.
- [ ] Tentar conferir item que não pertence ao evento.
- [ ] Desfazer uma conferência.
- [ ] Atualizar a página e validar o progresso persistido.
- [ ] Trocar de empresa e validar o isolamento.

## 10. Saída do galpão

- [ ] Confirmar que separação incompleta bloqueia a saída.
- [ ] Selecionar o colaborador que liberou os equipamentos.
- [ ] Finalizar sem informar responsável pelo transporte, que é opcional.
- [ ] Finalizar informando motorista ou transportadora.
- [ ] Atualizar a página e validar o comprovante persistido.
- [ ] Tentar registrar uma segunda saída para o mesmo evento.
- [ ] Tentar desfazer a separação após a saída.
- [ ] Confirmar que os itens passam para `EM_USO`.

## 11. Retorno

- [ ] Conferir item como `BOM`.
- [ ] Conferir item como `DANIFICADO` e exigir descrição do defeito.
- [ ] Registrar item como `EXTRAVIADO` pelo código interno.
- [ ] Tentar repetir a conferência do mesmo item.
- [ ] Tentar conferir item que não saiu no evento.
- [ ] Desfazer uma conferência antes da finalização.
- [ ] Confirmar que itens pendentes bloqueiam a finalização.
- [ ] Selecionar o colaborador que recebeu no galpão e finalizar.
- [ ] Confirmar item normal como `DISPONIVEL`.
- [ ] Confirmar item danificado como `EM_MANUTENCAO`.
- [ ] Confirmar extraviado fora do estoque disponível.

## 12. Manutenção e auditoria

- [ ] Abrir a ordem criada automaticamente pelo retorno danificado.
- [ ] Atribuir responsável técnico e urgência.
- [ ] Percorrer análise, peça, conserto e teste.
- [ ] Informar custo, diagnóstico e observação técnica.
- [ ] Reabrir a ordem e conferir a linha do tempo.
- [ ] Concluir com condição `ÓTIMO`, `BOM` ou `REGULAR`.
- [ ] Confirmar retorno do item ao estoque disponível.
- [ ] Testar `SEM_REPARO` em um item próprio para teste.
- [ ] Confirmar baixa definitiva e histórico preservado.

## 13. Relatórios e configurações

- [ ] Filtrar relatórios por período e conferir os eventos retornados.
- [ ] Confirmar que eventos cancelados não entram nos indicadores financeiros.
- [ ] Reconciliar valor dos eventos, custos adicionais, manutenção e resultado estimado.
- [ ] Alternar a empresa ativa e confirmar isolamento dos dados do relatório.
- [ ] Abrir Configurações como proprietário e alterar o nome da empresa.
- [ ] Abrir Configurações como gestor ou operador e confirmar bloqueio da edição.
- [ ] Confirmar que o novo nome aparece no cabeçalho após atualizar a sessão.

## 14. Responsividade e regressão

- [ ] Validar desktop em aproximadamente `1440×1024`.
- [ ] Validar celular em aproximadamente `390×844`.
- [ ] Confirmar ausência de erros no console.
- [ ] Executar `npm run lint`.
- [ ] Executar `npm run build`.

## Pendências para testes futuros

- [ ] Agenda real diária, semanal e mensal.
- [ ] Desconectar a rede, registrar retorno e confirmar persistência no IndexedDB.
- [ ] Marcar dano após uma leitura offline e confirmar que ele substitui o retorno comum na fila.
- [ ] Reconectar e confirmar sincronização e remoção somente das operações aceitas.
- [ ] Simular falha de sincronização e confirmar preservação da operação com nova tentativa.
- [ ] Tentar trocar de empresa com fila pendente e confirmar o bloqueio.
- [ ] Leitura por câmera.
- [ ] Deploy na Vercel.
- [ ] SMTP, confirmação de e-mail e recuperação de senha.

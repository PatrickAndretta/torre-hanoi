===============================================================================
TRABALHO AVALIATIVO DE INTELIGENCIA ARTIFICIAL
Problema 2 - Torre de Hanoi
Implementacao e comparacao de UCS, Busca Gulosa e A*
Prof. Marcos Augusto Campagnaro Mucelini
===============================================================================

INTEGRANTES
-------------------------------------------------------------------------------
  Nome completo .................... Matricula
  1) __________________________      __________
  2) __________________________      __________
  3) __________________________      __________
  4) __________________________      __________

  (preencher antes da entrega)


LINGUAGEM E VERSAO
-------------------------------------------------------------------------------
  Python 3.14.6
  Somente biblioteca padrao (time, json, os, urllib, http.server).
  Nenhuma biblioteca pronta de busca foi utilizada.
  A interface grafica usa HTML + CSS + JavaScript puro, servidos pelo modulo
  http.server da propria biblioteca padrao do Python.


COMO RODAR
-------------------------------------------------------------------------------
  1) Comparacao no terminal (tabela de metricas para 3, 4, 5, 6 e 7 discos,
     mais a sequencia de jogadas da instancia de 3 discos):

         python3 hanoi.py

  2) Interface grafica (extra opcional), onde se escolhe o numero de discos,
     o limite de tempo, e a solucao de cada algoritmo pode ser animada:

         python3 servidor.py

     Depois abra no navegador:  http://localhost:8000
     Encerre o servidor com Ctrl+C.

  Observacao: os dois comandos devem ser executados de dentro desta pasta.


ARQUIVOS
-------------------------------------------------------------------------------
  hanoi.py           Modelagem do problema, heuristica, a funcao unica de busca
                     e as tres funcoes f. Roda a comparacao no terminal.
  servidor.py        Servidor HTTP minimo que expoe a busca em /api/buscar e
                     serve os arquivos da pasta web/.
  web/index.html     Pagina da interface grafica.
  web/estilo.css     Estilo da interface.
  web/aplicacao.js   Preenche a tabela e anima a solucao. Nao implementa busca.
  README.txt         Este arquivo.


A REGRA MAIS IMPORTANTE DO TRABALHO
-------------------------------------------------------------------------------
  Existe UMA UNICA funcao de busca no projeto:

      busca(problema, f, limite_de_tempo)   em hanoi.py

  Os tres algoritmos saem apenas da troca da funcao f:

      UCS     ->  f_ucs(no)       = no["custo"]
      Gulosa  ->  f_gulosa(no)    = h(no)
      A*      ->  f_a_estrela(no) = no["custo"] + h(no)

  onde h e heuristica_discos_fora_do_lugar.


MODELAGEM RESUMIDA
-------------------------------------------------------------------------------
  Estado    tupla com um pino para cada disco. O indice e o numero do disco,
            sendo 0 o menor disco, e o valor e o pino onde ele esta.
            Exemplo com 4 discos: (0, 0, 2, 1).
            Usamos tupla porque ela e imutavel e serve como chave do dicionario
            de estados alcancados. Lista daria o erro "unhashable type".
  Acoes     mover o disco do topo de um pino para outro pino, desde que o
            destino esteja vazio ou tenha um disco maior no topo.
  Custo     1 por movimento.
  Objetivo  todos os discos no pino C.
  Heuristica  h(n) = numero de discos que ainda nao estao no pino de destino.
              Sai do relaxamento em que as regras "so move o disco do topo" e
              "nunca coloque um disco maior sobre um menor" sao apagadas.
              E admissivel porque cada disco fora do lugar precisa ser movido
              pelo menos uma vez, entao h nunca passa do custo real.


LIMITE DE TEMPO ADOTADO PELA EQUIPE
-------------------------------------------------------------------------------
  60 segundos por busca (constante LIMITE_DE_TEMPO_EM_SEGUNDOS em hanoi.py, e
  campo ajustavel na interface grafica).
  Se a busca estourar esse limite, ela e interrompida e o resultado aparece
  como "nao concluiu em 60s", tanto no terminal quanto na tabela da interface.


METRICAS COLETADAS
-------------------------------------------------------------------------------
  Custo da solucao   soma dos custos das acoes do caminho encontrado.
  Numero de passos   quantidade de acoes da solucao.
  Nos expandidos     nos retirados da fronteira que tiveram os filhos gerados.
                     (o codigo tambem conta os nos gerados, mas a metrica
                     comparada e a de expandidos, como pede o enunciado)
  Tempo              medido com time.perf_counter().


GABARITO PARA CONFERENCIA
-------------------------------------------------------------------------------
  A solucao otima da Torre de Hanoi com n discos custa exatamente 2^n - 1
  movimentos. O programa imprime essa conferencia para UCS e A* a cada
  instancia rodada no terminal.
